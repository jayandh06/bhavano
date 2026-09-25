import { transcodeOutputSize } from './ffmpeg';

describe('transcodeOutputSize', () => {
  it('fits a 1080p landscape video inside the 1280 box', () => {
    expect(transcodeOutputSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
  });

  it('fits a portrait video (already swapped for its rotation tag) inside the box', () => {
    expect(transcodeOutputSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
  });

  it('scales a small video up, because the transcode filter fits the frame to the box both ways', () => {
    expect(transcodeOutputSize(640, 360)).toEqual({ width: 1280, height: 720 });
  });

  it('always returns even dimensions', () => {
    const { width, height } = transcodeOutputSize(1000, 563);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});
