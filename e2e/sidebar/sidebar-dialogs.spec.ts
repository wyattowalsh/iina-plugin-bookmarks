import { test, expect } from '../fixtures/test';

test.describe('Sidebar Dialog Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('import dialog opens on button click', async ({ page }) => {
    const importButton = page.locator('[aria-label="Import bookmarks from file"]');
    await importButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/import/i);
  });

  test('import dialog closes on close button click', async ({ page }) => {
    const importButton = page.locator('[aria-label="Import bookmarks from file"]');
    await importButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // ImportDialog uses className="close-btn"
    const closeButton = dialog.locator('.close-btn');
    await closeButton.click();

    await expect(dialog).not.toBeVisible();
  });

  test('import dialog closes on Escape key', async ({ page }) => {
    const importButton = page.locator('[aria-label="Import bookmarks from file"]');
    await importButton.click();

    const dialog = page.locator('[role="dialog"]');
    await page.keyboard.press('Escape');

    await expect(dialog).not.toBeVisible();
  });

  test('import success shows success toast', async ({ page, harness }) => {
    const importButton = page.locator('[aria-label="Import bookmarks from file"]');
    await importButton.click();

    // Simulate successful import
    await harness.sendImportResult({
      success: true,
      importedCount: 5,
    });

    // Verify success toast
    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/success/i);
    await expect(toast).toContainText('5');
  });

  test('import error shows error toast', async ({ page, harness }) => {
    const importButton = page.locator('[aria-label="Import bookmarks from file"]');
    await importButton.click();

    // Simulate import failure
    await harness.sendImportResult({
      success: false,
      errors: ['Invalid JSON format', 'Missing required fields'],
    });

    // Verify error toast
    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/error|failed/i);
  });

  test('export dialog opens on button click', async ({ page }) => {
    const exportButton = page.locator('[aria-label="Export bookmarks to file"]');
    await exportButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/export/i);
  });

  test('export dialog closes on Escape key', async ({ page }) => {
    const exportButton = page.locator('[aria-label="Export bookmarks to file"]');
    await exportButton.click();

    const dialog = page.locator('[role="dialog"]');
    await page.keyboard.press('Escape');

    await expect(dialog).not.toBeVisible();
  });

  test('cloud sync dialog opens on button click', async ({ page }) => {
    const cloudButton = page.locator('[aria-label="Sync bookmarks with cloud storage"]');
    await cloudButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/cloud|sync/i);
  });

  test('reconciliation dialog displays moved files', async ({ page, harness }) => {
    // FileReconciliationDialog expects MovedFile objects with: id, title, filepath, timestamp, createdAt
    const movedFiles = [
      {
        id: 'bk-1',
        title: 'Opening Scene',
        filepath: '/old/video.mp4',
        timestamp: 120,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'bk-2',
        title: 'Key Moment',
        filepath: '/old/movie.mkv',
        timestamp: 300,
        createdAt: '2024-01-02T00:00:00Z',
      },
    ];

    await harness.triggerReconciliationDialog(movedFiles);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Opening Scene');
    await expect(dialog).toContainText('Key Moment');
  });

  test('error toast displays error message', async ({ page, harness }) => {
    await harness.sendError('Test error message');

    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Test error message');
  });

  test('toast auto-dismisses after timeout', async ({ page, harness }) => {
    await harness.sendError('Auto-dismiss test');

    const toast = page.locator('.toast-container');
    await expect(toast).toBeVisible();

    // Wait for toast to disappear (typically 3-5 seconds)
    await expect(toast).not.toBeVisible({ timeout: 10000 });
  });
});
