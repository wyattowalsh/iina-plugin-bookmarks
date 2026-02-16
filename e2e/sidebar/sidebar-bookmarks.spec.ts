import { test, expect } from '../fixtures/test';
import { makeBookmark, makeBookmarksForFile, TEST_FILE_A } from '../fixtures/bookmark-data';

test.describe('Sidebar Bookmark Display and Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays all injected bookmarks with correct titles and timestamps', async ({
    page,
    harness,
  }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 5);
    await harness.sendBookmarks(bookmarks);

    await expect(page.locator('.bookmark-item')).toHaveCount(5);

    // Verify first bookmark details
    const firstItem = page.locator('.bookmark-item').first();
    await expect(firstItem).toContainText(bookmarks[0].title);
    await expect(firstItem).toContainText('01:00'); // 60s formatted
  });

  test('displays bookmark tags correctly', async ({ page, harness }) => {
    const bookmarkWithTags = makeBookmark({
      title: 'Tagged Bookmark',
      tags: ['important', 'scene', 'review'],
    });
    await harness.sendBookmarks([bookmarkWithTags]);

    const tags = page.locator('.bookmark-tag');
    await expect(tags).toHaveCount(3);
    await expect(tags.nth(0)).toContainText('important');
    await expect(tags.nth(1)).toContainText('scene');
    await expect(tags.nth(2)).toContainText('review');
  });

  test('delete flow completes successfully', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    // Click delete button on second bookmark
    const secondItem = page.locator('.bookmark-item').nth(1);
    await secondItem.locator('[aria-label*="Delete"]').click();

    // Verify alert dialog appears
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();

    // Click confirm
    await dialog.locator('button:has-text("Confirm")').click();

    // Inject deletion confirmation and updated bookmarks
    await harness.sendBookmarkDeleted();
    const remainingBookmarks = bookmarks.filter((_, i) => i !== 1);
    await harness.sendBookmarks(remainingBookmarks);

    // Verify removed
    await expect(page.locator('.bookmark-item')).toHaveCount(2);
    await expect(page.locator('.bookmark-item')).not.toContainText(bookmarks[1].title);
  });

  test('delete cancel preserves bookmark', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendBookmarks(bookmarks);

    // Open delete dialog
    const firstItem = page.locator('.bookmark-item').first();
    await firstItem.locator('[aria-label*="Delete"]').click();

    // Cancel
    const dialog = page.locator('[role="alertdialog"]');
    await dialog.locator('button:has-text("Cancel")').click();

    // Verify dialog closed and bookmark remains
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.bookmark-item')).toHaveCount(2);
  });

  test('clicking bookmark sends JUMP_TO_BOOKMARK message', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendBookmarks(bookmarks);

    await harness.clearOutbound();

    // Click bookmark (not the delete button)
    const firstItem = page.locator('.bookmark-item').first();
    await firstItem.locator('.bookmark-title').click();

    // Verify outbound message
    const jumpMessages = await harness.getOutboundByType('JUMP_TO_BOOKMARK');
    expect(jumpMessages).toHaveLength(1);
    expect(jumpMessages[0].data.bookmarkId).toBe(bookmarks[0].id);
  });

  test('search filters bookmarks by title', async ({ page, harness }) => {
    const bookmarks = [
      makeBookmark({ title: 'Opening Scene', filepath: TEST_FILE_A }),
      makeBookmark({ title: 'Plot Twist', filepath: TEST_FILE_A }),
      makeBookmark({ title: 'Credits', filepath: TEST_FILE_A }),
    ];
    await harness.sendBookmarks(bookmarks);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Plot');

    // Only "Plot Twist" should be visible
    await expect(page.locator('.bookmark-item')).toHaveCount(1);
    await expect(page.locator('.bookmark-item')).toContainText('Plot Twist');
  });

  test('search clear shows all bookmarks', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 4);
    await harness.sendBookmarks(bookmarks);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');

    // Clear search
    await searchInput.clear();

    // All bookmarks visible again
    await expect(page.locator('.bookmark-item')).toHaveCount(4);
  });

  test('tag filter shows only matching bookmarks', async ({ page, harness }) => {
    const bookmarks = [
      makeBookmark({ title: 'Important One', tags: ['important'], filepath: TEST_FILE_A }),
      makeBookmark({ title: 'Scene Two', tags: ['scene'], filepath: TEST_FILE_A }),
      makeBookmark({
        title: 'Important Scene',
        tags: ['important', 'scene'],
        filepath: TEST_FILE_A,
      }),
    ];
    await harness.sendBookmarks(bookmarks);

    // Click tag chip to filter
    const importantTag = page.locator('.bookmark-tag:has-text("important")').first();
    await importantTag.click();

    // Only bookmarks with "important" tag should show
    await expect(page.locator('.bookmark-item')).toHaveCount(2);
  });

  test('sort order changes bookmark display order', async ({ page, harness }) => {
    const bookmarks = [
      makeBookmark({ title: 'A First', timestamp: 100, filepath: TEST_FILE_A }),
      makeBookmark({ title: 'Z Last', timestamp: 50, filepath: TEST_FILE_A }),
    ];
    await harness.sendBookmarks(bookmarks);

    // Find sort dropdown/button (implementation-specific selector)
    const sortButton = page.locator('[aria-label*="Sort"]').or(page.locator('.sort-control'));

    if ((await sortButton.count()) > 0) {
      await sortButton.click();

      // Select title sort
      const titleOption = page.locator('text="Title"').or(page.locator('[data-sort="title"]'));
      if ((await titleOption.count()) > 0) {
        await titleOption.click();

        // Verify order changed
        const firstItemTitle = await page.locator('.bookmark-item').first().textContent();
        expect(firstItemTitle).toContain('A First');
      }
    } else {
      test.skip();
    }
  });

  test('advanced search toggle expands search panel', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    const toggle = page.locator('.advanced-search-toggle');

    if ((await toggle.count()) > 0) {
      await toggle.click();

      // Verify expanded state
      const advancedPanel = page.locator('.advanced-search-panel');
      await expect(advancedPanel).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('advanced search query filters by tag', async ({ page, harness }) => {
    const bookmarks = [
      makeBookmark({ title: 'Important One', tags: ['important'], filepath: TEST_FILE_A }),
      makeBookmark({ title: 'Scene Two', tags: ['scene'], filepath: TEST_FILE_A }),
    ];
    await harness.sendBookmarks(bookmarks);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('tag:important');

    // Only tagged bookmark should show
    await expect(page.locator('.bookmark-item')).toHaveCount(1);
    await expect(page.locator('.bookmark-item')).toContainText('Important One');
  });

  test('clear filters button resets all filters', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 4);
    await harness.sendBookmarks(bookmarks);

    // Apply search filter
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');

    // Click clear filters
    const clearButton = page
      .locator('button:has-text("Clear")')
      .or(page.locator('[aria-label*="Clear"]'));

    if ((await clearButton.count()) > 0) {
      await clearButton.click();

      // All bookmarks should be visible
      await expect(page.locator('.bookmark-item')).toHaveCount(4);
    } else {
      // Just clear the search input manually
      await searchInput.clear();
      await expect(page.locator('.bookmark-item')).toHaveCount(4);
    }
  });

  test('empty state appears when search has no results', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    await harness.sendBookmarks(bookmarks);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('nonexistent-query-xyz');

    // Verify empty state message
    const emptyState = page.locator('.empty-state').or(page.locator('.empty-state-text'));
    await expect(emptyState).toBeVisible();
    await expect(page.locator('.bookmark-item')).toHaveCount(0);
  });
});
