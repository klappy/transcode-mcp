import { describe, expect, test } from 'bun:test';
import { generateTranscodeUrl, shortestSideToWidth } from './generate-transcode-url';

describe('generateTranscodeUrl', () => {
  test('produces canon format for image', () => {
    const url = generateTranscodeUrl({
      mediaType: 'image',
      sourceUrl: 'https://example.com/img.jpg',
      options: { w: 800, q: 'low', f: 'auto' },
    });
    expect(url).toBe('/image/w=800,q=low,f=auto/https%3A%2F%2Fexample.com%2Fimg.jpg');
  });

  test('produces canon format for audio', () => {
    const url = generateTranscodeUrl({
      mediaType: 'audio',
      sourceUrl: 'https://example.com/audio.mp3',
      options: { preset: 'voice+medium', q: 'high' },
    });
    expect(url).toBe('/audio/preset=voice%2Bmedium,q=high/https%3A%2F%2Fexample.com%2Faudio.mp3');
  });

  test('emits s= (shortest side) for images', () => {
    const url = generateTranscodeUrl({
      mediaType: 'image',
      sourceUrl: 'https://example.com/img.jpg',
      options: { s: 720, q: 'low' },
    });
    expect(url).toBe('/image/s=720,q=low/https%3A%2F%2Fexample.com%2Fimg.jpg');
  });
});

describe('shortestSideToWidth', () => {
  test('portrait: shortest side is the width', () => {
    // 820x1024 portrait, want shortest side 720 -> width stays 720
    expect(shortestSideToWidth(720, 820, 1024)).toBe(720);
  });

  test('square: shortest side is the width', () => {
    expect(shortestSideToWidth(512, 1000, 1000)).toBe(512);
  });

  test('landscape: width scales up from the shortest side (height)', () => {
    // 3000x2000 landscape, shortest side (height) 720 -> width = 720 * 3000/2000 = 1080
    expect(shortestSideToWidth(720, 3000, 2000)).toBe(1080);
  });

  test('landscape rounds to nearest pixel', () => {
    // 4032x3024 (4:3) shortest side 720 -> 720 * 4032/3024 = 960
    expect(shortestSideToWidth(720, 4032, 3024)).toBe(960);
  });

  test('rotation invariance: same s gives same shortest side either orientation', () => {
    // The encode width differs by orientation, but the SHORTEST side of the
    // result is always ~s. Portrait 2000x3000: width 720, shortest=720.
    // Landscape 3000x2000: width 1080, shortest side = height = 1080*2000/3000 = 720.
    const portraitW = shortestSideToWidth(720, 2000, 3000); // 720
    const landscapeW = shortestSideToWidth(720, 3000, 2000); // 1080
    const portraitShortest = Math.min(portraitW, Math.round(portraitW * 3000 / 2000));
    const landscapeShortest = Math.min(landscapeW, Math.round(landscapeW * 2000 / 3000));
    expect(portraitShortest).toBe(720);
    expect(landscapeShortest).toBe(720);
  });
});
