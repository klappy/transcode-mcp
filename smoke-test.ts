/**
 * smoke-test.ts
 *
 * Generates canon URLs and optionally performs real HTTP checks against a live Worker.
 *
 * Usage:
 *   bun run smoke-test.ts                    # Just prints generated URLs
 *   WORKER_BASE_URL=https://xxx.workers.dev bun run smoke-test.ts
 *
 * In CI: Set WORKER_PREVIEW_URL secret and the workflow will run this with the env var.
 */

import { generateTranscodeUrl } from './src/lib/generate-transcode-url';

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || process.env.WORKER_PREVIEW_URL;

async function checkEndpoint(fullUrl: string, label: string) {
  if (!WORKER_BASE_URL) {
    console.log(`[${label}] Skipping live check (no WORKER_BASE_URL set)`);
    return { status: 'skipped' };
  }

  const targetUrl = `${WORKER_BASE_URL.replace(/\/$/, '')}${fullUrl}`;

  try {
    const res = await fetch(targetUrl, { method: 'GET' });
    const bodyPreview = res.status === 200 
      ? (await res.text()).slice(0, 200) 
      : await res.text();

    console.log(`[${label}] ${res.status} ${res.statusText}`);
    if (res.status === 200) {
      console.log(`  Content-Type: ${res.headers.get('content-type')}`);
      console.log(`  Body preview: ${bodyPreview.substring(0, 150)}...`);
    } else {
      console.log(`  Body: ${bodyPreview}`);
    }

    return { status: res.status, ok: res.ok };
  } catch (err: any) {
    console.error(`[${label}] Fetch failed:`, err.message);
    return { status: 'error', ok: false };
  }
}

async function runSmokeTest() {
  console.log('=== Transcode MCP Smoke Test ===\n');

  const imageCanonPath = generateTranscodeUrl({
    mediaType: 'image',
    sourceUrl: 'https://example.com/photo.jpg',
    options: { w: 800, q: 'low', f: 'auto' },
  });
  console.log('Generated image path:', imageCanonPath);
  await checkEndpoint(imageCanonPath, 'IMAGE');

  console.log('');

  const audioCanonPath = generateTranscodeUrl({
    mediaType: 'audio',
    sourceUrl: 'https://example.com/podcast.mp3',
    options: { preset: 'voice+medium', q: 'high' },
  });
  console.log('Generated audio path:', audioCanonPath);
  await checkEndpoint(audioCanonPath, 'AUDIO');

  console.log('\n=== Evidence Summary ===');
  console.log('Canon URL format: /${media_type}/${options}/${source_url}');
  console.log('Options use comma-separated key=value with no spaces.');
  console.log('Run with WORKER_BASE_URL set to capture real 200 responses.');
}

runSmokeTest().catch(console.error);
