import { test, expect } from '../fixtures/test';
import { SAMPLE_BOOKMARKS, TEST_FILE_A } from '../fixtures/bookmark-data';

test.describe('Sidebar Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads and renders sidebar container', async ({ page }) => {
    await expect(page.locator('.bookmark-sidebar')).toBeVisible();
  });

  test('shows empty state initially', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('harness can inject bookmarks', async ({ page, harness }) => {
    const fileBookmarks = SAMPLE_BOOKMARKS.filter((b) => b.filepath === TEST_FILE_A);
    await harness.sendBookmarks(fileBookmarks);

    await expect(page.locator('.bookmark-item')).toHaveCount(fileBookmarks.length);
  });

  test('displays bookmark titles', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS.slice(0, 2));

    await expect(page.locator('.bookmark-item').first()).toContainText('Opening Scene');
  });

  test('displays bookmark tags', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS.slice(0, 1));

    await expect(page.locator('.bookmark-tag')).toHaveCount(2); // 'important', 'scene'
  });

  test('add bookmark button exists with correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Add new bookmark at current time"]')).toBeVisible();
  });

  test('import button exists with correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Import bookmarks from file"]')).toBeVisible();
  });

  test('export button exists with correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Export bookmarks to file"]')).toBeVisible();
  });

  test('cloud sync button exists with correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Sync bookmarks with cloud storage"]')).toBeVisible();
  });
});
