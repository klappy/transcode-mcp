import { describe, expect, test } from 'bun:test';
import { generateTranscodeUrl } from './generate-transcode-url';

describe('generateTranscodeUrl', () => {
  test('produces canon format for image', () => {
    const url = generateTranscodeUrl({
      mediaType: 'image',
      sourceUrl: 'https://example.com/img.jpg',
      options: { w: 800, q: 'low', f: 'auto' },
    });
    expect(url).toBe('/image/w=800,q=low,f=auto/https://example.com/img.jpg');
  });

  test('produces canon format for audio', () => {
    const url = generateTranscodeUrl({
      mediaType: 'audio',
      sourceUrl: 'https://example.com/audio.mp3',
      options: { preset: 'voice+medium', q: 'high' },
    });
    expect(url).toBe('/audio/preset=voice%2Bmedium,q=high/https://example.com/audio.mp3');
  });
});
