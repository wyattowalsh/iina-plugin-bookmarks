import { test, expect } from '../fixtures/test';
import { makeBookmarksForFile, TEST_FILE_A } from '../fixtures/bookmark-data';

test.describe('Sidebar Error State Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays error toast when ERROR message received', async ({ page, harness }) => {
    await harness.sendError('Failed to load bookmarks');

    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Failed to load bookmarks');
  });

  test('displays error on failed import result', async ({ page, harness }) => {
    await harness.sendImportResult({
      success: false,
      errors: ['Invalid file format', 'Missing required fields'],
    });

    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/error|fail/i);
  });

  test('handles malformed BOOKMARKS_UPDATED gracefully', async ({ page, harness }) => {
    // Send a non-array value where an array is expected
    await harness.send('BOOKMARKS_UPDATED', 'not-an-array');

    // Page should not crash — sidebar container should still be visible
    // (Array.isArray guard in the handler ignores non-array data)
    await expect(page.locator('.bookmark-sidebar')).toBeVisible();

    // Now send valid bookmarks to confirm the UI still works
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendBookmarks(bookmarks);

    await expect(page.locator('.bookmark-item')).toHaveCount(2);
  });
});
