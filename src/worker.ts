// src/worker.ts
// Proxy-first Worker with official Cloudflare Agents SDK (createMcpHandler)
// Lazy transcoding: URL generation only; actual work on-demand

import { createMcpHandler } from '@cloudflare/agents/mcp';

// Tool schema for MCP (proxy URL generation only)
const generateTranscodeUrlTool = {
  name: 'generate_transcode_url',
  description: 'Generate an optimized proxy URL for media. No transcoding performed here — lazy on-demand.',
  inputSchema: {
    type: 'object',
    properties: {
      media_type: { type: 'string', enum: ['image', 'audio'] },
      preset: { type: 'string' }, // low/medium/high or voice+low etc.
      quality: { type: 'number' },
      source_url: { type: 'string' }
    },
    required: ['media_type', 'preset', 'source_url']
  }
};

// Minimal handler — returns proxy URL immediately
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // MCP endpoint for agent-native URL generation
    if (url.pathname.startsWith('/mcp')) {
      return createMcpHandler({
        tools: [generateTranscodeUrlTool],
        // In real impl: implement tool to call half-class math + preset logic
      })(request);
    }

    // Proxy layer (lazy)
    if (url.pathname.startsWith('/image/')) {
      // Cloudflare Images binding or Cache API — no container
      return handleImageProxy(request, env);
    }

    if (url.pathname.startsWith('/audio/')) {
      // Delegate to container only on miss (lazy)
      return handleAudioProxy(request, env);
    }

    return new Response('transcode-mcp proxy — see /mcp for agent tools', { status: 200 });
  }
};

// Placeholder implementations (to be expanded)
async function handleImageProxy(request: Request, env: Env) {
  // TODO: env.IMAGES.get(...) or Cache API
  return new Response('Image proxy placeholder', { status: 200 });
}

async function handleAudioProxy(request: Request, env: Env) {
  // TODO: forward to container binding with preset name only
  return new Response('Audio proxy placeholder (lazy container call)', { status: 200 });
}