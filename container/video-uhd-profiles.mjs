// Additive lazy-only targets. 3K means 3072x1728 (16:9), not DCI 3072x1620.
// Rates preserve the existing xlarge bits-per-pixel budget; actual quality and
// execution budgets require Linux qualification before release.
export const UHD_VIDEO_SIZES = Object.freeze(['1080p', '3k', '4k']);
export function createUhdVideoProfiles(base) {
  return Object.fromEntries(UHD_VIDEO_SIZES.map((size, i) => {
    const [width, height] = [[1920,1080],[3072,1728],[3840,2160]][i];
    const videoBps = Math.ceil(base.encoding.videoBps * width * height / (base.encoding.width * base.encoding.height) / 1000) * 1000;
    return [size, {
      ...structuredClone(base),
      source: { provenance: { transformation: `H.264/AAC MP4, fit within ${width}x${height}, no upscale, stereo` } },
      limits: {...base.limits},
      encoding: {...base.encoding, width, height, sar:'1:1', dar:'16:9', videoBps, classBps:videoBps, maxrateBps:videoBps*2, bufferBits:videoBps*4},
      recipeRevision: 'uhd-profiles-v1',
    }];
  }));
}
