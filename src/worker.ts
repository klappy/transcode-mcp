// src/worker.ts
// Proxy-first + lazy transcoding MCP server using current Cloudflare Agents SDK
// Deploy marker: 2026-05-27 v3 - forcing fresh production deploy

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

  // === Canon docs proxy tool (per canon/patterns/docs-proxy-canon-as-tool.md) ===
  server.tool(
    "docs",
    {
      query: z.string().describe("Natural language or structured query against the canon"),
      audience: z.string().optional().describe("Optional audience filter (e.g. developer, agent, summary)"),
      depth: z.enum(["1", "2", "3"]).optional().describe("1=snippet, 2=full top doc, 3=top + next two"),
    },
    async (args) => {
      const { query, audience, depth } = args;

      // TODO: Wire this to the actual canon server.
      // Per canon, we should pin this server's own repo as knowledge_base_url.
      // Example call pattern (to be implemented):
      // const canonResponse = await fetch("https://your-canon-endpoint/query", {
      //   method: "POST",
      //   body: JSON.stringify({
      //     query,
      //     audience,
      //     depth,
      //     knowledge_base_url: "https://github.com/klappy/transcode-mcp"
      //   })
      // });

      // For now: graceful degradation + clear signal
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            answer: null,
            sources: [],
            deeper: [],
            governance_source: "minimal",
            note: "docs tool not yet wired to canon server. See canon/patterns/docs-proxy-canon-as-tool.md",
            query_received: query
          })
        }]
      };
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