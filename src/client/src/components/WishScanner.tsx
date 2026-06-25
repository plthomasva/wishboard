import React, { useRef, useState, useEffect } from 'react';
import cv from '@techstark/opencv-js';
import Tesseract from 'tesseract.js';

interface WishScannerProps {
  onCapture: (content: string, imageBlob: Blob) => void;
  onCancel: () => void;
  stickerZoneHeightPercentage?: number;
}

type Point = { x: number; y: number };

function calculateDrawDimensions(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const targetW = canvas.clientWidth;
  const targetH = canvas.clientHeight;
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  
  const videoRatio = video.videoWidth / video.videoHeight;
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

function detectDocumentContour(video: HTMLVideoElement, processScale: number, pWidth: number, pHeight: number) {
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

function fallbackTextContour(video: HTMLVideoElement, contours: any, processScale: number, pWidth: number, pHeight: number): Point[] | null {
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
      minX = Math.max(0, minX - padX) / processScale;
      minY = Math.max(0, minY - padY) / processScale;
      maxX = Math.min(video.videoWidth, (maxX + padX) / processScale);
      maxY = Math.min(video.videoHeight, (maxY + padY) / processScale);
      
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

function getDefaultPoly(video: HTMLVideoElement): Point[] {
  let ratio = video.videoWidth / video.videoHeight;
  let w, h;
  if (ratio > (5/3)) {
      h = video.videoHeight * 0.9;
      w = h * (5/3);
  } else {
      w = video.videoWidth * 0.9;
      h = w * (3/5);
  }
  const cx = video.videoWidth / 2;
  const cy = video.videoHeight / 2;
  return [
      { x: cx - w/2, y: cy - h/2 },
      { x: cx + w/2, y: cy - h/2 },
      { x: cx + w/2, y: cy + h/2 },
      { x: cx - w/2, y: cy + h/2 }
  ];
}

function alignPolygons(bestPoly: Point[], previousPoly: Point[]) {
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

function applyDampening(bestPoly: Point[], previousPoly: Point[], debugLines: string[]) {
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

function applyTemporalSmoothing(bestPoly: Point[], previousPoly: Point[] | null, debugLines: string[]): Point[] {
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

interface DrawConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

function renderOverlay(
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement, 
  video: HTMLVideoElement, 
  pts: Point[], 
  draw: DrawConfig, 
  stickerZoneHeightPercentage: number
) {
  const mapPt = (p: Point) => ({
      x: draw.x + (p.x / video.videoWidth) * draw.w,
      y: draw.y + (p.y / video.videoHeight) * draw.h
  });

  const p0 = mapPt(pts[0]);
  const p1 = mapPt(pts[1]);
  const p2 = mapPt(pts[2]);
  const p3 = mapPt(pts[3]);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.closePath();
  ctx.fill('evenodd');

  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.stroke();

  let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 1000, 0, 1000, 600, 0, 600]);
  let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
  let transform = cv.getPerspectiveTransform(srcTri, dstTri);

  const pad = 20;
  const szW = 1000 * (stickerZoneHeightPercentage / 100);
  const szH = 600 * 0.15;
  const szX1 = 1000 - szW - pad;
  const szY1 = 600 - szH - pad;
  const szX2 = 1000 - pad;
  const szY2 = 600 - pad;

  let zonePtsMat = cv.matFromArray(4, 1, cv.CV_32FC2, [szX1, szY1, szX2, szY1, szX2, szY2, szX1, szY2]);
  let outPtsMat = new cv.Mat();
  cv.perspectiveTransform(zonePtsMat, outPtsMat, transform);

  const zp0 = { x: outPtsMat.data32F[0], y: outPtsMat.data32F[1] };
  const zp1 = { x: outPtsMat.data32F[2], y: outPtsMat.data32F[3] };
  const zp2 = { x: outPtsMat.data32F[4], y: outPtsMat.data32F[5] };
  const zp3 = { x: outPtsMat.data32F[6], y: outPtsMat.data32F[7] };

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(zp0.x, zp0.y);
  ctx.lineTo(zp1.x, zp1.y);
  ctx.lineTo(zp2.x, zp2.y);
  ctx.lineTo(zp3.x, zp3.y);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const zcx = (zp0.x + zp1.x + zp2.x + zp3.x) / 4;
  const zcy = (zp0.y + zp1.y + zp2.y + zp3.y) / 4;
  const angle = Math.atan2(zp1.y - zp0.y, zp1.x - zp0.x);
  
  ctx.save();
  ctx.translate(zcx, zcy);
  ctx.rotate(angle);
  ctx.fillText('Stickers go here', 0, 0);
  ctx.restore();

  srcTri.delete(); dstTri.delete(); transform.delete(); zonePtsMat.delete(); outPtsMat.delete();
}

export default function WishScanner({ onCapture, onCancel, stickerZoneHeightPercentage = 30 }: Readonly<WishScannerProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  const smoothedCornersRef = useRef<{x: number, y: number}[] | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function setupCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Camera API not available. Make sure you are using HTTPS or localhost.");
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error('Error accessing camera', err);
        setIsProcessing(true);
        setProcessingStatus(`Camera Error: ${err.message || 'Permissions denied or insecure context'}`);
      }
    }
    setupCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const drawOverlay = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0) {
      animationFrameRef.current = requestAnimationFrame(drawOverlay);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { drawW, drawH, drawX, drawY } = calculateDrawDimensions(video, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let debugLines: string[] = [
        `Video: ${video.videoWidth}x${video.videoHeight}`,
        `Canvas: ${canvas.width}x${canvas.height}`
    ];

    try {
        const processScale = 400 / video.videoWidth;
        const pWidth = 400;
        const pHeight = Math.floor(video.videoHeight * processScale);
        
        let { src, contours, hierarchy, maxArea, bestPoly } = detectDocumentContour(video, processScale, pWidth, pHeight);
        
        if (bestPoly) {
            debugLines.push(`State: Tracked (${Math.floor(maxArea)}px)`);
        } else {
            bestPoly = fallbackTextContour(video, contours, processScale, pWidth, pHeight);
            if (bestPoly) {
                debugLines.push("State: Center Crop Fallback");
            }
        }
        
        src.delete(); contours.delete(); hierarchy.delete();
        
        bestPoly ??= getDefaultPoly(video);

        smoothedCornersRef.current = applyTemporalSmoothing(bestPoly, smoothedCornersRef.current, debugLines);
        
        renderOverlay(ctx, canvas, video, smoothedCornersRef.current, { x: drawX, y: drawY, w: drawW, h: drawH }, stickerZoneHeightPercentage);

    } catch (err: any) {
        debugLines.push(`Error: ${err.message || err.toString()}`);
        console.warn("Live OpenCV processing error", err);
    }
    
    // Render Debug Text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 250, debugLines.length * 16 + 10);
    ctx.fillStyle = 'lime';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    debugLines.forEach((line, idx) => {
        ctx.fillText(line, 10, 5 + idx * 16);
    });
    
    animationFrameRef.current = requestAnimationFrame(drawOverlay);
  };

  const processImage = async () => {
    if (!videoRef.current || !smoothedCornersRef.current || smoothedCornersRef.current.some(p => Number.isNaN(p.x))) return;
    setIsProcessing(true);
    setProcessingStatus('Reading text (this may take a few moments)...');
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const video = videoRef.current;

    try {
        let srcOriginal = document.createElement('canvas');
        srcOriginal.width = video.videoWidth;
        srcOriginal.height = video.videoHeight;
        srcOriginal.getContext('2d')?.drawImage(video, 0, 0);
        
        let cvSrc = cv.imread(srcOriginal);
        let cvDst = new cv.Mat();
        
        let pts = [...smoothedCornersRef.current];
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y]);
        
        const WARP_W = 1000;
        const WARP_H = 600;
        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, WARP_W, 0, WARP_W, WARP_H, 0, WARP_H]);
        
        let transform = cv.getPerspectiveTransform(srcTri, dstTri);
        cv.warpPerspective(cvSrc, cvDst, transform, new cv.Size(WARP_W, WARP_H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        
        let finalCanvas = document.createElement('canvas');
        finalCanvas.width = WARP_W;
        finalCanvas.height = WARP_H;
        cv.imshow(finalCanvas, cvDst);
        
        cvSrc.delete(); cvDst.delete(); srcTri.delete(); dstTri.delete(); transform.delete();

        if (stream) stream.getTracks().forEach(t => t.stop());

        const { data: { text } } = await Tesseract.recognize(
            finalCanvas.toDataURL('image/jpeg'),
            'eng',
            { logger: m => console.log(m) }
        );

        finalCanvas.toBlob((blob) => {
            if (blob) {
                onCapture(text || '', blob);
            } else {
                setProcessingStatus('Failed to generate image blob');
                setIsProcessing(false);
            }
        }, 'image/jpeg', 0.85);

    } catch (err) {
      console.error(err);
      setProcessingStatus('Error processing image');
      setIsProcessing(false);
    }
  };

  return (
    <div className="wish-scanner" style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto', background: '#000', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' }}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        onPlay={drawOverlay}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
      />
      <canvas 
        ref={canvasRef} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} 
      />
      
      {isProcessing ? (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexFlow: 'column', zIndex: 10 }}>
            <div className="spinner" style={{ marginBottom: '16px' }}></div>
            <p>{processingStatus}</p>
        </div>
      ) : (
        <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '16px', zIndex: 10 }}>
          <button type="button" onClick={onCancel} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '24px', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={processImage} style={{ background: 'white', color: 'black', border: 'none', padding: '12px 32px', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer' }}>Take Photo</button>
        </div>
      )}
    </div>
  );
}
