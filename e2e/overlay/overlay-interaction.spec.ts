import { test, expect } from '../fixtures/test';
import { makeBookmarksForFile, TEST_FILE_A, TEST_FILE_B } from '../fixtures/bookmark-data';

test.describe('Overlay Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays only bookmarks for current file', async ({ page, harness }) => {
    const fileABookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    const fileBBookmarks = makeBookmarksForFile(TEST_FILE_B, 2);
    const allBookmarks = [...fileABookmarks, ...fileBBookmarks];

    await harness.sendCurrentFile(TEST_FILE_A);
    await harness.sendBookmarks(allBookmarks);

    // Should only show 3 bookmarks from TEST_FILE_A
    await expect(page.locator('.bookmark-item')).toHaveCount(3);
    await expect(page.locator('.bookmark-item').first()).toContainText(fileABookmarks[0].title);
  });

  test('clicking bookmark sends jump message', async () => {
    test.skip(true, 'Outbound iina.postMessage capture unreliable in WebKit E2E');
  });

  test('close button hides overlay', async ({ page }) => {
    const closeButton = page.locator('[aria-label="Close bookmark overlay"]');
    await closeButton.click();

    // Overlay should be hidden (implementation-specific - could be display:none or removed from DOM)
    const overlay = page.locator('.bookmark-overlay').or(page.locator('[data-overlay]'));

    // Check if hidden via style or removed
    const isHidden =
      (await overlay.count()) === 0 ||
      (await overlay.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      }));

    expect(isHidden).toBe(true);
  });

  test('Escape key closes overlay', async ({ page }) => {
    await page.keyboard.press('Escape');

    const overlay = page.locator('.bookmark-overlay').or(page.locator('[data-overlay]'));

    const isHidden =
      (await overlay.count()) === 0 ||
      (await overlay.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      }));

    expect(isHidden).toBe(true);
  });

  test('search input visible with 4 or more bookmarks', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 4);
    await harness.sendCurrentFile(TEST_FILE_A);
    await harness.sendBookmarks(bookmarks);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('.overlay-search-input'));
    await expect(searchInput).toBeVisible();
  });

  test('search input hidden with fewer than 4 bookmarks', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendCurrentFile(TEST_FILE_A);
    await harness.sendBookmarks(bookmarks);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('.overlay-search-input'));

    // Should not be visible or not exist
    const count = await searchInput.count();
    if (count > 0) {
      await expect(searchInput).not.toBeVisible();
    } else {
      expect(count).toBe(0);
    }
  });

  test('search filters bookmarks in overlay', async ({ page, harness }) => {
    const bookmarks = [
      makeBookmarksForFile(TEST_FILE_A, 1, [['important']])[0],
      makeBookmarksForFile(TEST_FILE_A, 1, [['scene']])[0],
      makeBookmarksForFile(TEST_FILE_A, 1, [['review']])[0],
      makeBookmarksForFile(TEST_FILE_A, 1, [['draft']])[0],
    ];

    // Assign unique titles
    bookmarks[0].title = 'Opening Scene';
    bookmarks[1].title = 'Plot Development';
    bookmarks[2].title = 'Key Moment';
    bookmarks[3].title = 'Credits';

    await harness.sendCurrentFile(TEST_FILE_A);
    await harness.sendBookmarks(bookmarks);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('.overlay-search-input'));
    await searchInput.fill('Plot');

    // Only "Plot Development" should be visible
    await expect(page.locator('.bookmark-item')).toHaveCount(1);
    await expect(page.locator('.bookmark-item')).toContainText('Plot Development');
  });

  test('toast appears when bookmark is added', async ({ page, harness }) => {
    await harness.sendBookmarkAdded();

    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/added|created/i);
  });
});
