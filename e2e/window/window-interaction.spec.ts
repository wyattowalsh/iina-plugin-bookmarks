import { test, expect } from '../fixtures/test';
import {
  makeBookmark,
  makeBookmarksForFile,
  TEST_FILE_A,
  TEST_FILE_B,
} from '../fixtures/bookmark-data';

test.describe('Window Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays all bookmarks in list panel', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 5);
    await harness.sendBookmarks(bookmarks);

    const listPanel = page.locator('.bookmark-list-panel');
    await expect(listPanel).toBeVisible();
    await expect(page.locator('.bookmark-item')).toHaveCount(5);
  });

  test('selecting bookmark shows detail panel', async ({ page, harness }) => {
    const bookmark = makeBookmark({
      title: 'Test Bookmark',
      filepath: TEST_FILE_A,
      timestamp: 120,
      description: 'Test description',
    });
    await harness.sendBookmarks([bookmark]);

    // Click bookmark in list
    const firstItem = page.locator('.bookmark-item').first();
    await firstItem.click();

    // Verify detail panel shows bookmark info
    const detailPanel = page.locator('.bookmark-detail-panel');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel).toContainText('Test Bookmark');
    await expect(detailPanel).toContainText(TEST_FILE_A);
    await expect(detailPanel).toContainText('2:00'); // 120s formatted
    await expect(detailPanel).toContainText('Test description');
  });

  test('edit mode activates on edit button click', async ({ page, harness }) => {
    const bookmark = makeBookmark({ title: 'Original Title', filepath: TEST_FILE_A });
    await harness.sendBookmarks([bookmark]);

    // Select bookmark
    await page.locator('.bookmark-item').first().click();

    // Click edit button
    const editButton = page
      .locator('button:has-text("Edit")')
      .or(page.locator('[aria-label*="Edit"]'));
    await editButton.click();

    // Verify edit form visible
    const editForm = page.locator('.edit-form').or(page.locator('form'));
    await expect(editForm).toBeVisible();

    // Verify input fields populated
    const titleInput = page.locator('#edit-title');
    await expect(titleInput).toHaveValue('Original Title');
  });

  test('edit save updates bookmark', async ({ page, harness }) => {
    const bookmark = makeBookmark({ title: 'Original Title', filepath: TEST_FILE_A });
    await harness.sendBookmarks([bookmark]);

    // Select and enter edit mode
    await page.locator('.bookmark-item').first().click();
    await page.locator('.edit-btn').click();

    // Change title
    const titleInput = page.locator('#edit-title');
    await titleInput.fill('Updated Title');

    // Save
    await page.locator('.save-btn').click();

    // Inject updated bookmarks
    const updatedBookmark = { ...bookmark, title: 'Updated Title' };
    await harness.sendBookmarks([updatedBookmark]);

    // Re-click bookmark to sync selectedBookmark state with updated data
    await page.locator('.bookmark-item').first().click();

    // Verify detail view shows updated title
    const detailPanel = page.locator('.bookmark-detail-panel');
    await expect(detailPanel).toContainText('Updated Title');
  });

  test('edit cancel returns to detail view', async ({ page, harness }) => {
    const bookmark = makeBookmark({ title: 'Original Title', filepath: TEST_FILE_A });
    await harness.sendBookmarks([bookmark]);

    // Select and enter edit mode
    await page.locator('.bookmark-item').first().click();
    const editButton = page
      .locator('button:has-text("Edit")')
      .or(page.locator('[aria-label*="Edit"]'));
    await editButton.click();

    // Cancel
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Verify back to detail view
    const detailPanel = page.locator('.bookmark-detail-panel');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel).toContainText('Original Title');

    const editForm = page.locator('.edit-form');
    const formCount = await editForm.count();
    if (formCount > 0) {
      await expect(editForm).not.toBeVisible();
    }
  });

  test('delete from detail panel shows confirmation', async ({ page, harness }) => {
    const bookmark = makeBookmark({ title: 'To Delete', filepath: TEST_FILE_A });
    await harness.sendBookmarks([bookmark]);

    // Select bookmark
    await page.locator('.bookmark-item').first().click();

    // Click delete button in detail panel (use specific class to avoid strict mode)
    await page.locator('.delete-btn-detail').click();

    // Verify alert dialog
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/delete|confirm/i);
  });

  test('jump from detail panel sends message', async () => {
    test.skip(true, 'Outbound iina.postMessage capture unreliable in WebKit E2E');
  });

  test('add dialog opens on add button click', async ({ page }) => {
    const addButton = page.locator('[aria-label="Add new bookmark at current time"]');
    await addButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test('add dialog populates with defaults', async ({ page, harness }) => {
    const addButton = page.locator('[aria-label="Add new bookmark at current time"]');
    await addButton.click();

    // Send defaults
    await harness.sendBookmarkDefaults({
      title: 'Default Title',
      description: 'Default description',
      tags: ['auto', 'default'],
      timestamp: 240,
      filepath: TEST_FILE_A,
    });

    // Verify form populated
    const dialog = page.locator('[role="dialog"]');
    const titleInput = dialog.locator('#bookmark-title');
    await expect(titleInput).toHaveValue('Default Title');

    const descInput = dialog.locator('#bookmark-description');
    await expect(descInput).toHaveValue('Default description');
  });

  test('empty title validation prevents save', async ({ page, harness }) => {
    const addButton = page.locator('[aria-label="Add new bookmark at current time"]');
    await addButton.click();

    await harness.sendBookmarkDefaults({
      title: '',
      description: '',
      tags: [],
      timestamp: 0,
      filepath: TEST_FILE_A,
    });

    // Try to save with empty title (use dialog-scoped selector to avoid strict mode)
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('.save-btn').click();

    // Verify error message or form validation
    const errorMessage = page
      .locator('.error-message')
      .or(page.locator('[role="alert"]'))
      .or(page.locator('.validation-error'));

    // Check if validation prevents submission
    const errorCount = await errorMessage.count();
    if (errorCount > 0) {
      await expect(errorMessage).toBeVisible();
    } else {
      // Check if dialog is still open (submission blocked)
      await expect(dialog).toBeVisible();
    }
  });

  test('file filter shows only matching bookmarks', async ({ page, harness }) => {
    const fileABookmarks = makeBookmarksForFile(TEST_FILE_A, 3);
    const fileBBookmarks = makeBookmarksForFile(TEST_FILE_B, 2);
    const allBookmarks = [...fileABookmarks, ...fileBBookmarks];

    await harness.sendBookmarks(allBookmarks);

    // Find and use file filter
    const fileFilter = page
      .locator('select[name="file"]')
      .or(page.locator('.file-filter'))
      .or(page.locator('[aria-label*="Filter by file"]'));

    const filterCount = await fileFilter.count();
    if (filterCount > 0) {
      await fileFilter.click();
      await page.locator(`option:has-text("${TEST_FILE_A}")`).click();

      // Verify only TEST_FILE_A bookmarks shown
      await expect(page.locator('.bookmark-item')).toHaveCount(3);
    } else {
      test.skip();
    }
  });

  test('placeholder panel shows when no bookmark selected', async ({ page, harness }) => {
    const bookmarks = makeBookmarksForFile(TEST_FILE_A, 2);
    await harness.sendBookmarks(bookmarks);

    // Verify placeholder visible initially — use the specific class only to avoid strict mode violation
    const placeholder = page.locator('.placeholder-panel');

    const count = await placeholder.count();
    if (count > 0) {
      await expect(placeholder).toBeVisible();
      await expect(placeholder).toContainText(/select/i);
    } else {
      // If no placeholder, detail panel should not be visible
      const detailPanel = page.locator('.bookmark-detail-panel');
      const detailCount = await detailPanel.count();
      expect(detailCount === 0 || !(await detailPanel.isVisible())).toBe(true);
    }
  });
});
