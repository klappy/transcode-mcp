// Parses the canon URL path: /{media_type}/{options}/{source_url}
// Spec: canon/planning/2026-05-26-url-vocabulary-and-presets.md
//
// The source_url starts with http:// or https:// and is NOT URL-encoded.
// The options segment is comma-separated key=value pairs before the source URL.
// If no options are present, the path is /{media_type}/{source_url}.

export type MediaType = "image" | "audio";

export interface ParsedImageRequest {
  mediaType: "image";
  options: {
    w?: number;
    h?: number;
    s?: number;
    q?: "low" | "medium" | "high";
    f?: "auto" | "avif" | "webp" | "jpeg";
  };
  sourceUrl: string;
}

export interface ParsedAudioRequest {
  mediaType: "audio";
  options: {
    preset?: "voice" | "music";
    q?: "low" | "medium" | "high";
  };
  sourceUrl: string;
}

export type ParsedRequest = ParsedImageRequest | ParsedAudioRequest;

export class ProxyPathError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ProxyPathError";
  }
}

export function parseProxyPath(
  pathname: string,
  search: string = "",
): ParsedRequest {
  // Strip leading slash
  const trimmed = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  // First segment is the media type
  const firstSlash = trimmed.indexOf("/");
  if (firstSlash === -1) {
    throw new ProxyPathError("Missing media_type segment");
  }

  const mediaType = trimmed.slice(0, firstSlash);
  const rest = trimmed.slice(firstSlash + 1);

  if (mediaType !== "image" && mediaType !== "audio") {
    throw new ProxyPathError(`Unknown media_type: ${mediaType}`, 404);
  }

  // Find where the source URL starts (http:// or https://)
  const httpIdx = rest.indexOf("http://");
  const httpsIdx = rest.indexOf("https://");
  const urlStart = Math.min(
    httpIdx === -1 ? Infinity : httpIdx,
    httpsIdx === -1 ? Infinity : httpsIdx,
  );

  if (urlStart === Infinity) {
    throw new ProxyPathError("No source URL found in path");
  }

  // Reattach search/query string to the source URL. The browser splits the
  // request URL into pathname+search, but the source URL may legitimately
  // contain a query string (e.g. ?w=2000 for Unsplash, signed URLs, etc.).
  // The search portion of the request URL is appended to whatever URL we
  // extract from the path.
  const sourceUrl = rest.slice(urlStart) + search;
  const optionsSegment = rest.slice(0, urlStart).replace(/\/$/, "");

  const options = optionsSegment ? parseOptions(optionsSegment) : {};

  if (mediaType === "image") {
    return {
      mediaType: "image",
      options: validateImageOptions(options),
      sourceUrl,
    };
  } else {
    return {
      mediaType: "audio",
      options: validateAudioOptions(options),
      sourceUrl,
    };
  }
}

function parseOptions(segment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of segment.split(",")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const value = decodeURIComponent(pair.slice(eq + 1).trim());
    if (key) out[key] = value;
  }
  return out;
}

function validateImageOptions(raw: Record<string, string>): ParsedImageRequest["options"] {
  const out: ParsedImageRequest["options"] = {};
  if (raw.w !== undefined) {
    const n = parseInt(raw.w, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 8192) {
      throw new ProxyPathError(`Invalid w=${raw.w}`);
    }
    out.w = n;
  }
  if (raw.h !== undefined) {
    const n = parseInt(raw.h, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 8192) {
      throw new ProxyPathError(`Invalid h=${raw.h}`);
    }
    out.h = n;
  }
  if (raw.s !== undefined) {
    const n = parseInt(raw.s, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 8192) {
      throw new ProxyPathError(`Invalid s=${raw.s}`);
    }
    out.s = n;
  }
  if (raw.q !== undefined) {
    if (raw.q !== "low" && raw.q !== "medium" && raw.q !== "high") {
      throw new ProxyPathError(`Invalid q=${raw.q}`);
    }
    out.q = raw.q;
  }
  if (raw.f !== undefined) {
    if (raw.f !== "auto" && raw.f !== "avif" && raw.f !== "webp" && raw.f !== "jpeg") {
      throw new ProxyPathError(`Invalid f=${raw.f}`);
    }
    out.f = raw.f;
  }
  return out;
}

function validateAudioOptions(raw: Record<string, string>): ParsedAudioRequest["options"] {
  const out: ParsedAudioRequest["options"] = {};
  if (raw.preset !== undefined) {
    if (raw.preset !== "voice" && raw.preset !== "music") {
      throw new ProxyPathError(`Invalid preset=${raw.preset}`);
    }
    out.preset = raw.preset;
  }
  if (raw.q !== undefined) {
    if (raw.q !== "low" && raw.q !== "medium" && raw.q !== "high") {
      throw new ProxyPathError(`Invalid q=${raw.q}`);
    }
    out.q = raw.q;
  }
  return out;
}
