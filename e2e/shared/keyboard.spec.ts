import { test, expect } from '../fixtures/test';
import { makeBookmarksForFile, TEST_FILE_A } from '../fixtures/bookmark-data';

test.describe('Keyboard and Accessibility Tests', () => {
  // Run against sidebar only (port 1234)
  test.use({ baseURL: 'http://localhost:1234' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Escape key closes delete confirmation dialog', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendBookmarks(bookmarks);

    // Open delete dialog
    const firstItem = page.locator('.bookmark-item').first();
    await firstItem.locator('[aria-label*="Delete"]').click();

    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify closed
    await expect(dialog).not.toBeVisible();
  });

  test('Tab key moves focus through bookmark items', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    // Start tabbing
    await page.keyboard.press('Tab');

    // Verify focus landed on an interactive element within the app
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
    expect(['button', 'input', 'a', 'div', 'li'].includes(tagName)).toBe(true);

    // Tab again and verify focus moved to a different element
    const firstFocusedText = await focused.textContent();
    await page.keyboard.press('Tab');
    const focused2 = page.locator(':focus');
    await expect(focused2).toBeVisible();
    const secondFocusedText = await focused2.textContent();
    expect(secondFocusedText).not.toBe(firstFocusedText);
  });

  test('Enter key activates focused bookmark', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendBookmarks(bookmarks);
    await expect(page.locator('.bookmark-item')).toHaveCount(2);
    await harness.clearOutbound();

    await page.locator('.bookmark-item').first().focus();
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => {
      const outbound = (window as unknown as { __iinaOutbound?: Array<{ type?: string }> })
        .__iinaOutbound;
      return Array.isArray(outbound) && outbound.some((m) => m.type === 'JUMP_TO_BOOKMARK');
    });

    const jumpMessage = await harness.getLastOutbound('JUMP_TO_BOOKMARK');
    expect(jumpMessage?.data).toEqual({ id: bookmarks[0].id });
  });

  test('advanced search toggle responds to keyboard activation', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    const toggle = page.locator('.advanced-search-toggle');
    if ((await toggle.count()) === 0) {
      test.skip(true, 'Advanced search toggle not available in this UI');
    }
    await expect(toggle).toBeVisible();
    await toggle.focus();
    await page.keyboard.press('Enter');

    const advancedPanel = page.locator('.advanced-search');
    await expect(advancedPanel).toBeVisible();
  });

  test('Space key also activates advanced search toggle', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    const toggle = page.locator('.advanced-search-toggle');
    if ((await toggle.count()) === 0) {
      test.skip(true, 'Advanced search toggle not available in this UI');
    }
    await expect(toggle).toBeVisible();
    await toggle.focus();
    await page.keyboard.press('Space');

    const advancedPanel = page.locator('.advanced-search');
    await expect(advancedPanel).toBeVisible();
  });
});
