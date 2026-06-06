import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FONTS = [
  {
    url: 'https://fonts.gstatic.com/s/kalam/v18/YA9dr0Wd4kDdMuhW.ttf',
    dest: 'Kalam-Regular.ttf'
  },
  {
    url: 'https://fonts.gstatic.com/s/kalam/v18/YA9Qr0Wd4kDdMtDqHQLL.ttf',
    dest: 'Kalam-Bold.ttf'
  }
];

export const targetDir = path.resolve(__dirname, '../src/client/public/fonts');

export function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Clean up partial file
      reject(err);
    });
  });
}

export async function main() {
  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  console.log('Checking for font updates...');
  for (const font of FONTS) {
    const destPath = path.join(targetDir, font.dest);
    try {
      await downloadFile(font.url, destPath);
      console.log(`Successfully downloaded/updated ${font.dest}`);
    } catch (err) {
      console.warn(`Could not update ${font.dest} from Google APIs: ${err.message}`);
      if (fs.existsSync(destPath)) {
        console.log(`Using cached version of ${font.dest}`);
      } else {
        console.error(`Error: Cached version of ${font.dest} not found and download failed.`);
        process.exit(1);
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

