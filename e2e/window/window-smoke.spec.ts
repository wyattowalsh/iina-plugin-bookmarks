import { test, expect } from '../fixtures/test';
import { SAMPLE_BOOKMARKS } from '../fixtures/bookmark-data';

test.describe('Window Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads and renders window container', async ({ page }) => {
    await expect(page.locator('.bookmark-window')).toBeVisible();
  });

  test('shows empty state when no bookmarks match filters', async ({ page }) => {
    await expect(page.locator('.empty-state-text')).toBeVisible();
  });

  test('harness can inject bookmarks', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS);

    await expect(page.locator('.bookmark-item')).toHaveCount(SAMPLE_BOOKMARKS.length);
  });

  test('displays bookmark titles in list', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS);

    await expect(page.locator('.bookmark-item').first()).toContainText('Opening Scene');
  });

  test('add bookmark button has correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Add new bookmark at current time"]')).toBeVisible();
  });

  test('import button has correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Import bookmarks from file"]')).toBeVisible();
  });

  test('export button has correct ARIA label', async ({ page }) => {
    await expect(page.locator('[aria-label="Export bookmarks to file"]')).toBeVisible();
  });

  test('clicking bookmark selects it and shows detail panel', async ({ page, harness }) => {
    await harness.sendBookmarks(SAMPLE_BOOKMARKS);

    await page.locator('.bookmark-item').first().click();
    await expect(page.locator('.bookmark-detail-panel')).toBeVisible();
    await expect(page.locator('.details-view')).toContainText('Opening Scene');
  });
});
