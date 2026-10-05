import { version } from "../../package.json";
import { z } from "zod";
// Transport adapter only: discovery and document authority remain in Oddkit.
export const DOCS_ENDPOINT = "https://oddkit.klappy.dev/mcp";
export const DOCS_REPOSITORY = "https://github.com/klappy/transcode-mcp";
export const DOCS_TIMEOUT_MS = 15000;
export const DOCS_MAX_BYTES = 262144;
const strings = z.union([z.string().min(1).max(256), z.array(z.string().min(1).max(256)).max(32)]);
const kinds = z.enum(["canon", "docs", "journals", "essays", "apocrypha"]);
export const docsSchema = {
  query: z.string().min(1).max(4096).describe("Search text, or one canonical URI for action=get."),
  action: z.enum(["search", "get"]).default("search"),
  disclosure: z.array(z.enum(["blockquote", "metadata", "summary", "body"])).max(4).optional().describe("Defaults to [] for search; [body] for a single-URI get."),
  audience: strings.optional(), exposure: strings.optional(),
  tier: z.union([z.number().int(), z.array(z.number().int()).max(32)]).optional(),
  public: z.boolean().optional(), start_here: z.boolean().optional(), path_prefix: strings.optional(),
  include: z.union([kinds, z.array(kinds).max(5)]).optional(),
  exclude: z.union([kinds, z.array(kinds).max(5)]).optional(),
  tags: strings.optional(),
  limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional(),
  depth: z.enum(["1", "2", "3"]).optional().describe("Deprecated: 1 is the search floor; 2/3 return migration instructions. Use disclosure and a single-URI get."),
  include_legacy_envelope: z.boolean().optional().describe("Opt in to answer/sources/deeper aliases; canonical result remains authoritative."),
};
type Args = z.input<z.ZodObject<typeof docsSchema>>;
type Caller = (args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
const filterKeys = ["audience", "exposure", "tier", "public", "start_here", "path_prefix", "include", "exclude", "tags", "limit", "offset"] as const;
const bytes = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;
function response(value: unknown, isError = false) {
  return { ...(isError ? { isError: true } : {}), content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}
function failure(code: string, message: string) {
  return response({ result: { status: "ERROR", error_code: code, error_message: message }, governance_source: "minimal" }, true);
}
function unpack(raw: any): any {
  const text = raw?.content?.find((c: any) => c.type === "text")?.text;
  if (typeof text !== "string" || new TextEncoder().encode(text).length > DOCS_MAX_BYTES) throw new Error("Invalid or oversized Oddkit response");
  const parsed = JSON.parse(text);
  if (!parsed?.result || typeof parsed.result.status !== "string") throw new Error("Invalid Oddkit envelope");
  if (raw?.isError && parsed.result.status !== "ERROR") throw new Error("Oddkit protocol error");
  return parsed;
}
export async function docs(args: Args, call: Caller, timeoutMs = DOCS_TIMEOUT_MS) {
  const action = args.action ?? "search";
  if (args.depth === "2" || args.depth === "3") return failure("DEPTH_MIGRATION_REQUIRED", "Search with action=search and disclosure flags, then call action=get with query set to one returned canonical URI. Multiple bodies are never retrieved in one docs call.");
  if (args.depth === "1" && (action !== "search" || (args.disclosure?.length ?? 0) > 0)) return failure("DEPTH_CONFLICT", "Remove deprecated depth when using explicit disclosure or action=get.");
  if (action === "get" && (!args.query.startsWith("klappy://") || /\s/.test(args.query))) return failure("SINGLE_URI_REQUIRED", "action=get requires exactly one canonical klappy:// URI returned by search.");
  if (action === "get" && filterKeys.some(key => args[key] !== undefined)) return failure("FILTER_NOT_PERMITTED", "Filters and pagination apply only to search; get selects one URI.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const operation = async () => {
    const request: Record<string, unknown> = { action, input: args.query, knowledge_base_url: DOCS_REPOSITORY,
      disclosure: args.disclosure ?? (action === "get" ? ["body"] : []) };
    if (action === "search") {
      request.result_grouping = "overlay_first";
      for (const key of filterKeys) if (args[key] !== undefined) request[key] = args[key];
    }
    const envelope = unpack(await call(request, controller.signal));
    controller.signal.throwIfAborted();
    // Preserve the authoritative data, totals, echoes and structured errors verbatim.
    const result = envelope.result;
    if (result.status !== "ERROR") {
      if (action === "search" && !Array.isArray(result.data)) throw new Error("Invalid search data");
      if (action === "get" && result.status === "FOUND" && (result.data?.uri !== args.query || typeof result.data.title !== "string")) throw new Error("Invalid document identity");
    }
    const output: Record<string, unknown> = { action, result, governance_source: envelope.governance_source ?? result.governance_source ?? "undeclared" };
    if (args.include_legacy_envelope) {
      const sources = action === "search" ? (result.data ?? []) : (result.data ? [result.data] : []);
      Object.assign(output, { answer: action === "get" ? result.data?.body ?? null : sources[0]?.snippet ?? null, sources, deeper: [] });
    }
    return output;
  };
  try {
    const output = await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Oddkit request timed out")); }, timeoutMs);
    })]);
    if (bytes(output) > DOCS_MAX_BYTES) throw new Error("Documentation output exceeds response limit");
    return response(output, (output.result as any).status === "ERROR");
  } catch { return failure("DOCS_UNAVAILABLE", "Documentation temporarily unavailable; retry explicitly later."); }
  finally { clearTimeout(timer!); controller.abort(); }
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
