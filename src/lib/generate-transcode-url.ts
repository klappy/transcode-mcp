// Canon URL constructor. Pure function: inputs -> deterministic proxy path.
// URL vocabulary defined in canon/planning/2026-05-26-url-vocabulary-and-presets.md.

export type Quality = "low" | "medium" | "high";

export interface ImageOptions {
  w?: number;
  h?: number;
  s?: number;
  q?: Quality;
  f?: "auto" | "avif" | "webp" | "jpeg";
}

export interface AudioOptions {
  preset?: string;
  q?: Quality;
}

export type GenerateTranscodeUrlInput =
  | { mediaType: "image"; sourceUrl: string; options?: ImageOptions }
  | { mediaType: "audio"; sourceUrl: string; options?: AudioOptions };

export function generateTranscodeUrl(input: GenerateTranscodeUrlInput): string {
  const { mediaType, sourceUrl } = input;
  const options = input.options ?? {};

  const optionSegment = Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join(",");

  const encodedSourceUrl = encodeURIComponent(sourceUrl);

  return optionSegment
    ? `/${mediaType}/${optionSegment}/${encodedSourceUrl}`
    : `/${mediaType}/${encodedSourceUrl}`;
}

// Resolve a shortest-side value (s) to a target WIDTH using measured source
// dimensions. The shortest side is the stable "resolution class" across phone
// rotation; this maps it to the width the encoder pipeline wants. Only the
// worker calls this, because only it has real source dims at request time:
//   portrait/square (sourceW <= sourceH): shortest side IS the width -> s
//   landscape       (sourceW >  sourceH): shortest side is the height -> round(s * sourceW / sourceH)
export function shortestSideToWidth(
  s: number,
  sourceW: number,
  sourceH: number,
): number {
  if (sourceW > sourceH) return Math.round((s * sourceW) / sourceH);
  return s;
}
