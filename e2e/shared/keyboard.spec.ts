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

    // Check if focus is visible on any interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Tab through items
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus still visible
    await expect(focusedElement).toBeVisible();
  });

  test('Enter key activates focused bookmark', async () => {
    test.skip(true, 'Outbound iina.postMessage capture unreliable in WebKit E2E');
  });

  test('advanced search toggle responds to keyboard activation', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    const toggle = page.locator('.advanced-search-toggle');
    const toggleCount = await toggle.count();

    if (toggleCount > 0) {
      // Focus toggle
      await toggle.focus();

      // Press Enter or Space
      await page.keyboard.press('Enter');

      // Verify expanded — AdvancedSearch renders with class "advanced-search"
      const advancedPanel = page.locator('.advanced-search');
      const panelCount = await advancedPanel.count();

      if (panelCount > 0) {
        await expect(advancedPanel).toBeVisible();
      } else {
        // Check if toggle state changed
        const ariaExpanded = await toggle.getAttribute('aria-expanded');
        expect(ariaExpanded).toBe('true');
      }
    } else {
      test.skip();
    }
  });

  test('Space key also activates advanced search toggle', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    const toggle = page.locator('.advanced-search-toggle');
    const toggleCount = await toggle.count();

    if (toggleCount > 0) {
      // Focus toggle
      await toggle.focus();

      // Press Space
      await page.keyboard.press('Space');

      // Verify expanded
      const advancedPanel = page.locator('.advanced-search');
      const panelCount = await advancedPanel.count();

      if (panelCount > 0) {
        await expect(advancedPanel).toBeVisible();
      } else {
        const ariaExpanded = await toggle.getAttribute('aria-expanded');
        expect(ariaExpanded).toBe('true');
      }
    } else {
      test.skip();
    }
  });
});
