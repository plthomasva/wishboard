import { test, expect } from '@playwright/test';

test.describe('Wish Manage & Passphrase Flow E2E Tests', () => {
  test('should create wish, edit wish content via passphrase, deactivate and reactivate', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const originalText = `Manageable Wish original text ${timestamp}`;
    const updatedText = `Manageable Wish UPDATED text ${timestamp}`;

    // 1. Enter wish anonymously with passphrase
    await page.goto('/');
    await page.click('button:has-text("Enter a Wish")');
    await page.fill('textarea[placeholder="Type your wish here"]', originalText);
    await page.fill('#passphrase', 'SecretPassphrase123');
    await page.click('button[type="submit"]:has-text("Submit Wish")');

    const successMsg = page.locator('.message.success');
    await expect(successMsg).toBeVisible();

    // Extract wish ID
    const wishIdText = await successMsg.locator('strong').first().innerText();
    const wishId = wishIdText.replace('Wish saved! ID: ', '').trim();

    // 2. Navigate directly to Manage Wish page with hash parameters
    await page.goto(`/#manage-wish?id=${wishId}&secret=SecretPassphrase123`); // gitleaks:allow

    await expect(page.locator('h1')).toHaveText('Manage Your Wish');
    await expect(page.locator('textarea[placeholder="Type your wish here"]')).toHaveValue(
      originalText
    );

    // 3. Edit wish content
    await page.fill('textarea[placeholder="Type your wish here"]', updatedText);
    await page.click('button[type="submit"]:has-text("Save Changes")');

    await expect(page.locator('.message.success')).toContainText('Wish updated successfully!');

    // 4. Deactivate wish
    await page.click('button:has-text("Deactivate Wish")');
    await expect(page.locator('.message.success')).toContainText('Wish deactivated successfully.');

    // 5. Search for updated wish — should NOT appear while deactivated
    await page.click('button:has-text("Search Wishes")');
    await page.fill('input[placeholder="Search existing wishes"]', `UPDATED text ${timestamp}`);
    await page.click('button[type="submit"]:has-text("Search")');

    await expect(page.locator('.wish-card', { hasText: updatedText })).not.toBeVisible();

    // 6. Reactivate wish from Manage Wish page
    await page.goto(`/#manage-wish?id=${wishId}&secret=SecretPassphrase123`); // gitleaks:allow
    await page.click('button:has-text("Reactivate Wish")');
    await expect(page.locator('.message.success')).toContainText('Wish reactivated successfully.', {
      timeout: 10000,
    });

    // 7. Search again — wish should now be visible
    await page.click('button:has-text("Search Wishes")');
    await page.fill('input[placeholder="Search existing wishes"]', `UPDATED text ${timestamp}`);
    await page.click('button[type="submit"]:has-text("Search")');

    await expect(page.locator('.wish-card', { hasText: updatedText })).toBeVisible();
  });
});
