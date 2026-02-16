import { test, expect } from '../fixtures/test';
import { SAMPLE_BOOKMARKS, TEST_FILE_A } from '../fixtures/bookmark-data';

test.describe('Overlay Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads and renders overlay container', async ({ page }) => {
    await expect(page.locator('.bookmark-overlay')).toBeVisible();
  });

  test('shows empty state initially', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('harness can inject bookmarks', async ({ page, harness }) => {
    const fileBookmarks = SAMPLE_BOOKMARKS.filter((b) => b.filepath === TEST_FILE_A);
    await harness.sendBookmarks(fileBookmarks);

    await expect(page.locator('.bookmark-item')).toHaveCount(fileBookmarks.length);
  });

  test('displays bookmark count in header', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS.slice(0, 3));

    await expect(page.locator('.bookmark-overlay-header')).toContainText('Bookmarks (3)');
  });

  test('close button has correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Close bookmark overlay"]')).toBeVisible();
  });

  test('close button hides overlay', async ({ page }) => {
    await page.locator('[aria-label="Close bookmark overlay"]').click();
    await expect(page.locator('.bookmark-overlay')).not.toBeVisible();
  });

  test('shows toast on error message', async ({ page, harness }) => {
    await harness.sendError('Something went wrong');

    await expect(page.locator('.toast-container')).toBeVisible();
  });
});
