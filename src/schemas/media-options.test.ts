import { describe, expect, test } from 'bun:test';
import { RawOptionsSchema, MediaOptionsSchema } from './media-options';

describe('Media Options Validation', () => {
  test('parses valid image options string', () => {
    const raw = RawOptionsSchema.parse('w=800,q=low,f=auto');
    const result = MediaOptionsSchema.parse({ media_type: 'image', ...raw });
    expect(result.media_type).toBe('image');
    expect(result.w).toBe(800);
  });

  test('parses valid audio options string', () => {
    const raw = RawOptionsSchema.parse('preset=voice+medium,q=high');
    const result = MediaOptionsSchema.parse({ media_type: 'audio', ...raw });
    expect(result.media_type).toBe('audio');
    expect(result.preset).toBe('voice+medium');
  });

  test('rejects invalid media_type', () => {
    expect(() => {
      MediaOptionsSchema.parse({ media_type: 'video', w: 100 });
    }).toThrow();
  });
});
