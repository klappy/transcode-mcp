/**
 * smoke-test.ts
 *
 * Validates the deployed worker end-to-end against canon worked examples.
 * Each case has:
 *   - a source URL
 *   - a target width
 *   - expected encode dimension (from canon)
 *   - expected binding (target / source / equal)
 *   - file-size envelope (min..max bytes)
 *
 * If WORKER_BASE_URL is unset, just prints the generated URLs and skips checks.
 *
 * Usage:
 *   bun run smoke-test.ts
 *   WORKER_BASE_URL=https://transcode.klappy.dev bun run smoke-test.ts
 */

import { encodeDimension } from "./src/lib/encode-dimension";

const WORKER_BASE_URL =
  process.env.WORKER_BASE_URL || process.env.WORKER_PREVIEW_URL;

interface SmokeCase {
  name: string;
  sourceUrl: string;
  sourceW: number;
  sourceH: number;
  targetW: number;
  quality: "low" | "medium" | "high";
  expectedBinding: "target" | "source" | "equal";
  // Size envelope is a sanity check, not a precise contract.
  // These are floor/ceiling for the file to flag obvious regressions.
  minBytes: number;
  maxBytes: number;
}

const CASES: SmokeCase[] = [
  {
    name: "Phone photo → 800",
    sourceUrl: "https://picsum.photos/id/1015/4000/3000",
    sourceW: 4000,
    sourceH: 3000,
    targetW: 800,
    quality: "medium",
    expectedBinding: "target",
    minBytes: 50_000,
    maxBytes: 400_000,
  },
  {
    name: "Phone photo → 320 (q=low)",
    sourceUrl: "https://picsum.photos/id/1015/4000/3000",
    sourceW: 4000,
    sourceH: 3000,
    targetW: 320,
    quality: "low",
    expectedBinding: "target",
    minBytes: 5_000,
    maxBytes: 60_000,
  },
  {
    name: "Source near target",
    sourceUrl: "https://picsum.photos/id/1043/1920/1080",
    sourceW: 1920,
    sourceH: 1080,
    targetW: 1080,
    quality: "medium",
    expectedBinding: "target",
    minBytes: 50_000,
    maxBytes: 500_000,
  },
  {
    name: "Small source → larger target (source × 1.5 binds)",
    sourceUrl: "https://picsum.photos/id/1062/400/300",
    sourceW: 400,
    sourceH: 300,
    targetW: 1080,
    quality: "medium",
    expectedBinding: "source",
    minBytes: 3_000,
    maxBytes: 200_000,
  },
];

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  details: string[];
}

async function runCase(c: SmokeCase): Promise<CheckResult> {
  const details: string[] = [];
  const expected = encodeDimension({
    sourceW: c.sourceW,
    sourceH: c.sourceH,
    targetW: c.targetW,
  });

  const proxyPath = `/image/w=${c.targetW},q=${c.quality}/${c.sourceUrl}`;
  const fullUrl = `${WORKER_BASE_URL!.replace(/\/$/, "")}${proxyPath}`;

  details.push(`URL: ${fullUrl}`);
  details.push(
    `Canon: encode=${expected.encodeW}×${expected.encodeH}, binding=${expected.binding}`,
  );

  let res: Response;
  try {
    res = await fetch(fullUrl);
  } catch (err: any) {
    return {
      name: c.name,
      status: "fail",
      details: [...details, `fetch failed: ${err.message}`],
    };
  }

  if (res.status !== 200) {
    const body = await res.text();
    return {
      name: c.name,
      status: "fail",
      details: [
        ...details,
        `status=${res.status} expected 200`,
        `body: ${body.slice(0, 200)}`,
      ],
    };
  }

  const h = (k: string) => res.headers.get(k);
  const encodeW = parseInt(h("x-transcode-encode-w") || "0", 10);
  const encodeH = parseInt(h("x-transcode-encode-h") || "0", 10);
  const binding = h("x-transcode-binding") || "";
  const quality = h("x-transcode-quality") || "";
  const encodeMarker = h("x-transcode-encode") || "";

  const body = await res.arrayBuffer();
  const size = body.byteLength;

  details.push(
    `Actual: encode=${encodeW}×${encodeH}, binding=${binding}, quality=${quality}, size=${size}B`,
  );

  // If the binding is missing (local dev or unconfigured), warn but don't fail
  if (encodeMarker === "no-binding") {
    details.push(
      `⚠  X-Transcode-Encode: no-binding — env.IMAGES not configured on this deployment`,
    );
    return { name: c.name, status: "warn", details };
  }
  if (encodeMarker === "passthrough") {
    details.push(`⚠  X-Transcode-Encode: passthrough — no options applied`);
    return { name: c.name, status: "warn", details };
  }

  const failures: string[] = [];
  if (encodeW !== expected.encodeW) {
    failures.push(
      `encode_w mismatch: got ${encodeW}, canon says ${expected.encodeW}`,
    );
  }
  if (encodeH !== expected.encodeH) {
    failures.push(
      `encode_h mismatch: got ${encodeH}, canon says ${expected.encodeH}`,
    );
  }
  if (binding !== c.expectedBinding) {
    failures.push(
      `binding mismatch: got '${binding}', expected '${c.expectedBinding}'`,
    );
  }
  if (size < c.minBytes) {
    failures.push(
      `file too small: ${size}B < ${c.minBytes}B floor (possible truncation)`,
    );
  }
  if (size > c.maxBytes) {
    failures.push(
      `file too large: ${size}B > ${c.maxBytes}B ceiling (possible regression)`,
    );
  }

  if (failures.length > 0) {
    return {
      name: c.name,
      status: "fail",
      details: [...details, ...failures.map((f) => `✗ ${f}`)],
    };
  }

  return { name: c.name, status: "pass", details };
}

async function main() {
  console.log("=== transcode-mcp smoke test ===\n");

  if (!WORKER_BASE_URL) {
    console.log("No WORKER_BASE_URL set. Showing expected canon arithmetic for each case:\n");
    for (const c of CASES) {
      const e = encodeDimension({
        sourceW: c.sourceW,
        sourceH: c.sourceH,
        targetW: c.targetW,
      });
      console.log(
        `  ${c.name}: source ${c.sourceW}×${c.sourceH}, target ${c.targetW} → encode ${e.encodeW}×${e.encodeH} (${e.binding})`,
      );
    }
    console.log("\nSet WORKER_BASE_URL to run live validation.");
    return;
  }

  console.log(`Target: ${WORKER_BASE_URL}\n`);

  const results: CheckResult[] = [];
  for (const c of CASES) {
    process.stdout.write(`[${c.name}] running... `);
    const result = await runCase(c);
    const icon = result.status === "pass" ? "✓" : result.status === "warn" ? "⚠" : "✗";
    console.log(icon);
    for (const line of result.details) {
      console.log(`    ${line}`);
    }
    console.log("");
    results.push(result);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;

  console.log("=== Summary ===");
  console.log(`  passed: ${passed}/${results.length}`);
  console.log(`  warned: ${warned}`);
  console.log(`  failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
