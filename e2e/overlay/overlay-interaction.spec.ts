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

  test('clicking bookmark sends jump message', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendCurrentFile(TEST_FILE_A);
    await harness.sendBookmarks(bookmarks);
    await expect(page.locator('.bookmark-item')).toHaveCount(2);
    await harness.clearOutbound();

    await page.locator('.bookmark-item').first().click();
    await page.waitForFunction(() => {
      const outbound = (window as unknown as { __iinaOutbound?: Array<{ type?: string }> })
        .__iinaOutbound;
      return Array.isArray(outbound) && outbound.some((m) => m.type === 'JUMP_TO_BOOKMARK');
    });

    const jumpMessage = await harness.getLastOutbound('JUMP_TO_BOOKMARK');
    expect(jumpMessage?.data).toEqual({ id: bookmarks[0].id });
  });

  test('close button hides overlay', async ({ page }) => {
    const closeButton = page.locator('[aria-label="Close bookmark overlay"]');
    await closeButton.click();

    const overlay = page.locator('.bookmark-overlay').or(page.locator('[data-overlay]'));
    await expect(overlay).not.toBeVisible();
  });

  test('Escape key closes overlay', async ({ page }) => {
    await page.keyboard.press('Escape');

    const overlay = page.locator('.bookmark-overlay').or(page.locator('[data-overlay]'));
    await expect(overlay).not.toBeVisible();
  });

  test('search input visible when bookmarks are available', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendCurrentFile(TEST_FILE_A);
    await harness.sendBookmarks(bookmarks);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('.overlay-search-input'));
    await expect(searchInput).toBeVisible();
  });

  test('search input hidden when no bookmarks are available', async ({ page }) => {
    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('.overlay-search-input'));
    await expect(searchInput).not.toBeVisible();
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
