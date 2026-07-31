import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtureDir = path.resolve(__dirname, '../tests/e2e/fixtures');
if (!fs.existsSync(fixtureDir)) {
  fs.mkdirSync(fixtureDir, { recursive: true });
}

const outputPath = path.join(fixtureDir, 'wish-card-stream.y4m');

const width = 640;
const height = 480;
const fps = 15;
const numFrames = 15;

const header = `YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420jpeg\n`;
const streams = [Buffer.from(header)];

const isInsideQuad = (x, y, p0, p1, p2, p3) => {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const c0 = cross(p0, p1, { x, y });
  const c1 = cross(p1, p2, { x, y });
  const c2 = cross(p2, p3, { x, y });
  const c3 = cross(p3, p0, { x, y });
  return (c0 >= 0 && c1 >= 0 && c2 >= 0 && c3 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0 && c3 <= 0);
};

for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
  const jitterX = Math.sin(frameIdx * 0.5) * 4;
  const jitterY = Math.cos(frameIdx * 0.5) * 3;

  // Skewed 3x5 card coordinates with micro-jitter
  const p0 = { x: 140 + jitterX, y: 90 + jitterY };
  const p1 = { x: 500 + jitterX, y: 110 + jitterY };
  const p2 = { x: 470 + jitterX, y: 390 + jitterY };
  const p3 = { x: 120 + jitterX, y: 370 + jitterY };

  // Sticker zone area inside top-right of card
  const sp0 = { x: 380 + jitterX, y: 120 + jitterY };
  const sp1 = { x: 480 + jitterX, y: 130 + jitterY };
  const sp2 = { x: 460 + jitterX, y: 190 + jitterY };
  const sp3 = { x: 370 + jitterX, y: 180 + jitterY };

  const yPlane = Buffer.alloc(width * height);
  const uPlane = Buffer.alloc((width / 2) * (height / 2));
  const vPlane = Buffer.alloc((width / 2) * (height / 2));

  // Fill background
  yPlane.fill(35); // Dark background
  uPlane.fill(128);
  vPlane.fill(128);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const uvIdx = Math.floor(y / 2) * (width / 2) + Math.floor(x / 2);

      if (isInsideQuad(x, y, p0, p1, p2, p3)) {
        if (isInsideQuad(x, y, sp0, sp1, sp2, sp3)) {
          // Sticker zone - vibrant purple/blue sticker
          yPlane[idx] = 160;
          uPlane[uvIdx] = 180;
          vPlane[uvIdx] = 80;
        } else {
          // Card surface - bright white/off-white paper
          // Add a dark border stroke near the edge
          const distToEdge = Math.min(
            x - (120 + jitterX),
            500 + jitterX - x,
            y - (90 + jitterY),
            390 + jitterY - y
          );
          if (distToEdge < 4) {
            yPlane[idx] = 30; // Dark border
          } else if (
            y > 220 + jitterY &&
            y < 240 + jitterY &&
            x > 200 + jitterX &&
            x < 400 + jitterX
          ) {
            // Simulated handwriting/text line 1
            yPlane[idx] = 20;
          } else if (
            y > 260 + jitterY &&
            y < 280 + jitterY &&
            x > 220 + jitterX &&
            x < 380 + jitterX
          ) {
            // Simulated handwriting/text line 2
            yPlane[idx] = 20;
          } else {
            yPlane[idx] = 230; // Paper
          }
        }
      }
    }
  }

  streams.push(Buffer.from('FRAME\n'));
  streams.push(yPlane);
  streams.push(uPlane);
  streams.push(vPlane);
}

const finalBuffer = Buffer.concat(streams);
fs.writeFileSync(outputPath, finalBuffer);
console.log(
  `Generated Y4M test video fixture at ${outputPath} (${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB)`
);
