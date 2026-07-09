import { describe, expect, it, vi } from 'vitest';
import cv from '@techstark/opencv-js';
import Tesseract from 'tesseract.js';
import {
  getElementDimensions,
  calculateDrawDimensions,
  getDefaultPoly,
  alignPolygons,
  applyDampening,
  applyTemporalSmoothing,
  fallbackTextContour,
  detectDocumentContour,
  processCardImage,
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
  const mockCv = {
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
    Size: class MockSize {
      constructor(
        public width?: number,
        public height?: number
      ) {}
    },
    Point: class MockPoint {
      constructor(
        public x?: number,
        public y?: number
      ) {}
    },
    GaussianBlur: vi.fn(),
    Canny: vi.fn(),
    BORDER_DEFAULT: 'BORDER_DEFAULT',
    RETR_LIST: 'RETR_LIST',
    Scalar: class MockScalar {
      value = 0;
    },
  };

  const promise = Promise.resolve(mockCv);
  Object.assign(promise, mockCv);

  return {
    default: promise,
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

    it('falls through to width/height when videoWidth exists but is not numeric', () => {
      // Guards the `typeof === number` check: a key present with a non-number
      // value must NOT be treated as a video element.
      const malformed = { videoWidth: null, videoHeight: null, width: 100, height: 50 } as any;
      expect(getElementDimensions(malformed)).toEqual({ width: 100, height: 50 });
    });

    it('falls through to width/height when naturalWidth exists but is not numeric', () => {
      const malformed = { naturalWidth: null, naturalHeight: null, width: 100, height: 50 } as any;
      expect(getElementDimensions(malformed)).toEqual({ width: 100, height: 50 });
    });
  });

  describe('calculateDrawDimensions', () => {
    it('letterboxes horizontally when video is wider than canvas', () => {
      const mockVideo = { videoWidth: 1600, videoHeight: 900 } as any;
      // width/height start mismatched so the canvas-resize guard (lines 23-24) must fire
      const mockCanvas = { clientWidth: 800, clientHeight: 600, width: 0, height: 0 } as any;
      const result = calculateDrawDimensions(mockVideo, mockCanvas);
      // guard resized the canvas to its client box
      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(600);
      // videoRatio 1.777 > canvasRatio 1.333 -> scale to height, overflow width
      expect(result.drawW).toBeCloseTo(1066.6667, 3);
      expect(result.drawH).toBe(600);
      expect(result.drawX).toBeCloseTo(-133.3333, 3);
      expect(result.drawY).toBe(0);
    });

    it('letterboxes vertically when video is narrower than canvas', () => {
      const mockVideo = { videoWidth: 600, videoHeight: 800 } as any;
      const mockCanvas = { clientWidth: 800, clientHeight: 600, width: 0, height: 0 } as any;
      const result = calculateDrawDimensions(mockVideo, mockCanvas);
      // videoRatio 0.75 <= canvasRatio 1.333 -> scale to width, overflow height
      expect(result.drawW).toBe(800);
      expect(result.drawH).toBeCloseTo(1066.6667, 3);
      expect(result.drawX).toBe(0);
      expect(result.drawY).toBeCloseTo(-233.3333, 3);
    });

    it('leaves an already-correctly-sized canvas untouched', () => {
      const mockVideo = { videoWidth: 1600, videoHeight: 900 } as any;
      const mockCanvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600 } as any;
      const result = calculateDrawDimensions(mockVideo, mockCanvas);
      expect(mockCanvas.width).toBe(800);
      expect(result.drawW).toBeCloseTo(1066.6667, 3);
    });
  });

  describe('getDefaultPoly', () => {
    it('fits width and derives 3:5 height at the 5/3 boundary (else branch)', () => {
      // 1000/600 === 5/3 exactly, so `ratio > 5/3` is false -> width-fit branch
      const mockVideo = { videoWidth: 1000, videoHeight: 600 } as any;
      const poly = getDefaultPoly(mockVideo);
      expect(poly).toEqual([
        { x: 50, y: 30 },
        { x: 950, y: 30 },
        { x: 950, y: 570 },
        { x: 50, y: 570 },
      ]);
    });

    it('fits height and derives 5:3 width for a square-ish element (else branch)', () => {
      // 600/600 = 1.0 < 5/3 -> width-fit: w=540, h=324, centered at (300,300)
      const mockVideo = { videoWidth: 600, videoHeight: 600 } as any;
      const poly = getDefaultPoly(mockVideo);
      expect(poly).toEqual([
        { x: 30, y: 138 },
        { x: 570, y: 138 },
        { x: 570, y: 462 },
        { x: 30, y: 462 },
      ]);
    });

    it('fits height for an ultra-wide element (ratio > 5/3, if branch)', () => {
      // 2000/600 = 3.33 > 5/3 -> height-fit: h=540, w=900, centered at (1000,300)
      const mockVideo = { videoWidth: 2000, videoHeight: 600 } as any;
      const poly = getDefaultPoly(mockVideo);
      expect(poly).toEqual([
        { x: 550, y: 30 },
        { x: 1450, y: 30 },
        { x: 1450, y: 570 },
        { x: 550, y: 570 },
      ]);
    });
  });

  describe('alignPolygons', () => {
    it('aligns polygon corners to match closest points in previous polygon', () => {
      const bestPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const previousPoly = [
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
        { x: 10, y: 10 },
      ];
      const aligned = alignPolygons(bestPoly, previousPoly);
      // previousPoly is bestPoly rotated by one, so the best shift is 1
      expect(aligned).toEqual([
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
        { x: 10, y: 10 },
      ]);
    });

    it('keeps the original order when it is already the closest (shift 0)', () => {
      const bestPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const previousPoly = [
        { x: 11, y: 11 },
        { x: 21, y: 11 },
        { x: 21, y: 21 },
        { x: 11, y: 21 },
      ];
      const aligned = alignPolygons(bestPoly, previousPoly);
      expect(aligned).toEqual(bestPoly);
    });
  });

  describe('applyDampening', () => {
    it('locks changes when differences are small', () => {
      const bestPoly = [
        { x: 11, y: 11 },
        { x: 21, y: 11 },
        { x: 21, y: 21 },
        { x: 11, y: 21 },
      ];
      const previousPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const debugLines: string[] = [];
      const dampened = applyDampening(bestPoly, previousPoly, debugLines);
      expect(debugLines).toContain('Filter: Locked');
      // locked = prev*0.6 + best*0.4 on both axes
      expect(dampened[0].x).toBeCloseTo(10.4);
      expect(dampened[0].y).toBeCloseTo(10.4);
      expect(dampened[1].x).toBeCloseTo(20.4);
      expect(dampened[1].y).toBeCloseTo(10.4);
    });

    it('heavily dampens when change is large', () => {
      const bestPoly = [
        { x: 200, y: 200 },
        { x: 210, y: 200 },
        { x: 210, y: 210 },
        { x: 200, y: 210 },
      ];
      const previousPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const debugLines: string[] = [];
      const dampened = applyDampening(bestPoly, previousPoly, debugLines);
      expect(debugLines).toContain('Filter: Heavy Dampening');
      // heavy = prev*0.95 + best*0.05 on both axes
      expect(dampened[0].x).toBeCloseTo(19.5);
      expect(dampened[0].y).toBeCloseTo(19.5);
      expect(dampened[1].x).toBeCloseTo(29.5);
      expect(dampened[1].y).toBeCloseTo(19.5);
    });

    it('locks (not heavy) when the max corner shift is exactly 150', () => {
      // hypot(150, 0) === 150, and the threshold is strictly `> 150`
      const previousPoly = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];
      const bestPoly = [
        { x: 150, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];
      const debugLines: string[] = [];
      const dampened = applyDampening(bestPoly, previousPoly, debugLines);
      expect(debugLines).toContain('Filter: Locked');
      expect(dampened[0].x).toBeCloseTo(60); // 0*0.6 + 150*0.4
    });
  });

  describe('applyTemporalSmoothing', () => {
    it('reorders corners canonically when there is no previous poly', () => {
      // Irregular quad chosen so both reordering steps fire and produce a
      // deterministic order: portrait edge -> rotate 1, then top-below-bottom -> rotate 2.
      const bestPoly = [
        { x: 0, y: 0 },
        { x: 10, y: 2 },
        { x: 12, y: 20 },
        { x: 1, y: 18 },
      ];
      const result = applyTemporalSmoothing(bestPoly, null, []);
      expect(result).toEqual([
        { x: 1, y: 18 },
        { x: 0, y: 0 },
        { x: 10, y: 2 },
        { x: 12, y: 20 },
      ]);
    });

    it('does not rotate when the first edge is already the long/top edge', () => {
      // Landscape, top edge already on top: neither reorder step fires.
      const bestPoly = [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
        { x: 0, y: 10 },
      ];
      const result = applyTemporalSmoothing(bestPoly, null, []);
      expect(result).toEqual(bestPoly);
    });
  });

  describe('processCardImage', () => {
    it('successfully runs the image processing pipeline', async () => {
      const mockImg = { naturalWidth: 1000, naturalHeight: 600 } as any;
      const result = await processCardImage(mockImg);
      expect(result).toHaveProperty('blob');
      expect(result.text).toBe('Mocked OCR Text');
    });

    it('coerces missing OCR text to an empty string', async () => {
      const mockImg = { naturalWidth: 1000, naturalHeight: 600 } as any;
      vi.mocked(Tesseract.recognize).mockResolvedValueOnce({ data: { text: '' } } as any);
      const result = await processCardImage(mockImg);
      expect(result.text).toBe('');
    });
  });

  describe('fallbackTextContour', () => {
    it('returns null if contours size is 0', () => {
      const mockContours = {
        size: () => 0,
        get: vi.fn(),
      } as any;
      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      expect(result).toBeNull();
    });

    it('returns a padded 5:3 landscape crop around a wide text cluster', () => {
      const mockContours = {
        size: () => 1,
        get: () => ({}),
      } as any;

      vi.mocked(cv.contourArea).mockReturnValueOnce(200);
      vi.mocked(cv.boundingRect).mockReturnValueOnce({ x: 50, y: 50, width: 200, height: 50 });

      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      // w/h = 240/80 = 3 > 5/3 -> clamp height to w*(3/5)=144, centered at (150,75)
      expect(result).toEqual([
        { x: 30, y: 3 },
        { x: 270, y: 3 },
        { x: 270, y: 147 },
        { x: 30, y: 147 },
      ]);
    });

    it('returns a padded 5:3 crop, widening a tall text cluster (else branch)', () => {
      const mockContours = {
        size: () => 1,
        get: () => ({}),
      } as any;

      vi.mocked(cv.contourArea).mockReturnValueOnce(200);
      vi.mocked(cv.boundingRect).mockReturnValueOnce({ x: 150, y: 50, width: 60, height: 150 });

      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      // w/h = 100/180 < 5/3 -> widen to w=h*(5/3)=300, centered at (180,125)
      expect(result).toEqual([
        { x: 30, y: 35 },
        { x: 330, y: 35 },
        { x: 330, y: 215 },
        { x: 30, y: 215 },
      ]);
    });

    it('returns null when the only contour is too small (area <= 50)', () => {
      const mockContours = {
        size: () => 1,
        get: () => ({}),
      } as any;

      vi.mocked(cv.contourArea).mockReturnValueOnce(20);

      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      expect(result).toBeNull();
    });

    it('returns null when the only contour is too large (>= 5% of frame)', () => {
      const mockContours = {
        size: () => 1,
        get: () => ({}),
      } as any;

      // 400*300*0.05 = 6000; 7000 exceeds the upper bound so it is skipped
      vi.mocked(cv.contourArea).mockReturnValueOnce(7000);

      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      expect(result).toBeNull();
    });

    it('rejects a contour whose area is exactly the lower bound (50)', () => {
      // bound is strictly `area > 50`, so 50 must be excluded. The area check
      // short-circuits before boundingRect, so no rect mock is needed (queuing
      // an unused mockReturnValueOnce would leak into the next test).
      const mockContours = { size: () => 1, get: () => ({}) } as any;
      vi.mocked(cv.contourArea).mockReturnValueOnce(50);
      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      expect(result).toBeNull();
    });

    it('rejects a contour whose area is exactly the upper bound (5% of frame)', () => {
      // bound is strictly `area < pWidth*pHeight*0.05` (=6000), so 6000 must be excluded
      const mockContours = { size: () => 1, get: () => ({}) } as any;
      vi.mocked(cv.contourArea).mockReturnValueOnce(6000);
      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      expect(result).toBeNull();
    });

    it('ignores contours hugging the frame edge (outside the safe inset)', () => {
      const mockContours = {
        size: () => 1,
        get: () => ({}),
      } as any;

      vi.mocked(cv.contourArea).mockReturnValueOnce(200);
      // x=5 is < pWidth*0.05 (20), so the edge guard rejects it
      vi.mocked(cv.boundingRect).mockReturnValueOnce({ x: 5, y: 50, width: 100, height: 50 });

      const result = fallbackTextContour(
        cv,
        { videoWidth: 1000, videoHeight: 600 } as any,
        mockContours,
        1,
        400,
        300
      );
      expect(result).toBeNull();
    });
  });

  describe('applyTemporalSmoothing alignment case', () => {
    it('calls alignPolygons and applyDampening when previousPoly is valid', () => {
      const bestPoly = [
        { x: 11, y: 11 },
        { x: 21, y: 11 },
        { x: 21, y: 21 },
        { x: 11, y: 21 },
      ];
      const previousPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const debugLines: string[] = [];
      const result = applyTemporalSmoothing(bestPoly, previousPoly, debugLines);
      // valid previous -> align (shift 0 here) then dampen (locked, small delta)
      expect(debugLines).toContain('Filter: Locked');
      expect(result[0].x).toBeCloseTo(10.4);
      expect(result[0].y).toBeCloseTo(10.4);
      expect(result[1].x).toBeCloseTo(20.4);
    });

    it('returns adjusted bestPoly if previousPoly is invalid (contains NaN)', () => {
      const bestPoly = [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const previousPoly = [
        { x: Number.NaN, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ];
      const result = applyTemporalSmoothing(bestPoly, previousPoly, []);
      // NaN previous is treated as "no previous": canonical reorder (no rotation
      // needed here), and crucially NOT dampened against the NaN corners.
      expect(result).toEqual(bestPoly);
    });
  });

  describe('processCardImage error cases', () => {
    it('throws error if dimensions are zero', async () => {
      const mockImg = { naturalWidth: 0, naturalHeight: 0 } as any;
      await expect(processCardImage(mockImg)).rejects.toThrow('Invalid image dimensions');
    });

    it('throws if only the width is zero', async () => {
      const mockImg = { naturalWidth: 0, naturalHeight: 600 } as any;
      await expect(processCardImage(mockImg)).rejects.toThrow('Invalid image dimensions');
    });

    it('throws if only the height is zero', async () => {
      const mockImg = { naturalWidth: 1000, naturalHeight: 0 } as any;
      await expect(processCardImage(mockImg)).rejects.toThrow('Invalid image dimensions');
    });

    it('throws error if canvas toBlob fails', async () => {
      const mockImg = { naturalWidth: 1000, naturalHeight: 600 } as any;

      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb: any) {
        cb(null); // Simulate failure
      };

      try {
        await expect(processCardImage(mockImg)).rejects.toThrow('Failed to generate image blob');
      } finally {
        HTMLCanvasElement.prototype.toBlob = originalToBlob;
      }
    });
  });

  describe('OpenCV promise compatibility', () => {
    it('verifies that the imported cv is a Promise and resolves correctly', async () => {
      const cvImport = cv;
      expect(cvImport).toBeInstanceOf(Promise);
      const resolved = await (cvImport as any);
      expect(resolved).toHaveProperty('imread');
    });
  });

  describe('detectDocumentContour', () => {
    const mockVideo = { videoWidth: 800, videoHeight: 600 } as any;

    it('returns the largest 4-point contour, scaled back to source coordinates', () => {
      // Mock contour: rows=4, data32S=[0,0,800,0,800,600,0,600]; area 500000.
      // processScale=2 divides each coordinate; corners are already angularly sorted.
      const { bestPoly, maxArea } = detectDocumentContour(cv, mockVideo, 2, 400, 300);
      expect(maxArea).toBe(500000);
      expect(bestPoly).toEqual([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ]);
    });

    it('returns no polygon when every contour is below the 10% area gate', () => {
      // 400*300*0.1 = 12000; 5000 is under the gate so the contour is skipped.
      vi.mocked(cv.contourArea).mockReturnValueOnce(5000);
      const { bestPoly, maxArea } = detectDocumentContour(cv, mockVideo, 2, 400, 300);
      expect(bestPoly).toBeNull();
      expect(maxArea).toBe(0);
    });

    it('returns the OpenCV mats so the caller can free them', () => {
      const result = detectDocumentContour(cv, mockVideo, 2, 400, 300);
      expect(result.src).toBeDefined();
      expect(result.contours).toBeDefined();
      expect(result.hierarchy).toBeDefined();
    });
  });
});
