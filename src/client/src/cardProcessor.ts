import cv from '@techstark/opencv-js';
import Tesseract from 'tesseract.js';

export type Point = { x: number; y: number };
export type ProcessableElement = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export function getElementDimensions(element: ProcessableElement): { width: number; height: number } {
  if ('videoWidth' in element && typeof element.videoWidth === 'number') {
    return { width: element.videoWidth, height: element.videoHeight };
  } else if ('naturalWidth' in element && typeof element.naturalWidth === 'number') {
    return { width: element.naturalWidth, height: element.naturalHeight };
  } else {
    return { width: element.width, height: element.height };
  }
}

export function calculateDrawDimensions(video: ProcessableElement, canvas: HTMLCanvasElement) {
  const targetW = canvas.clientWidth;
  const targetH = canvas.clientHeight;
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  
  const { width: videoWidth, height: videoHeight } = getElementDimensions(video);
  const videoRatio = videoWidth / videoHeight;
  const canvasRatio = canvas.width / canvas.height;
  
  let drawW = canvas.width;
  let drawH = canvas.height;
  let drawX = 0;
  let drawY = 0;
  
  if (videoRatio > canvasRatio) {
      drawW = canvas.height * videoRatio;
      drawX = (canvas.width - drawW) / 2;
  } else {
      drawH = canvas.width / videoRatio;
      drawY = (canvas.height - drawH) / 2;
  }
  return { drawW, drawH, drawX, drawY };
}

export function detectDocumentContour(video: ProcessableElement, processScale: number, pWidth: number, pHeight: number) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = pWidth;
  tempCanvas.height = pHeight;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  tempCtx?.drawImage(video, 0, 0, pWidth, pHeight);
  
  let src = cv.imread(tempCanvas);
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(src, src, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  cv.Canny(src, src, 75, 200, 3, false);
  
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  
  let maxArea = 0;
  let bestPoly: Point[] | null = null;
  
  for (let i = 0; i < contours.size(); ++i) {
    let cnt = contours.get(i);
    let area = cv.contourArea(cnt, false);
    if (area > (pWidth * pHeight * 0.1)) {
      let approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);
      if (approx.rows === 4 && area > maxArea) {
        maxArea = area;
        bestPoly = [];
        let cx = 0, cy = 0;
        for (let j = 0; j < 4; j++) {
            let p = { x: approx.data32S[j * 2] / processScale, y: approx.data32S[j * 2 + 1] / processScale };
            bestPoly.push(p);
            cx += p.x; cy += p.y;
        }
        cx /= 4; cy /= 4;
        bestPoly.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
      }
      approx.delete();
    }
  }
  return { src, contours, hierarchy, maxArea, bestPoly };
}

export function fallbackTextContour(video: ProcessableElement, contours: any, processScale: number, pWidth: number, pHeight: number): Point[] | null {
  let minX = pWidth, minY = pHeight, maxX = 0, maxY = 0;
  let foundText = false;
  for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt, false);
      if (area > 50 && area < (pWidth * pHeight * 0.05)) {
          let rect = cv.boundingRect(cnt);
          if (rect.x > pWidth * 0.05 && rect.y > pHeight * 0.05 && 
              (rect.x + rect.width) < pWidth * 0.95 && 
              (rect.y + rect.height) < pHeight * 0.95) {
              minX = Math.min(minX, rect.x);
              minY = Math.min(minY, rect.y);
              maxX = Math.max(maxX, rect.x + rect.width);
              maxY = Math.max(maxY, rect.y + rect.height);
              foundText = true;
          }
      }
  }
  if (foundText && (maxX - minX) > pWidth * 0.1) {
      let padX = pWidth * 0.05;
      let padY = pHeight * 0.05;
      const { width, height } = getElementDimensions(video);
      minX = Math.max(0, minX - padX) / processScale;
      minY = Math.max(0, minY - padY) / processScale;
      maxX = Math.min(width, (maxX + padX) / processScale);
      maxY = Math.min(height, (maxY + padY) / processScale);
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      let w = maxX - minX;
      let h = maxY - minY;
      
      if (w / h > (5/3)) h = w * (3/5);
      else w = h * (5/3);
      
      return [
          { x: cx - w/2, y: cy - h/2 },
          { x: cx + w/2, y: cy - h/2 },
          { x: cx + w/2, y: cy + h/2 },
          { x: cx - w/2, y: cy + h/2 }
      ];
  }
  return null;
}

export function getDefaultPoly(video: ProcessableElement): Point[] {
  const { width, height } = getElementDimensions(video);
  let ratio = width / height;
  let w, h;
  if (ratio > (5/3)) {
      h = height * 0.9;
      w = h * (5/3);
  } else {
      w = width * 0.9;
      h = w * (3/5);
  }
  const cx = width / 2;
  const cy = height / 2;
  return [
      { x: cx - w/2, y: cy - h/2 },
      { x: cx + w/2, y: cy - h/2 },
      { x: cx + w/2, y: cy + h/2 },
      { x: cx - w/2, y: cy + h/2 }
  ];
}

export function alignPolygons(bestPoly: Point[], previousPoly: Point[]) {
    let minTotalDist = Infinity;
    let bestShift = 0;
    for (let shift = 0; shift < 4; shift++) {
        let totalDist = 0;
        for (let i = 0; i < 4; i++) {
            let p2 = bestPoly[(i + shift) % 4];
            let p1 = previousPoly[i];
            totalDist += Math.hypot(p1.x - p2.x, p1.y - p2.y);
        }
        if (totalDist < minTotalDist) {
            minTotalDist = totalDist;
            bestShift = shift;
        }
    }
    let alignedPoly = [];
    for (let i = 0; i < 4; i++) alignedPoly.push(bestPoly[(i + bestShift) % 4]);
    return alignedPoly;
}

export function applyDampening(bestPoly: Point[], previousPoly: Point[], debugLines: string[]) {
    let maxDist = 0;
    for (let i = 0; i < 4; i++) {
        let dist = Math.hypot(previousPoly[i].x - bestPoly[i].x, previousPoly[i].y - bestPoly[i].y);
        if (dist > maxDist) maxDist = dist;
    }

    let result = [];
    if (maxDist > 150) {
        for (let i = 0; i < 4; i++) {
            result.push({
                x: previousPoly[i].x * 0.95 + bestPoly[i].x * 0.05,
                y: previousPoly[i].y * 0.95 + bestPoly[i].y * 0.05
            });
        }
        debugLines.push("Filter: Heavy Dampening");
    } else {
        for (let i = 0; i < 4; i++) {
            result.push({
                x: previousPoly[i].x * 0.6 + bestPoly[i].x * 0.4,
                y: previousPoly[i].y * 0.6 + bestPoly[i].y * 0.4
            });
        }
        debugLines.push("Filter: Locked");
    }
    return result;
}

export function applyTemporalSmoothing(bestPoly: Point[], previousPoly: Point[] | null, debugLines: string[]): Point[] {
  if (!previousPoly || previousPoly.some(p => Number.isNaN(p.x) || Number.isNaN(p.y))) {
      let pts = [...bestPoly];
      let d01 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      let d12 = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
      if (d12 > d01) pts.push(pts.shift()!); 
      if (pts[0].y + pts[1].y > pts[2].y + pts[3].y) {
          pts.push(pts.shift()!, pts.shift()!); 
      }
      return pts;
  }
  
  const alignedPoly = alignPolygons(bestPoly, previousPoly);
  return applyDampening(alignedPoly, previousPoly, debugLines);
}

export async function processCardImage(img: HTMLImageElement): Promise<{ blob: Blob; text: string }> {
  const { width, height } = getElementDimensions(img);
  if (width === 0 || height === 0) {
    throw new Error("Invalid image dimensions");
  }

  const processScale = 400 / width;
  const pWidth = 400;
  const pHeight = Math.floor(height * processScale);

  let { src, contours, hierarchy, bestPoly } = detectDocumentContour(img, processScale, pWidth, pHeight);

  bestPoly ??= fallbackTextContour(img, contours, processScale, pWidth, pHeight);

  src.delete(); contours.delete(); hierarchy.delete();

  bestPoly ??= getDefaultPoly(img);

  const smoothed = applyTemporalSmoothing(bestPoly, null, []);

  const WARP_W = 1000;
  const WARP_H = 600;

  const imgCanvas = document.createElement('canvas');
  imgCanvas.width = width;
  imgCanvas.height = height;
  const imgCtx = imgCanvas.getContext('2d');
  imgCtx?.drawImage(img, 0, 0);

  let cvSrc = cv.imread(imgCanvas);
  let cvDst = new cv.Mat();

  let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    smoothed[0].x, smoothed[0].y,
    smoothed[1].x, smoothed[1].y,
    smoothed[2].x, smoothed[2].y,
    smoothed[3].x, smoothed[3].y
  ]);
  let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    WARP_W, 0,
    WARP_W, WARP_H,
    0, WARP_H
  ]);

  let transform = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(cvSrc, cvDst, transform, new cv.Size(WARP_W, WARP_H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = WARP_W;
  finalCanvas.height = WARP_H;
  cv.imshow(finalCanvas, cvDst);

  cvSrc.delete(); cvDst.delete(); srcTri.delete(); dstTri.delete(); transform.delete();

  const { data: { text } } = await Tesseract.recognize(
    finalCanvas.toDataURL('image/jpeg'),
    'eng',
    { logger: m => console.log(m) }
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to generate image blob'));
    }, 'image/jpeg', 0.85);
  });

  return { blob, text: text || '' };
}
