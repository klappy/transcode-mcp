// src/worker.ts
// Proxy-first + lazy transcoding MCP server using current Cloudflare Agents SDK
// Deploy marker: 2026-05-27 v5 - Audio proxy functional as passthrough (ffmpeg step ready for Container)

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

// Half-class perceptual overshoot (from canon)
function halfClass(target: number): number {
  return Math.round(target * 1.5);
}

// Preset mappings (voice corrected to 8k/16k/32k mono)
const PRESET_MAP: Record<string, { rate: number; channels: number; bitrate: string }> = {
  'voice+low':    { rate: 8000,  channels: 1, bitrate: '12k' },
  'voice+medium': { rate: 16000, channels: 1, bitrate: '24k' },
  'voice+high':   { rate: 24000, channels: 1, bitrate: '40k' },
  'music+low':    { rate: 44100, channels: 2, bitrate: '64k' },
  'music+medium': { rate: 48000, channels: 2, bitrate: '96k' },
  'music+high':   { rate: 48000, channels: 2, bitrate: '128k' },
};

const ODDKIT_MCP_URL = "https://oddkit.klappy.dev/mcp";
const CANON_KB_URL = "https://github.com/klappy/transcode-mcp";

function createServer() {
  const server = new McpServer({
    name: "transcode-mcp",
    version: "0.1.0",
  });

  server.tool(
    "generate_transcode_url",
    {
      media_type: z.enum(["image", "audio"]),
      preset: z.string(),
      quality: z.number().optional(),
      source_url: z.string(),
    },
    async (args) => {
      const { media_type, preset, source_url } = args;
      const map = PRESET_MAP[preset] || PRESET_MAP["voice+medium"];
      const targetRate = map.rate;
      const encodeRate = halfClass(targetRate);
      const proxyUrl = `/${media_type}/${preset}/${encodeRate}/${encodeURIComponent(source_url)}`;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ proxy_url: proxyUrl, preset, target_sample_rate: targetRate, encode_sample_rate: encodeRate })
        }]
      };
    }
  );

  server.tool(
    "docs",
    {
      query: z.string(),
      audience: z.string().optional(),
      depth: z.enum(["1", "2", "3"]).optional(),
    },
    async (args) => {
      const { query, audience = "headless", depth = "1" } = args;
      let client: Client | null = null;
      try {
        const transport = new StreamableHTTPClientTransport(new URL(ODDKIT_MCP_URL));
        client = new Client({ name: "transcode-mcp-docs", version: "0.1.0" });
        await client.connect(transport);
        const searchResult = await client.callTool({ name: "oddkit", arguments: { action: "search", input: query, knowledge_base_url: CANON_KB_URL, result_grouping: "overlay_first" } });
        const parsed = JSON.parse(searchResult.content[0].text);
        const hits = parsed?.result?.hits || [];
        if (hits.length === 0) {
          return { content: [{ type: "text", text: JSON.stringify({ answer: null, sources: [], deeper: [], governance_source: "knowledge_base" }) }] };
        }
        const top = hits[0];
        if (depth === "1") {
          return { content: [{ type: "text", text: JSON.stringify({ answer: top.snippet, sources: hits.slice(0,5).map((h:any)=>({uri:h.uri,title:h.title,snippet:h.snippet,score:h.score})), deeper: [], governance_source: "knowledge_base" }) }] };
        }
        const getResult = await client.callTool({ name: "oddkit", arguments: { action: "get", input: top.uri, knowledge_base_url: CANON_KB_URL } });
        const getParsed = JSON.parse(getResult.content[0].text);
        const fullContent = getParsed?.result?.content || top.snippet;
        return { content: [{ type: "text", text: JSON.stringify({ answer: fullContent, sources: [{uri:top.uri,title:top.title,snippet:fullContent,score:top.score}], deeper: [], governance_source: "knowledge_base" }) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: JSON.stringify({ answer: null, sources: [], deeper: [], governance_source: "minimal", error: err?.message }) }] };
      } finally { if (client) try { await client.close(); } catch {} }
    }
  );
  return server;
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/mcp')) { const server = createServer(); const handler = createMcpHandler(server); return handler(request, env, ctx); }
    if (url.pathname.startsWith('/image/')) { return handleImageProxy(request, env, ctx); }
    if (url.pathname.startsWith('/audio/')) { return handleAudioProxy(request, env, ctx); }
    return new Response('transcode-mcp LIVE v5 - Proxy handlers active (audio passthrough mode)', { status: 200 });
  },
};

// Real Image Proxy (Cache API + ready for Images binding)
async function handleImageProxy(request: Request, env: any, ctx: ExecutionContext) {
  const sourceUrl = decodeURIComponent(new URL(request.url).pathname.replace('/image/', ''));
  const cacheKey = new Request(request.url, request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;
  try {
    const response = await fetch(sourceUrl, { headers: { 'Accept': 'image/avif,image/webp,image/*' } });
    if (!response.ok) return new Response('Source not found', { status: 404 });
    const newResponse = new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    ctx.waitUntil(caches.default.put(cacheKey, newResponse.clone()));
    return newResponse;
  } catch (e) { return new Response('Image error', { status: 500 }); }
}

// Real Audio Proxy (passthrough + cache for v1; ffmpeg/Container step ready)
async function handleAudioProxy(request: Request, env: any, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const parts = url.pathname.replace('/audio/', '').split('/');
  if (parts.length < 3) return new Response('Bad path', { status: 400 });
  const sourceUrl = decodeURIComponent(parts.slice(2).join('/'));

  const cacheKey = new Request(request.url, request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return new Response('Source not found', { status: 404 });

    // TODO (Container boundary): Here we would run ffmpeg using the preset + encodeRate
    // For v1 we pass through the original audio so the proxy is functional end-to-end.
    const newResponse = new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Transcode-Status': 'passthrough-v1'
      }
    });
    ctx.waitUntil(caches.default.put(cacheKey, newResponse.clone()));
    return newResponse;
  } catch (e: any) { return new Response('Audio error: ' + e.message, { status: 500 }); }
}
