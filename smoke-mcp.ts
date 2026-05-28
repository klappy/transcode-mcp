// Live MCP smoke test. Hits a deployed transcode-mcp worker's /mcp endpoint
// with the real Streamable-HTTP JSON-RPC protocol and asserts the basics.
//
//   bun smoke-mcp.ts                      # default: production
//   bun smoke-mcp.ts <base-url>           # any deploy (preview, prod, etc.)
//   bun smoke-mcp.ts preview              # shorthand for current branch preview
//
// Exits non-zero on the first failure. No mocks, no SDK — pure JSON-RPC over
// HTTP so we test the protocol layer the same way Claude Desktop / Cursor /
// the MCP Inspector would.

const DEFAULTS = {
  prod: "https://transcode-mcp.klappy.workers.dev",
  preview: "https://feat-mcp-url-guidance-transcode-mcp.klappy.workers.dev",
};

const arg = process.argv[2] ?? "prod";
const baseUrl =
  arg === "prod"
    ? DEFAULTS.prod
    : arg === "preview"
      ? DEFAULTS.preview
      : arg.replace(/\/$/, "");

const endpoint = baseUrl + "/mcp";

let rpcId = 0;
function nextId() {
  rpcId += 1;
  return rpcId;
}

// Parse an SSE event-stream body into the JSON of its first `data:` line.
// MCP Streamable-HTTP can return either application/json or text/event-stream.
function parseMaybeSse(contentType: string, body: string): unknown {
  if (contentType.includes("text/event-stream")) {
    const line = body.split("\n").find((l) => l.startsWith("data:"));
    if (!line) throw new Error("SSE response had no data line:\n" + body);
    return JSON.parse(line.slice("data:".length).trim());
  }
  return JSON.parse(body);
}

interface RpcOpts {
  sessionId?: string;
}

async function rpc(
  method: string,
  params: unknown,
  opts: RpcOpts = {},
): Promise<{ result?: unknown; error?: unknown; sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (opts.sessionId) headers["mcp-session-id"] = opts.sessionId;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from ${endpoint}\n  method: ${method}\n  body: ${body.slice(0, 500)}`,
    );
  }
  const sessionId = res.headers.get("mcp-session-id") ?? undefined;
  const parsed = parseMaybeSse(res.headers.get("content-type") ?? "", body) as {
    result?: unknown;
    error?: unknown;
  };
  return { ...parsed, sessionId };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("  FAIL  " + msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log("  PASS  " + msg);
}

async function main() {
  console.log("transcode-mcp smoke test → " + endpoint + "\n");

  // 1. initialize handshake
  console.log("1. initialize");
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-mcp", version: "1.0.0" },
  });
  assert(!init.error, "no JSON-RPC error: " + JSON.stringify(init.error));
  const initResult = init.result as {
    protocolVersion?: string;
    serverInfo?: { name?: string; version?: string };
    capabilities?: { tools?: unknown };
  };
  assert(typeof initResult?.protocolVersion === "string", "got protocolVersion");
  assert(initResult.serverInfo?.name === "transcode-mcp", "serverInfo.name is transcode-mcp");
  assert(!!initResult.capabilities?.tools, "server declares tools capability");
  const sessionId = init.sessionId;
  console.log("    session: " + (sessionId ?? "(none)"));

  // 2. tools/list — confirm generate_transcode_url is advertised with the
  //    viewport-primary schema.
  console.log("\n2. tools/list");
  const list = await rpc("tools/list", {}, { sessionId });
  assert(!list.error, "no JSON-RPC error");
  const tools = (list.result as { tools?: Array<{ name?: string; inputSchema?: { properties?: Record<string, unknown> } }> }).tools ?? [];
  const gen = tools.find((t) => t.name === "generate_transcode_url");
  assert(!!gen, "generate_transcode_url is advertised");
  const props = gen!.inputSchema?.properties ?? {};
  assert("source_url" in props, "schema has source_url");
  assert("viewport" in props, "schema has viewport (primary input)");
  assert("q" in props, "schema has q");
  assert("f" in props, "schema has f");
  assert("w" in props && "h" in props, "schema has w/h escape hatches");

  // 3. tools/call — image, viewport-primary
  console.log("\n3. tools/call generate_transcode_url (image, viewport=720)");
  const img = await rpc(
    "tools/call",
    {
      name: "generate_transcode_url",
      arguments: {
        source_url: "https://cdn.example.com/photo.jpg",
        viewport: 720,
        q: "medium",
      },
    },
    { sessionId },
  );
  assert(!img.error, "no JSON-RPC error: " + JSON.stringify(img.error));
  const imgContent = (img.result as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
  const imgText = imgContent[0]?.text;
  assert(typeof imgText === "string", "got text content");
  const imgPayload = JSON.parse(imgText!) as {
    proxy_path?: string;
    full_url?: string;
    embed?: string;
    request?: { viewport?: number; q?: string };
    guidance?: string;
  };
  assert(imgPayload.proxy_path?.includes("s=720"), "viewport mapped to s=720 (NOT w=)");
  assert(!imgPayload.proxy_path?.includes("w="), "no w= in path");
  assert(imgPayload.proxy_path?.includes("q=medium"), "q=medium in path");
  assert(imgPayload.full_url?.startsWith(baseUrl), "full_url uses request origin");
  assert(imgPayload.embed?.includes("<img"), "embed is <img> snippet");
  assert(imgPayload.request?.viewport === 720, "request echoes viewport");
  assert((imgPayload.guidance?.length ?? 0) > 50, "guidance string is substantial");

  // 4. tools/call — w escape hatch
  console.log("\n4. tools/call generate_transcode_url (w=1500 overrides viewport)");
  const adv = await rpc(
    "tools/call",
    {
      name: "generate_transcode_url",
      arguments: {
        source_url: "https://cdn.example.com/photo.jpg",
        viewport: 320,
        w: 1500,
      },
    },
    { sessionId },
  );
  assert(!adv.error, "no JSON-RPC error: " + JSON.stringify(adv.error));
  const advText = (adv.result as { content?: Array<{ text?: string }> }).content?.[0]?.text;
  const advPayload = JSON.parse(advText!) as { proxy_path?: string };
  assert(advPayload.proxy_path?.includes("w=1500"), "w= present");
  assert(!advPayload.proxy_path?.includes("s="), "s= absent (w overrode it)");

  // 5. tools/call — audio
  console.log("\n5. tools/call generate_transcode_url (audio)");
  const aud = await rpc(
    "tools/call",
    {
      name: "generate_transcode_url",
      arguments: {
        source_url: "https://cdn.example.com/voice.mp3",
        media_type: "audio",
        preset: "voice",
        q: "low",
      },
    },
    { sessionId },
  );
  assert(!aud.error, "no JSON-RPC error: " + JSON.stringify(aud.error));
  const audText = (aud.result as { content?: Array<{ text?: string }> }).content?.[0]?.text;
  const audPayload = JSON.parse(audText!) as { proxy_path?: string; embed?: string; guidance?: string };
  assert(audPayload.proxy_path?.startsWith("/audio/"), "audio path");
  assert(audPayload.proxy_path?.includes("preset=voice"), "preset present");
  assert(audPayload.embed?.includes("<audio"), "embed is <audio> snippet");
  assert(audPayload.guidance?.includes("passthrough"), "guidance notes passthrough state");

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("\nSmoke test failed: " + (err as Error).message);
  process.exit(1);
});
