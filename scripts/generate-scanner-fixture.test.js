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

// 5x7 Bitmap Font
const FONT = {
  A: [0x1c, 0x22, 0x22, 0x3e, 0x22, 0x22, 0x22],
  B: [0x3c, 0x22, 0x22, 0x3c, 0x22, 0x22, 0x3c],
  C: [0x1e, 0x20, 0x20, 0x20, 0x20, 0x20, 0x1e],
  D: [0x3c, 0x22, 0x22, 0x22, 0x22, 0x22, 0x3c],
  E: [0x3e, 0x20, 0x20, 0x3c, 0x20, 0x20, 0x3e],
  F: [0x3e, 0x20, 0x20, 0x3c, 0x20, 0x20, 0x20],
  G: [0x1e, 0x20, 0x20, 0x2e, 0x22, 0x22, 0x1e],
  H: [0x22, 0x22, 0x22, 0x3e, 0x22, 0x22, 0x22],
  I: [0x1c, 0x08, 0x08, 0x08, 0x08, 0x08, 0x1c],
  J: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x24, 0x18],
  K: [0x22, 0x24, 0x28, 0x30, 0x28, 0x24, 0x22],
  L: [0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x3e],
  M: [0x22, 0x36, 0x2a, 0x22, 0x22, 0x22, 0x22],
  N: [0x22, 0x32, 0x2a, 0x26, 0x22, 0x22, 0x22],
  O: [0x1c, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1c],
  P: [0x3c, 0x22, 0x22, 0x3c, 0x20, 0x20, 0x20],
  Q: [0x1c, 0x22, 0x22, 0x22, 0x2a, 0x24, 0x1a],
  R: [0x3c, 0x22, 0x22, 0x3c, 0x28, 0x24, 0x22],
  S: [0x1e, 0x20, 0x20, 0x1c, 0x02, 0x02, 0x3c],
  T: [0x3e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08],
  U: [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1c],
  V: [0x22, 0x22, 0x22, 0x22, 0x22, 0x14, 0x08],
  W: [0x22, 0x22, 0x22, 0x2a, 0x2a, 0x36, 0x22],
  X: [0x22, 0x22, 0x14, 0x08, 0x14, 0x22, 0x22],
  Y: [0x22, 0x22, 0x14, 0x08, 0x08, 0x08, 0x08],
  Z: [0x3e, 0x02, 0x04, 0x08, 0x10, 0x20, 0x3e],
  0: [0x1c, 0x22, 0x26, 0x2a, 0x32, 0x22, 0x1c],
  1: [0x08, 0x18, 0x08, 0x08, 0x08, 0x08, 0x1c],
  2: [0x1c, 0x22, 0x02, 0x0c, 0x10, 0x20, 0x3e],
  3: [0x1c, 0x22, 0x02, 0x0c, 0x02, 0x22, 0x1c],
  4: [0x04, 0x0c, 0x14, 0x24, 0x3e, 0x04, 0x04],
  5: [0x3e, 0x20, 0x3c, 0x02, 0x02, 0x22, 0x1c],
  6: [0x1c, 0x20, 0x20, 0x3c, 0x22, 0x22, 0x1c],
  7: [0x3e, 0x02, 0x04, 0x08, 0x10, 0x10, 0x10],
  8: [0x1c, 0x22, 0x22, 0x1c, 0x22, 0x22, 0x1c],
  9: [0x1c, 0x22, 0x22, 0x1e, 0x02, 0x02, 0x1c],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x08, 0x08, 0x08, 0x08, 0x08, 0x00, 0x08],
};

const isInsideQuad = (x, y, p0, p1, p2, p3) => {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const c0 = cross(p0, p1, { x, y });
  const c1 = cross(p1, p2, { x, y });
  const c2 = cross(p2, p3, { x, y });
  const c3 = cross(p3, p0, { x, y });
  return (c0 >= 0 && c1 >= 0 && c2 >= 0 && c3 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0 && c3 <= 0);
};

// Helper to check if (x,y) hits text glyphs
function isPixelInText(x, y, startX, startY, text, scale = 2) {
  const charWidth = 6 * scale;
  const charHeight = 7 * scale;

  if (y < startY || y >= startY + charHeight) return false;
  if (x < startX) return false;

  const relX = x - startX;
  const relY = y - startY;

  const charIndex = Math.floor(relX / charWidth);
  if (charIndex < 0 || charIndex >= text.length) return false;

  const char = text[charIndex].toUpperCase();
  const fontRows = FONT[char] || FONT[' '];

  const fontY = Math.floor(relY / scale);
  const fontX = Math.floor((relX % charWidth) / scale);

  if (fontY >= 7 || fontX >= 6) return false;

  const rowByte = fontRows[fontY] || 0;
  return ((rowByte >> (5 - fontX)) & 1) === 1;
}

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

  const line1Text = 'I WISH FOR A';
  const line2Text = 'RASPBERRY PI 5';

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
          // Card surface - bright white paper
          const distToEdge = Math.min(
            x - (120 + jitterX),
            500 + jitterX - x,
            y - (90 + jitterY),
            390 + jitterY - y
          );

          if (distToEdge < 4) {
            yPlane[idx] = 30; // Dark card border
          } else if (
            isPixelInText(x, y, 200 + Math.floor(jitterX), 210 + Math.floor(jitterY), line1Text, 2)
          ) {
            yPlane[idx] = 15; // Dark text glyph line 1
          } else if (
            isPixelInText(x, y, 190 + Math.floor(jitterX), 250 + Math.floor(jitterY), line2Text, 2)
          ) {
            yPlane[idx] = 15; // Dark text glyph line 2
          } else {
            yPlane[idx] = 240; // Paper
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
