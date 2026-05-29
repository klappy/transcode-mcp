// Minimal audio transcode server. Listens on $PORT (default 8080), accepts a
// POST with JSON { source_url, preset, q, codec }, resolves the recipe from the
// DATA table (recipes.mjs), runs ffmpeg reading the source URL directly, and
// returns the encoded bytes with ffprobe metadata in response headers.
//
// The server is codec-agnostic: all codec/quality knowledge lives in
// recipes.mjs. It knows nothing about the cache key, R2, or credentials — that
// is the Worker's side of the boundary
// (canon/planning/2026-05-26-worker-container-boundary.md).

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRecipe } from "./recipes.mjs";

const PORT = Number(process.env.PORT) || 8080;

// Run a command with an explicit argument list (never a shell string), capture
// stdout as a Buffer and stderr as text. Rejects on non-zero exit.
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    let stderr = "";
    child.stdout.on("data", (d) => stdout.push(d));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(stdout), stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

// ffprobe the output file for the fields the recipe DoD requires.
async function ffprobe(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    path,
  ]);
  const j = JSON.parse(stdout.toString());
  const audio = (j.streams || []).find((s) => s.codec_type === "audio") || {};
  return {
    duration: j.format?.duration ?? audio.duration ?? "",
    bitrate: j.format?.bit_rate ?? audio.bit_rate ?? "",
    sampleRate: audio.sample_rate ?? "",
    channels: audio.channels != null ? String(audio.channels) : "",
    codecName: audio.codec_name ?? "",
  };
}

async function sourceByteCount(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    return head.headers.get("content-length") ?? "";
  } catch {
    return "";
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" }).end("POST only");
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let job;
  try {
    job = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("invalid JSON body");
    return;
  }

  const { source_url, preset, q, codec } = job;
  if (!source_url || !preset || !q || !codec) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("missing field");
    return;
  }

  const recipe = resolveRecipe(codec, preset, q);
  if (!recipe) {
    // No recipe in this deployment -> let the Worker pass the source through.
    res
      .writeHead(422, { "Content-Type": "text/plain" })
      .end(`no recipe for ${codec}/${preset}/${q}`);
    return;
  }

  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "transcode-"));
    const out = join(dir, `output.${recipe.ext}`);

    // ffmpeg reads the source URL directly (the container fetches the source,
    // per the reconciled dispatch). Recipe args are DATA between -i and out.
    await run("ffmpeg", [
      "-hide_banner",
      "-y",
      "-i", source_url,
      ...recipe.args,
      out,
    ]);

    const [bytes, probe, sourceBytes] = await Promise.all([
      readFile(out),
      ffprobe(out),
      sourceByteCount(source_url),
    ]);

    res.writeHead(200, {
      "Content-Type": recipe.contentType,
      "Content-Length": String(bytes.length),
      "X-Audio-Duration": String(probe.duration),
      "X-Audio-Bitrate": String(probe.bitrate),
      "X-Audio-SampleRate": String(probe.sampleRate),
      "X-Audio-Channels": String(probe.channels),
      "X-Audio-Codec": String(probe.codecName),
      "X-Source-Bytes": String(sourceBytes),
    });
    res.end(bytes);
  } catch (err) {
    res
      .writeHead(500, { "Content-Type": "text/plain" })
      .end(String(err?.message || err));
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

server.listen(PORT, () => {
  console.log(`audio transcode container listening on :${PORT}`);
});
