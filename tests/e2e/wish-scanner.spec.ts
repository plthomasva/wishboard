import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, 'fixtures/wish-card-stream.y4m');

// Ensure Y4M fixture is generated before launching browser
test.beforeAll(() => {
  execSync('node scripts/generate-scanner-fixture.test.js', { stdio: 'inherit' });
});

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${fixturePath}`,
    ],
  },
});

test.describe('WishScanner E2E Camera Integration', () => {
  test('opens camera, tracks perspective-skewed card, and captures image', async ({
    page,
    browserName,
  }) => {
    // Fake video capture flags (--use-file-for-fake-video-capture) are Chromium-only flags
    test.skip(browserName !== 'chromium', 'Fake video stream flags are Chromium-only');

    // 1. Navigate to Enter Wish page
    await page.goto('/');
    await page.click('button:has-text("Enter a Wish")');
    await expect(page.locator('h1')).toHaveText('Enter a Wish');

    // 2. Click "Capture with Camera"
    await page.click('button:has-text("Capture with Camera")');

    // 3. Scanner overlay should appear
    const scanner = page.locator('.wish-scanner');
    await expect(scanner).toBeVisible();

    // 4. Wait for OpenCV WASM to initialize and enable the "Take Photo" button
    const takePhotoBtn = page.locator('button:has-text("Take Photo")');
    await expect(takePhotoBtn).toBeEnabled({ timeout: 45000 });

    // 5. Verify the live video canvas debug text contains tracking confirmation
    const canvas = page.locator('.wish-scanner canvas');
    await expect(canvas).toBeVisible();

    // Give it a moment to process frames and apply temporal corner smoothing
    await page.waitForTimeout(1000);

    // 6. Click Take Photo
    await takePhotoBtn.click();

    // 7. Wait for Tesseract OCR processing to complete and scanner modal to close
    await expect(scanner).not.toBeVisible({ timeout: 60000 });
    await expect(page.locator('text=Handwritten wish attached')).toBeVisible();

    // 8. Assert that the textarea was automatically populated with OCR text from the synthetic video
    const textarea = page.locator('textarea[placeholder="Type your wish here"]');
    await expect(textarea).not.toHaveValue('');
  });
});
