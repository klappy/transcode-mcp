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

// Defense-in-depth SSRF guard. The Worker's parseProxyPath already requires a
// http:// or https:// prefix, but ffmpeg in the container has its own network
// stack that does not inherit Cloudflare Workers' fetch protections against
// private/link-local addresses. Re-validate here so a crafted source URL like
// http://169.254.169.254/ (cloud metadata) or http://10.x.x.x/ cannot be
// proxied through ffmpeg's HTTP client.
function isBlockedHost(host) {
  if (!host) return true;
  // Strip IPv6 brackets if present.
  let h = host;
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  const lower = h.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower === "metadata" || lower === "metadata.google.internal") return true;
  // IPv6 loopback / link-local / unique-local.
  if (lower === "::1" || lower === "::") return true;
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  // IPv4-mapped IPv6 (::ffff:x.x.x.x). The WHATWG URL parser normalizes the
  // dotted-quad form to two hex groups (e.g. ::ffff:a9fe:a9fe), so we must
  // recognize both representations and validate the embedded IPv4 address.
  if (lower.startsWith("::ffff:")) {
    const tail = lower.slice("::ffff:".length);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(tail)) {
      return isBlockedHost(tail);
    }
    const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      return isBlockedHost(dotted);
    }
    return true;
  }
  // IPv4 dotted-quad checks.
  const m = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // RFC 6598 CGNAT shared address space
    if (a >= 224) return true; // multicast / reserved
  }
  return false;
}

function validateSourceUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return "invalid source_url";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return `unsupported source_url scheme: ${u.protocol}`;
  }
  if (isBlockedHost(u.hostname)) {
    return "source_url host is not allowed";
  }
  return null;
}

// ffmpeg's HTTP protocol follows up to 8 HTTP 3xx redirects by default
// (libavformat/http.c MAX_REDIRECTS), and only the *initial* URL passes
// through validateSourceUrl. Without this resolver, an attacker-controlled
// public host could 302-redirect ffmpeg to http://169.254.169.254/ or another
// internal address, bypassing the SSRF guard entirely. We follow redirects
// here (manual mode), re-validate each hop's protocol + host, and hand
// ffmpeg the already-resolved terminal URL — plus -max_redirects 0 so
// ffmpeg itself never chases a redirect we didn't sign off on.
async function resolveAllowedUrl(raw, maxHops = 8) {
  let current = raw;
  let contentLength = "";
  for (let i = 0; i <= maxHops; i++) {
    const err = validateSourceUrl(current);
    if (err) return { error: err };
    let res;
    try {
      res = await fetch(current, { method: "HEAD", redirect: "manual" });
    } catch (e) {
      return { error: `source_url unreachable: ${e?.message || e}` };
    }
    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");
    if (!isRedirect || !location) {
      contentLength = res.headers.get("content-length") ?? "";
      return { url: current, contentLength };
    }
    let next;
    try {
      next = new URL(location, current).toString();
    } catch {
      return { error: "invalid redirect Location" };
    }
    current = next;
  }
  return { error: "too many redirects" };
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

  // Follow redirects ourselves so each hop is SSRF-validated; ffmpeg only
  // ever sees the terminal URL (and is told not to follow further redirects).
  // resolveAllowedUrl validates the initial URL as its first hop, so no
  // separate validateSourceUrl call is needed here.
  const resolved = await resolveAllowedUrl(source_url);
  if (resolved.error) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(resolved.error);
    return;
  }
  const fetchUrl = resolved.url;
  const sourceBytes = resolved.contentLength;

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
    // -max_redirects 0 disables ffmpeg's own redirect-following so the
    // SSRF check in resolveAllowedUrl cannot be bypassed.
    await run("ffmpeg", [
      "-hide_banner",
      "-y",
      "-max_redirects", "0",
      "-i", fetchUrl,
      ...recipe.args,
      out,
    ]);

    const [bytes, probe] = await Promise.all([
      readFile(out),
      ffprobe(out),
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
