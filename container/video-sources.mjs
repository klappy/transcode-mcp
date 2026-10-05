// Lazy on-demand video sources (operator ruling 2026-10-05: "There is no such
// thing as unavailable"). Pure data/logic shared by Worker and container; no I/O.
// The closed catalog (video-catalog.mjs) is consulted first and stays untouched,
// so exact rows keep their contracts, encoder revision and cache keys.

// Abuse guard (flagged default for operator review): the ONE list of source
// prefixes the proxy will fetch lazily. Anything else is 403.
export const VIDEO_SOURCE_ALLOWED_PREFIXES = Object.freeze([
  'https://s3.amazonaws.com/cbbt-er.public/',
  'https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/',
]);
export const LAZY_VIDEO_SIZES = Object.freeze(['xsmall', 'small', 'medium', 'large', 'xlarge']);

// Canonical https URL under an allowed prefix, no credentials/query/fragment.
// href equality rejects dot-segments, encodings and other non-canonical spellings.
export function isApprovedVideoSource(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.href !== url || parsed.search || parsed.hash || parsed.username || parsed.password) return false;
  return VIDEO_SOURCE_ALLOWED_PREFIXES.some(prefix => url.startsWith(prefix) && url.length > prefix.length);
}

// profiles: {xsmall, small, medium, large, xlarge} existing recipe contracts.
// The derived contract keeps the profile's recipe settings and limits, binds the
// requested URL, and pins no sha/bytes (recorded from the fetch instead).
// Source byte ceiling: the largest qualified source ceiling already in the
// profiles (the composite rows' sourceBytes), since unknown sources are unsized.
export function createLazyVideoSelect(profiles) {
  for (const size of LAZY_VIDEO_SIZES) if (!profiles?.[size]?.encoding) throw Error('Missing lazy video profile ' + size);
  const sourceBytes = Math.max(...LAZY_VIDEO_SIZES.map(size => profiles[size].limits.sourceBytes || profiles[size].limits.bytes));
  return (url, size = 'large') => {
    if (!LAZY_VIDEO_SIZES.includes(size) || !isApprovedVideoSource(url)) return undefined;
    const profile = profiles[size];
    return {
      recipe: 'fia-video@5-' + size,
      source: { url, lazy: true, provenance: { transformation: profile.source.provenance.transformation } },
      limits: { ...structuredClone(profile.limits), sourceBytes },
      encoding: structuredClone(profile.encoding),
      recipeRevision: profile.recipeRevision,
      lazySourcePolicy: 'approved-host-v1',
    };
  };
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// No upscale (flagged default): a target taller than the source is encoded at the
// source's coded height, aligned down to the container's 16-pixel raster rule,
// with a 16:9 display aspect carried by SAR. Taller-or-equal sources keep the target.
export function noUpscaleRaster(encoding, sourceHeight) {
  if (!Number.isSafeInteger(sourceHeight) || sourceHeight < 16) throw Error('Invalid source height');
  if (sourceHeight >= encoding.height) return { width: encoding.width, height: encoding.height, sar: encoding.sar, dar: encoding.dar };
  const height = Math.floor(sourceHeight / 16) * 16;
  const width = Math.max(16, Math.round(height * 16 / 9 / 16) * 16);
  const n = height * 16, d = width * 9, g = gcd(n, d);
  return { width, height, sar: `${n / g}:${d / g}`, dar: '16:9' };
}
