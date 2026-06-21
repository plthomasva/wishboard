import React, { useRef, useState, useEffect } from 'react';
import cv from '@techstark/opencv-js';
import Tesseract from 'tesseract.js';

interface WishScannerProps {
  onCapture: (content: string, imageBlob: Blob) => void;
  onCancel: () => void;
  stickerZoneHeightPercentage?: number; // How much of the right side is reserved for stickers
}

export default function WishScanner({ onCapture, onCancel, stickerZoneHeightPercentage = 30 }: Readonly<WishScannerProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Error accessing camera', err);
        setProcessingStatus('Error accessing camera. Please ensure permissions are granted.');
      }
    }
    setupCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const drawOverlay = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0) {
      requestAnimationFrame(drawOverlay);
      return;
    }

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw guide box (3x5 ratio = 5:3)
    const boxWidth = canvas.width * 0.8;
    const boxHeight = boxWidth * (3/5);
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = (canvas.height - boxHeight) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Draw sticker zone in bottom right
    const stickerZoneH = boxHeight;
    const stickerZoneW = boxWidth * (stickerZoneHeightPercentage / 100);
    const stickerZoneX = boxX + boxWidth - stickerZoneW;
    const stickerZoneY = boxY;

    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fillRect(stickerZoneX, stickerZoneY, stickerZoneW, stickerZoneH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sticker Zone', stickerZoneX + stickerZoneW / 2, stickerZoneY + stickerZoneH / 2);

    requestAnimationFrame(drawOverlay);
  };

  const processImage = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setProcessingStatus('Finding card...');

    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
        setIsProcessing(false);
        return;
    }
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Stop video stream
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      // Basic fallback crop if OpenCV isn't available or fails
      let finalCanvas = document.createElement('canvas');
      let isSuccess = false;

      try {
        let src = cv.imread(tempCanvas);
        let dst = new cv.Mat();
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
        cv.GaussianBlur(src, src, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(src, src, 75, 200, 3, false);
  
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  
        let maxArea = 0;
        let maxContourIndex = -1;
        for (let i = 0; i < contours.size(); ++i) {
          let cnt = contours.get(i);
          let area = cv.contourArea(cnt, false);
          if (area > maxArea) {
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);
            if (approx.rows === 4) {
              maxArea = area;
              maxContourIndex = i;
            }
            approx.delete();
          }
        }
  
        if (maxContourIndex !== -1) {
          let cnt = contours.get(maxContourIndex);
          let approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);
          
          let pts = [];
          for (let i = 0; i < 4; i++) {
              pts.push({ x: approx.data32S[i * 2], y: approx.data32S[i * 2 + 1] });
          }
          
          // Sort points: top-left, top-right, bottom-right, bottom-left
          pts.sort((a, b) => a.y - b.y);
          let top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
          let bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
          pts = [top[0], top[1], bottom[1], bottom[0]];
  
          let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y]);
          
          // Target 3x5 ratio (e.g., 1000x600)
          let w = 1000;
          let h = 600;
          let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, w, 0, w, h, 0, h]);
          
          let transform = cv.getPerspectiveTransform(srcTri, dstTri);
          let warped = new cv.Mat();
          let originalSrc = cv.imread(tempCanvas);
          cv.warpPerspective(originalSrc, warped, transform, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
          
          finalCanvas.width = w;
          finalCanvas.height = h;
          cv.imshow(finalCanvas, warped);
  
          srcTri.delete(); dstTri.delete(); transform.delete(); warped.delete(); originalSrc.delete();
          cnt.delete(); approx.delete();
          isSuccess = true;
        }
        
        src.delete(); dst.delete(); contours.delete(); hierarchy.delete();
      } catch (e) {
          console.warn("OpenCV card detection failed, falling back to center crop.", e);
      }

      if (!isSuccess) {
          // Fallback: Just crop the center based on the guide box ratio
          const w = tempCanvas.width * 0.8;
          const h = w * (3/5);
          const x = (tempCanvas.width - w) / 2;
          const y = (tempCanvas.height - h) / 2;
          finalCanvas.width = w;
          finalCanvas.height = h;
          const fCtx = finalCanvas.getContext('2d');
          fCtx?.drawImage(tempCanvas, x, y, w, h, 0, 0, w, h);
      }

      setProcessingStatus('Reading text (this may take a few moments)...');
      
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
    <div className="wish-scanner" style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        onPlay={drawOverlay}
        style={{ width: '100%', display: 'block' }} 
      />
      <canvas 
        ref={canvasRef} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} 
      />
      
      {isProcessing ? (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexFlow: 'column' }}>
            <div className="spinner" style={{ marginBottom: '16px' }}></div>
            <p>{processingStatus}</p>
        </div>
      ) : (
        <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button type="button" onClick={onCancel} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '24px', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={processImage} style={{ background: 'white', color: 'black', border: 'none', padding: '12px 32px', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer' }}>Take Photo</button>
        </div>
      )}
    </div>
  );
}
