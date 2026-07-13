import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FONTS = [
  {
    url: 'https://fonts.gstatic.com/s/kalam/v18/YA9dr0Wd4kDdMuhW.ttf',
    dest: 'Kalam-Regular.ttf',
  },
  {
    url: 'https://fonts.gstatic.com/s/kalam/v18/YA9Qr0Wd4kDdMtDqHQLL.ttf',
    dest: 'Kalam-Bold.ttf',
  },
  {
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/fonts/NotoColorEmoji.ttf',
    dest: 'NotoColorEmoji.ttf',
  },
];

export const targetDir = path.resolve(__dirname, '../src/client/public/fonts');

export function downloadFile(url, destPath, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects'));
  }
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        // Handle HTTP redirection (e.g. 301, 302 status codes)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlink(destPath, () => {}); // Clean up the empty file
          downloadFile(response.headers.location, destPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: Status ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
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
  await main();
}
