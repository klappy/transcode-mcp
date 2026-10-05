import { version } from "../../package.json";
// Transport adapter only: discovery and document authority remain in Oddkit.
export const DOCS_ENDPOINT = "https://oddkit.klappy.dev/mcp";
export const DOCS_REPOSITORY = "https://github.com/klappy/transcode-mcp";
export const DOCS_TIMEOUT_MS = 15000;
export const DOCS_MAX_BYTES = 262144;
type Args = { query: string; audience?: string; depth?: "1" | "2" | "3" };
type Caller = (args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
const bytes = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;
function unpack(raw: any): any {
  if (raw?.isError) throw new Error("Oddkit returned an error");
  const text = raw?.content?.find((c: any) => c.type === "text")?.text;
  if (typeof text !== "string" || new TextEncoder().encode(text).length > DOCS_MAX_BYTES) throw new Error("Invalid or oversized Oddkit response");
  const parsed = JSON.parse(text);
  if (!parsed?.result || typeof parsed.result.status !== "string") throw new Error("Invalid Oddkit envelope");
  return parsed;
}
export async function docs(args: Args, call: Caller, timeoutMs = DOCS_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const operation = async () => {
    const search = unpack(await call({ action: "search", input: args.query, knowledge_base_url: DOCS_REPOSITORY,
      result_grouping: "overlay_first", disclosure: ["summary", "metadata"], limit: 5,
      ...(args.audience ? { audience: args.audience } : {}) }, controller.signal));
    controller.signal.throwIfAborted();
    const hits = search.result.data;
    if (!Array.isArray(hits)) throw new Error("Invalid Oddkit search data");
    const governance = search.governance_source ?? search.result.governance_source ?? "undeclared";
    if (!hits.length) return { answer: null, sources: [], deeper: [], governance_source: governance, status: "no_hits" };
    if (hits.some((h: any) => typeof h.uri !== "string" || typeof h.title !== "string")) throw new Error("Invalid Oddkit hit");
    if ((args.depth ?? "1") === "1") return { answer: hits[0].snippet ?? hits[0].summary ?? null, sources: hits, deeper: [], governance_source: governance };
    const documents = [];
    for (const hit of hits.slice(0, args.depth === "3" ? 3 : 1)) {
      controller.signal.throwIfAborted();
      const fetched = unpack(await call({ action: "get", input: hit.uri, knowledge_base_url: DOCS_REPOSITORY, disclosure: ["body", "metadata"] }, controller.signal));
      controller.signal.throwIfAborted();
      const document = fetched.result.data;
      if (fetched.result.status !== "FOUND" || document?.uri !== hit.uri || typeof document.body !== "string") throw new Error("Oddkit document unavailable or invalid");
      documents.push(document);
    }
    return { answer: documents[0].body, sources: documents, deeper: documents.slice(1), governance_source: governance };
  };
  try {
    const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Oddkit request timed out")); }, timeoutMs);
    })]);
    if (bytes(result) > DOCS_MAX_BYTES) throw new Error("Documentation output exceeds response limit");
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  } catch {
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ answer: null, sources: [], deeper: [], governance_source: "minimal", error: "Documentation temporarily unavailable" }) }] };
  } finally { clearTimeout(timer!); controller.abort(); }
}
export async function liveDocs(args: Args) {
  // Lazy SDK loading preserves the worker's existing test-runtime boundary.
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const client = new Client({ name: "transcode-mcp-docs", version });
  let connected = false;
  try {
    return await docs(args, async (arguments_, signal) => {
      if (!connected) {
        await client.connect(new StreamableHTTPClientTransport(new URL(DOCS_ENDPOINT), { requestInit: { signal } }));
        signal.throwIfAborted();
        connected = true;
      }
      return client.callTool({ name: "oddkit", arguments: arguments_ }, undefined, { signal, timeout: DOCS_TIMEOUT_MS });
    });
  } finally { void client.close().catch(() => {}); }
}
