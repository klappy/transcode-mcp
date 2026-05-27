// Canon URL constructor. Pure function: inputs -> deterministic proxy path.
// URL vocabulary defined in canon/planning/2026-05-26-url-vocabulary-and-presets.md.

export type Quality = "low" | "medium" | "high";

export interface ImageOptions {
  w?: number;
  h?: number;
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

  return `/${mediaType}/${optionSegment}/${encodeURIComponent(sourceUrl)}`;
}
