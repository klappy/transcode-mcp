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
// A source the lazy path cannot decode (no video stream, no raster size). Carries 422 so the job fails before any encode, not as a 502 after it.
export const unqualifiedSource = message => Object.assign(Error(message), { status: 422 });
const sarOf = sar => { const m = /^([1-9]\d*):([1-9]\d*)$/.exec(sar || ''); return m ? [Number(m[1]), Number(m[2])] : [1, 1]; };

// Rotation from the probed stream (display matrix side data, else the legacy
// rotate tag), normalized to 0/90/180/270. ffmpeg autorotates the input (its
// default), so filters see the upright frame.
export function streamRotation(v) {
  const side = v?.side_data_list?.find(d => d && d.rotation !== undefined)?.rotation;
  const raw = Number(side ?? v?.tags?.rotate ?? 0);
  return Number.isFinite(raw) ? ((Math.round(raw / 90) * 90) % 360 + 360) % 360 : 0;
}
// The source as ffmpeg's filters see it after autorotation: a quarter turn swaps
// the coded width and height and inverts the pixel aspect (as transpose does).
export function uprightSource(v) {
  const [sn, sd] = sarOf(v?.sample_aspect_ratio);
  return streamRotation(v) % 180 ? { width: v.height, height: v.width, sar: `${sd}:${sn}` } : { width: v?.width, height: v?.height, sar: `${sn}:${sd}` };
}

// One raster rule for every lazy source (any display aspect, any pixel aspect):
// display aspect DAR = (width * SAR) / height. The output fits inside the size
// profile's box (profile width x height) preserving DAR, never exceeds the
// source's display dimensions (no upscale), uses square pixels (SAR 1:1) and
// even dimensions (libx264 yuv420p needs only even). 16-pixel alignment is the
// catalog's raster rule for its fixed 16:9 profiles; it is kept exactly where
// that profile applies — an exact 16:9 source at least as large as the profile's
// display size gets the profile raster itself (e.g. 864x480 SAR 80:81) — and is
// not imposed on any other aspect, where it could not hold together with an
// exact square-pixel aspect.
export function fitLazyRaster(profile, source) {
  const w = source?.width, h = source?.height;
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1) throw unqualifiedSource(`Undecodable source geometry ${w}x${h}`);
  const [sn, sd] = sarOf(source.sar), [pn, pd] = sarOf(profile.sar);
  const { width: pw, height: ph } = profile;
  if (w * sn * 9 === h * sd * 16 && w * sn * pd >= pw * pn * sd && h >= ph) return { width: pw, height: ph, sar: profile.sar, dar: profile.dar };
  let W, H; // display-pixel target before even rounding
  if (w * sn <= pw * sd && h <= ph) { W = (w * sn) / sd; H = h; }
  else if (pw * h * sd <= ph * w * sn) { W = pw; H = (pw * h * sd) / (w * sn); }
  else { H = ph; W = (ph * w * sn) / (h * sd); }
  // 2x2 is the smallest yuv420p raster; a thinner source is padded up to it, not refused.
  const width = Math.max(2, Math.floor(W / 2) * 2), height = Math.max(2, Math.floor(H / 2) * 2);
  const g = gcd(width, height);
  return { width, height, sar: '1:1', dar: `${width / g}:${height / g}` };
}

// Geometry check for lazy rasters (even, SAR x width : height === DAR). The
// catalog check (video.mjs validateGeometryContract) stays 16-aligned 16:9.
export function validateLazyGeometry(e) {
  const ratio = x => { if (typeof x !== 'string' || !/^[1-9]\d*:[1-9]\d*$/.test(x)) throw Error('Explicit SAR/DAR required'); return x.split(':').map(BigInt); };
  if (!Number.isSafeInteger(e.width) || !Number.isSafeInteger(e.height) || e.width < 2 || e.height < 2 || e.width % 2 || e.height % 2) throw Error('Unaligned raster');
  const [sn, sd] = ratio(e.sar), [dn, dd] = ratio(e.dar);
  if (BigInt(e.width) * sn * dd !== BigInt(e.height) * sd * dn) throw Error('Raster SAR DAR mismatch');
}
