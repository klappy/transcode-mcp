// src/worker.ts
// Proxy-first + lazy transcoding Worker using official Cloudflare Agents SDK

import { createMcpHandler } from '@cloudflare/agents/mcp';

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

// Real MCP tool with half-class math + preset logic
const generateTranscodeUrlTool = {
  name: 'generate_transcode_url',
  description: 'Generate optimized proxy URL. No transcoding performed here — lazy on-demand.',
  inputSchema: {
    type: 'object',
    properties: {
      media_type: { type: 'string', enum: ['image', 'audio'] },
      preset: { type: 'string' },
      quality: { type: 'number' },
      source_url: { type: 'string' }
    },
    required: ['media_type', 'preset', 'source_url']
  },
  handler: async (args: any) => {
    const { media_type, preset, source_url } = args;
    const map = PRESET_MAP[preset] || PRESET_MAP['voice+medium'];

    const targetRate = map.rate;
    const encodeRate = halfClass(targetRate); // perceptual overshoot

    const proxyUrl = `/${media_type}/${preset}/${encodeRate}/${encodeURIComponent(source_url)}`;

    return {
      proxy_url: proxyUrl,
      preset,
      target_sample_rate: targetRate,
      encode_sample_rate: encodeRate,
      note: 'URL generated via MCP. Actual transcoding is lazy on first request.'
    };
  }
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/mcp')) {
      return createMcpHandler({ tools: [generateTranscodeUrlTool] })(request);
    }

    if (url.pathname.startsWith('/image/')) {
      return handleImageProxy(request, env);
    }

    if (url.pathname.startsWith('/audio/')) {
      return handleAudioProxy(request, env);
    }

    return new Response('transcode-mcp proxy-first lazy transcoding (MCP at /mcp)', { status: 200 });
  }
};

async function handleImageProxy(request: Request, env: Env) {
  // Cloudflare Images + Cache API (stateless, no container)
  return new Response('Image proxy placeholder — integrate Cloudflare Images binding', { status: 200 });
}

async function handleAudioProxy(request: Request, env: Env) {
  // Lazy delegation to container (preset name + source only)
  return new Response('Audio proxy placeholder — forward to container on miss', { status: 200 });
}