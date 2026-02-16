import { test, expect } from '../fixtures/test';
import { SAMPLE_BOOKMARKS, TEST_FILE_A } from '../fixtures/bookmark-data';

test.describe('Visual Regression — Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('empty state', async ({ page }) => {
    await expect(page).toHaveScreenshot('sidebar-empty.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('with bookmarks', async ({ page, harness }) => {
    const fileBookmarks = SAMPLE_BOOKMARKS.filter((b) => b.filepath === TEST_FILE_A);
    await harness.sendBookmarks(fileBookmarks);
    // Wait for render
    await expect(page.locator('.bookmark-item')).toHaveCount(fileBookmarks.length);

    await expect(page).toHaveScreenshot('sidebar-with-bookmarks.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression — Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('empty state', async ({ page }) => {
    await expect(page).toHaveScreenshot('overlay-empty.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('with bookmarks', async ({ page, harness }) => {
    const fileBookmarks = SAMPLE_BOOKMARKS.filter((b) => b.filepath === TEST_FILE_A);
    await harness.sendBookmarks(fileBookmarks);
    await expect(page.locator('.bookmark-item')).toHaveCount(fileBookmarks.length);

    await expect(page).toHaveScreenshot('overlay-with-bookmarks.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression — Window', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('empty state', async ({ page }) => {
    await expect(page).toHaveScreenshot('window-empty.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('with bookmarks', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS);
    await expect(page.locator('.bookmark-item')).toHaveCount(SAMPLE_BOOKMARKS.length);

    await expect(page).toHaveScreenshot('window-with-bookmarks.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
