// src/worker.ts
// Proxy-first + lazy transcoding MCP server using current Cloudflare Agents SDK
// Deploy marker: 2026-05-27 v3 - forcing fresh production deploy

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
  'voice+low':    { rate: 8000,  channels: 1, bitrate: '8k' },
  'voice+medium': { rate: 16000, channels: 1, bitrate: '16k' },
  'voice+high':   { rate: 24000, channels: 1, bitrate: '32k' },
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

  // === Existing tool ===
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
          text: JSON.stringify({
            proxy_url: proxyUrl,
            preset,
            target_sample_rate: targetRate,
            encode_sample_rate: encodeRate,
            note: "URL generated via MCP. Actual transcoding is lazy on first request."
          })
        }]
      };
    }
  );

  // === docs tool - thin proxy to oddkit (following PTXprint-MCP pattern) ===
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

        // Call oddkit search
        const searchResult = await client.callTool({
          name: "oddkit",
          arguments: {
            action: "search",
            input: query,
            knowledge_base_url: CANON_KB_URL,
            result_grouping: "overlay_first",
          },
        });

        const parsed = JSON.parse(searchResult.content[0].text);
        const hits = parsed?.result?.hits || [];

        if (hits.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                answer: null,
                sources: [],
                deeper: [],
                governance_source: "knowledge_base"
              })
            }]
          };
        }

        const top = hits[0];

        // depth 1 = just return snippet
        if (depth === "1") {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                answer: top.snippet,
                sources: hits.slice(0, 5).map((h: any) => ({
                  uri: h.uri,
                  title: h.title,
                  snippet: h.snippet,
                  score: h.score
                })),
                deeper: [],
                governance_source: "knowledge_base"
              })
            }]
          };
        }

        // depth >= 2: get full top document
        const getResult = await client.callTool({
          name: "oddkit",
          arguments: {
            action: "get",
            input: top.uri,
            knowledge_base_url: CANON_KB_URL,
          },
        });

        const getParsed = JSON.parse(getResult.content[0].text);
        const fullContent = getParsed?.result?.content || top.snippet;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              answer: fullContent,
              sources: [{
                uri: top.uri,
                title: top.title,
                snippet: fullContent,
                score: top.score
              }],
              deeper: [],
              governance_source: "knowledge_base"
            })
          }]
        };

      } catch (err: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              answer: null,
              sources: [],
              deeper: [],
              governance_source: "minimal",
              error: err?.message || "oddkit unreachable"
            })
          }]
        };
      } finally {
        if (client) {
          try { await client.close(); } catch {}
        }
      }
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/mcp')) {
      const server = createServer();
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    if (url.pathname.startsWith('/image/')) {
      return handleImageProxy(request, env);
    }

    if (url.pathname.startsWith('/audio/')) {
      return handleAudioProxy(request, env);
    }

    return new Response('transcode-mcp LIVE v3 - MCP at /mcp (forced deploy)', { status: 200 });
  },
};

// Placeholder proxy routes (to be implemented)
async function handleImageProxy(request: Request, env: any) {
  return new Response("[Image Proxy Placeholder] - Will use Cloudflare Images + edge cache here", { status: 200 });
}

async function handleAudioProxy(request: Request, env: any) {
  return new Response("[Audio Proxy Placeholder] - Will do lazy ffmpeg transcoding + R2 write here", { status: 200 });
}