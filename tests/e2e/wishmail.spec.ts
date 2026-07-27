import { test, expect } from '@playwright/test';

test.describe('Wishmail E2E Tests', () => {
  test('should allow sending wishmail on a wish and viewing it via Wishmail Dashboard', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const wishText = `Wishmail Target Wish ${timestamp}`;
    const mailText = `Hello from E2E wishmail sender ${timestamp}`;

    // 1. Post a wish with Wishmail enabled
    await page.goto('/');
    await page.click('button:has-text("Enter a Wish")');
    await page.fill('textarea[placeholder="Type your wish here"]', wishText);

    // Enable Wishmail on the wish form
    await page.check('input[type="checkbox"]');
    await page.fill('#passphrase', 'WishmailSecret456');

    await page.click('button[type="submit"]:has-text("Submit Wish")');

    const successMsg = page.locator('.message.success');
    await expect(successMsg).toBeVisible();

    const wishIdText = await successMsg.locator('strong').first().innerText();
    const wishId = wishIdText.replace('Wish saved! ID: ', '').trim();

    // 2. Search for the wish as another user / anonymous fulfiller
    await page.click('button:has-text("Search Wishes")');
    await page.fill('input[placeholder="Search existing wishes"]', `Target Wish ${timestamp}`);
    await page.click('button[type="submit"]:has-text("Search")');

    const wishCard = page.locator('.wish-card', { hasText: wishText });
    await expect(wishCard).toBeVisible();

    // 3. Click Send Wishmail button on the card
    await wishCard.locator('button[title="Send Wishmail"]').click();

    // 4. Fill in Send Wishmail modal
    await expect(page.locator('.kiosk-modal')).toBeVisible();
    await page.fill(
      'textarea[placeholder="What would you like to say to the wish creator?"]',
      mailText
    );

    await page.click('button[type="submit"]:has-text("Send Message")');

    // Modal closes automatically after successful submission
    await expect(page.locator('.kiosk-modal')).not.toBeVisible({ timeout: 10000 });

    // 5. Navigate to Wishmail Dashboard for the wish creator
    await page.goto(`/#wishmail-dashboard?id=${wishId}&secret=WishmailSecret456`); // gitleaks:allow

    await expect(page.locator('h1')).toHaveText('Wishmail');
    await expect(page.locator(`text=${mailText}`)).toBeVisible();
  });
});
