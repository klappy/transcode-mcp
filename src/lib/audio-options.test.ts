import { describe, expect, test } from "bun:test";
import {
  AUDIO_DEFAULTS,
  CODEC_DELIVERY,
  hasAudioOptions,
  isTranscodable,
  resolveAudioOptions,
} from "./audio-options";

describe("resolveAudioOptions — defaults", () => {
  test("empty options resolve to voice/medium/opus", () => {
    expect(resolveAudioOptions({})).toEqual({
      preset: "voice",
      q: "medium",
      codec: "opus",
    });
  });

  test("defaults constant matches the canon defaults", () => {
    expect(AUDIO_DEFAULTS).toEqual({ preset: "voice", q: "medium", codec: "opus" });
  });

  test("explicit values override each axis independently", () => {
    expect(resolveAudioOptions({ preset: "music" })).toEqual({
      preset: "music",
      q: "medium",
      codec: "opus",
    });
    expect(resolveAudioOptions({ q: "high" })).toEqual({
      preset: "voice",
      q: "high",
      codec: "opus",
    });
    expect(resolveAudioOptions({ f: "aac" })).toEqual({
      preset: "voice",
      q: "medium",
      codec: "aac",
    });
  });
});

describe("hasAudioOptions", () => {
  test("false when no audio option present (=> passthrough)", () => {
    expect(hasAudioOptions({})).toBe(false);
  });
  test("true when any single option present", () => {
    expect(hasAudioOptions({ preset: "voice" })).toBe(true);
    expect(hasAudioOptions({ q: "low" })).toBe(true);
    expect(hasAudioOptions({ f: "opus" })).toBe(true);
  });
});

describe("isTranscodable — slice 1 wires voice+opus only", () => {
  test("voice + opus is transcodable", () => {
    expect(isTranscodable({ preset: "voice", q: "medium", codec: "opus" })).toBe(true);
  });
  test("music + opus passes through in slice 1", () => {
    expect(isTranscodable({ preset: "music", q: "medium", codec: "opus" })).toBe(false);
  });
  test("aac and mp3 pass through in slice 1", () => {
    expect(isTranscodable({ preset: "voice", q: "medium", codec: "aac" })).toBe(false);
    expect(isTranscodable({ preset: "voice", q: "medium", codec: "mp3" })).toBe(false);
  });
});

describe("CODEC_DELIVERY", () => {
  test("opus delivers as audio/ogg .opus", () => {
    expect(CODEC_DELIVERY.opus).toEqual({ contentType: "audio/ogg", ext: "opus" });
  });
  test("aac and mp3 carry their own container/type", () => {
    expect(CODEC_DELIVERY.aac.contentType).toBe("audio/mp4");
    expect(CODEC_DELIVERY.mp3.contentType).toBe("audio/mpeg");
  });
});
