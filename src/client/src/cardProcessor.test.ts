import { describe, expect, it, vi } from 'vitest';
import {
  getElementDimensions,
  calculateDrawDimensions,
  getDefaultPoly,
  alignPolygons,
  applyDampening,
  applyTemporalSmoothing,
  processCardImage
} from './cardProcessor';

vi.mock('@techstark/opencv-js', () => {
  class MockMat {
    delete = vi.fn();
    rows = 4;
    data32S = [0, 0, 800, 0, 800, 600, 0, 600];
    data32F = [0, 0, 800, 0, 800, 600, 0, 600];
  }
  class MockMatVector {
    delete = vi.fn();
    size = () => 1;
    get = () => new MockMat();
  }
  return {
    default: {
      Mat: MockMat,
      MatVector: MockMatVector,
      imread: vi.fn().mockReturnValue(new MockMat()),
      cvtColor: vi.fn(),
      COLOR_RGBA2GRAY: 'COLOR_RGBA2GRAY',
      medianBlur: vi.fn(),
      adaptiveThreshold: vi.fn(),
      threshold: vi.fn(),
      THRESH_BINARY: 'THRESH_BINARY',
      THRESH_OTSU: 'THRESH_OTSU',
      findContours: vi.fn(),
      RETR_EXTERNAL: 'RETR_EXTERNAL',
      CHAIN_APPROX_SIMPLE: 'CHAIN_APPROX_SIMPLE',
      contourArea: vi.fn().mockReturnValue(500000),
      boundingRect: vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
      drawContours: vi.fn(),
      imshow: vi.fn(),
      approxPolyDP: vi.fn(),
      arcLength: vi.fn().mockReturnValue(10),
      getPerspectiveTransform: vi.fn().mockReturnValue(new MockMat()),
      warpPerspective: vi.fn(),
      matFromArray: vi.fn().mockReturnValue(new MockMat()),
      Size: class MockSize { constructor(public width?: number, public height?: number) {} },
      Point: class MockPoint { constructor(public x?: number, public y?: number) {} },
      GaussianBlur: vi.fn(),
      Canny: vi.fn(),
      BORDER_DEFAULT: 'BORDER_DEFAULT',
      RETR_LIST: 'RETR_LIST',
      Scalar: class MockScalar { value = 0; }
    }
  };
});


describe('cardProcessor utility functions', () => {
  describe('getElementDimensions', () => {
    it('handles HTMLVideoElement dimensions', () => {
      const mockVideo = { videoWidth: 640, videoHeight: 480 } as any;
      expect(getElementDimensions(mockVideo)).toEqual({ width: 640, height: 480 });
    });

    it('handles HTMLImageElement dimensions', () => {
      const mockImg = { naturalWidth: 800, naturalHeight: 600 } as any;
      expect(getElementDimensions(mockImg)).toEqual({ width: 800, height: 600 });
    });

    it('handles HTMLCanvasElement or other fallback dimensions', () => {
      const mockCanvas = { width: 1000, height: 500 } as any;
      expect(getElementDimensions(mockCanvas)).toEqual({ width: 1000, height: 500 });
    });
  });

  describe('calculateDrawDimensions', () => {
    it('calculates correct proportions when video is wider than canvas', () => {
      const mockVideo = { videoWidth: 1600, videoHeight: 900 } as any;
      const mockCanvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600 } as any;
      const result = calculateDrawDimensions(mockVideo, mockCanvas);
      expect(result.drawW).toBeGreaterThan(0);
      expect(result.drawH).toBeGreaterThan(0);
    });
  });

  describe('getDefaultPoly', () => {
    it('creates default polygon coordinates centered in element aspect ratio', () => {
      const mockVideo = { videoWidth: 1000, videoHeight: 600 } as any;
      const poly = getDefaultPoly(mockVideo);
      expect(poly).toHaveLength(4);
      expect(poly[0]).toEqual({ x: 50, y: 30 });
      expect(poly[2]).toEqual({ x: 950, y: 570 });
    });
  });

  describe('alignPolygons', () => {
    it('aligns polygon corners to match closest points in previous polygon', () => {
      const bestPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 }
      ];
      const previousPoly = [
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
        { x: 10, y: 10 }
      ];
      const aligned = alignPolygons(bestPoly, previousPoly);
      expect(aligned[0]).toEqual({ x: 20, y: 10 });
      expect(aligned[1]).toEqual({ x: 20, y: 20 });
    });
  });

  describe('applyDampening', () => {
    it('locks changes when differences are small', () => {
      const bestPoly = [
        { x: 11, y: 11 },
        { x: 21, y: 11 },
        { x: 21, y: 21 },
        { x: 11, y: 21 }
      ];
      const previousPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 }
      ];
      const debugLines: string[] = [];
      const dampened = applyDampening(bestPoly, previousPoly, debugLines);
      expect(debugLines).toContain('Filter: Locked');
      expect(dampened[0].x).toBeCloseTo(10.4);
    });

    it('heavily dampens when change is large', () => {
      const bestPoly = [
        { x: 200, y: 200 },
        { x: 210, y: 200 },
        { x: 210, y: 210 },
        { x: 200, y: 210 }
      ];
      const previousPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 }
      ];
      const debugLines: string[] = [];
      const dampened = applyDampening(bestPoly, previousPoly, debugLines);
      expect(debugLines).toContain('Filter: Heavy Dampening');
      expect(dampened[0].x).toBeCloseTo(19.5);
    });
  });

  describe('applyTemporalSmoothing', () => {
    it('returns aligned poly if previous is null/invalid', () => {
      const bestPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 }
      ];
      const result = applyTemporalSmoothing(bestPoly, null, []);
      expect(result).toHaveLength(4);
    });
  });

  describe('processCardImage', () => {
    it('successfully runs the image processing pipeline', async () => {
      const mockImg = { naturalWidth: 1000, naturalHeight: 600 } as any;
      const result = await processCardImage(mockImg);
      expect(result).toHaveProperty('blob');
      expect(result.text).toBe('Mocked OCR Text');
    });
  });
});
