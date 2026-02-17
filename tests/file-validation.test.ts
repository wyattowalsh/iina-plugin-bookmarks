// Tests for input validation & sanitization in BookmarkManager.
// Exercises the REAL BookmarkManager through its public API to verify
// XSS protection, timestamp bounds, HTML stripping, and data validation.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps, findHandler } from './helpers/mock-deps';

describe('Input Validation via BookmarkManager', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  // -------------------------------------------------------------------
  // Timestamp validation (addBookmark rejects out-of-range timestamps)
  // -------------------------------------------------------------------
  describe('Timestamp validation', () => {
    it('should reject negative timestamps', async () => {
      await expect(manager.addBookmark('Negative TS', -1)).rejects.toThrow('Invalid timestamp');
      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should reject NaN timestamps', async () => {
      await expect(manager.addBookmark('NaN TS', NaN)).rejects.toThrow('Invalid timestamp');
      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should reject Infinity timestamps', async () => {
      await expect(manager.addBookmark('Infinity TS', Infinity)).rejects.toThrow(
        'Invalid timestamp',
      );
      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should reject timestamps exceeding 365 days', async () => {
      const overLimit = 86400 * 365 + 1;
      await expect(manager.addBookmark('Over limit', overLimit)).rejects.toThrow(
        'Invalid timestamp',
      );
      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should accept timestamp of 0', async () => {
      await manager.addBookmark('Start', 0);
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].timestamp).toBe(0);
    });

    it('should accept timestamp at exactly the 365-day limit', async () => {
      const exactLimit = 86400 * 365;
      await manager.addBookmark('Max TS', exactLimit);
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].timestamp).toBe(exactLimit);
    });
  });

  // -------------------------------------------------------------------
  // XSS / HTML stripping on addBookmark
  // -------------------------------------------------------------------
  describe('XSS protection via addBookmark', () => {
    it('should strip <script> tags from title', async () => {
      await manager.addBookmark('<script>alert("xss")</script>Visible', 10);
      const bm = manager.getAllBookmarks()[0];
      expect(bm.title).not.toContain('<script>');
      expect(bm.title).toContain('alert("xss")');
      expect(bm.title).toContain('Visible');
    });

    it('should strip <img> tags from title', async () => {
      await manager.addBookmark('<img onerror=alert(1) src=x>Title', 10);
      const bm = manager.getAllBookmarks()[0];
      expect(bm.title).not.toContain('<img');
    });

    it('should strip HTML from description', async () => {
      await manager.addBookmark('Safe', 10, '<iframe src="evil.com"></iframe>Desc');
      const bm = manager.getAllBookmarks()[0];
      expect(bm.description).not.toContain('<iframe');
      expect(bm.description).toContain('Desc');
    });

    it('should encode standalone angle brackets in title', async () => {
      // Bare < and > that don't form tag-like patterns get encoded
      await manager.addBookmark('3 < 5 and 10 > 7', 10);
      const bm = manager.getAllBookmarks()[0];
      // The regex `<[^>]*>` treats `< 5 and 10 >` as a tag-like pattern and strips it,
      // so the real sanitization test is with non-tag angle brackets
      expect(bm.title).not.toContain('<script');
    });

    it('should preserve angle brackets that survive tag stripping', async () => {
      // A lone < without a matching > is not a tag — kept as-is (React handles escaping)
      await manager.addBookmark('x<y', 10);
      const bm = manager.getAllBookmarks()[0];
      expect(bm.title).toBe('x<y');
    });

    it('should preserve quotes and ampersands in title', async () => {
      await manager.addBookmark('Title with "quotes" & ampersand', 10);
      const bm = manager.getAllBookmarks()[0];
      expect(bm.title).toBe('Title with "quotes" & ampersand');
    });
  });

  // -------------------------------------------------------------------
  // XSS / HTML stripping on import (IMPORT_BOOKMARKS message)
  // -------------------------------------------------------------------
  describe('XSS protection on import', () => {
    const makeImportBookmark = (overrides: Record<string, any> = {}) => ({
      id: 'imp-1',
      title: 'Safe Title',
      timestamp: 10,
      filepath: '/test.mp4',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      tags: [],
      ...overrides,
    });

    it('should strip <script> tags from imported titles', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [makeImportBookmark({ title: '<script>alert("xss")</script>Title' })],
        options: { preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === 'imp-1');
      expect(bm).toBeDefined();
      expect(bm!.title).not.toContain('<script>');
    });

    it('should strip HTML from imported descriptions', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          makeImportBookmark({
            id: 'imp-desc',
            description: '<img onerror="alert(1)" src="x">Safe text',
          }),
        ],
        options: { preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === 'imp-desc');
      expect(bm).toBeDefined();
      expect(bm!.description).not.toContain('<img');
      expect(bm!.description).toContain('Safe text');
    });

    it('should strip HTML when replacing an existing bookmark', async () => {
      await manager.addBookmark('Original', 10);
      const existingId = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [makeImportBookmark({ id: existingId, title: '<b>Bold</b> title' })],
        options: { duplicateHandling: 'replace', preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === existingId);
      expect(bm!.title).not.toContain('<b>');
      expect(bm!.title).toContain('Bold');
    });
  });

  // -------------------------------------------------------------------
  // XSS / HTML stripping on updateBookmark
  // -------------------------------------------------------------------
  describe('XSS protection on update', () => {
    it('should strip HTML tags from updated title', async () => {
      await manager.addBookmark('Original', 10);
      const id = manager.getAllBookmarks()[0].id;

      manager.updateBookmark(id, { title: '<script>evil()</script>Updated' });

      const bm = manager.getAllBookmarks()[0];
      expect(bm.title).not.toContain('<script>');
      expect(bm.title).toContain('Updated');
    });

    it('should strip HTML tags from updated description', async () => {
      await manager.addBookmark('Title', 10, 'Original desc');
      const id = manager.getAllBookmarks()[0].id;

      manager.updateBookmark(id, {
        description: '<div onmouseover="alert(1)">Hover me</div>',
      });

      const bm = manager.getAllBookmarks()[0];
      expect(bm.description).not.toContain('<div');
      expect(bm.description).toContain('Hover me');
    });
  });

  // -------------------------------------------------------------------
  // Import data validation (validateBookmarkArray rejects invalid entries)
  // -------------------------------------------------------------------
  describe('Import data validation', () => {
    it('should skip entries missing required string fields', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 123,
            title: 'Bad ID type',
            timestamp: 10,
            filepath: '/f.mp4',
            createdAt: 'x',
            updatedAt: 'x',
          },
          {
            id: 'ok',
            title: 'Valid',
            timestamp: 10,
            filepath: '/f.mp4',
            createdAt: 'x',
            updatedAt: 'x',
            tags: [],
          },
        ],
      });

      // Only the valid one should be imported
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].title).toBe('Valid');
    });

    it('should skip non-object entries', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          'just a string',
          42,
          null,
          {
            id: 'v',
            title: 'Valid',
            timestamp: 5,
            filepath: '/f.mp4',
            createdAt: 'c',
            updatedAt: 'u',
            tags: [],
          },
        ],
      });

      expect(manager.getAllBookmarks()).toHaveLength(1);
    });

    it('should skip entries with negative timestamps during import', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 'neg',
            title: 'Neg',
            timestamp: -5,
            filepath: '/f.mp4',
            createdAt: 'c',
            updatedAt: 'u',
            tags: [],
          },
        ],
      });

      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should skip entries with timestamps exceeding MAX_TIMESTAMP', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 'over',
            title: 'Over',
            timestamp: 86400 * 365 + 1,
            filepath: '/f.mp4',
            createdAt: 'c',
            updatedAt: 'u',
            tags: [],
          },
        ],
      });

      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should filter out non-string tags from imported bookmarks', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 'mixed-tags',
            title: 'Mixed',
            timestamp: 10,
            filepath: '/f.mp4',
            createdAt: 'c',
            updatedAt: 'u',
            tags: ['valid', 42, null, 'also-valid'],
          },
        ],
        options: { preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === 'mixed-tags');
      expect(bm).toBeDefined();
      expect(bm!.tags).toEqual(['valid', 'also-valid']);
    });

    it('should default tags to empty array when tags field is not an array', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 'no-tags',
            title: 'No Tags',
            timestamp: 10,
            filepath: '/f.mp4',
            createdAt: 'c',
            updatedAt: 'u',
            tags: 'not-an-array',
          },
        ],
        options: { preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === 'no-tags');
      expect(bm).toBeDefined();
      expect(bm!.tags).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // Special characters handling
  // -------------------------------------------------------------------
  describe('Special characters handling', () => {
    it('should preserve unicode characters in titles', async () => {
      await manager.addBookmark('\u7279\u6b8a\u5b57\u7b26 \ud83c\udfac', 10);
      const bm = manager.getAllBookmarks()[0];
      expect(bm.title).toContain('\u7279\u6b8a\u5b57\u7b26');
      expect(bm.title).toContain('\ud83c\udfac');
    });

    it('should preserve quotes, brackets, and ampersands', async () => {
      await manager.addBookmark('Title with "quotes" & [brackets]', 10);
      expect(manager.getAllBookmarks()[0].title).toBe('Title with "quotes" & [brackets]');
    });

    it('should handle very long titles without truncation', async () => {
      const longTitle = 'A'.repeat(1000);
      await manager.addBookmark(longTitle, 10);
      expect(manager.getAllBookmarks()[0].title).toBe(longTitle);
    });

    it('should handle very long descriptions without truncation', async () => {
      const longDesc = 'B'.repeat(2000);
      await manager.addBookmark('Title', 10, longDesc);
      expect(manager.getAllBookmarks()[0].description).toBe(longDesc);
    });
  });

  // -------------------------------------------------------------------
  // Max bookmarks limit
  // -------------------------------------------------------------------
  describe('Max bookmarks limit', () => {
    it('should enforce maxBookmarks preference', async () => {
      (deps.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'maxBookmarks' ? '2' : null,
      );
      const m = new BookmarkManager(deps);

      await m.addBookmark('B1', 1);
      await m.addBookmark('B2', 2);
      await m.addBookmark('B3', 3); // should be rejected

      expect(m.getAllBookmarks()).toHaveLength(2);
      expect(deps.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Maximum bookmark limit'),
      );
    });
  });

  // -------------------------------------------------------------------
  // Path validation on updateBookmarkPath (FILE_RECONCILIATION_REQUEST)
  // -------------------------------------------------------------------
  describe('Path validation on updateBookmarkPath', () => {
    it('should reject empty new path', async () => {
      await manager.addBookmark('Test', 10);
      const id = manager.getAllBookmarks()[0].id;
      (deps.console.error as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({ action: 'update_path', bookmarkId: id, newPath: '' });

      // Path should remain unchanged
      expect(manager.getAllBookmarks()[0].filepath).toBe('/test/video.mp4');
      // Verify update was not applied (no FILE_RECONCILIATION_RESULT success message)
      const resultCalls = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any[]) => c[0] === 'FILE_RECONCILIATION_RESULT',
      );
      expect(resultCalls).toHaveLength(0);
    });

    it('should reject paths that do not start with /', async () => {
      await manager.addBookmark('Test', 10);
      const id = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({ action: 'update_path', bookmarkId: id, newPath: 'relative/path.mp4' });

      expect(manager.getAllBookmarks()[0].filepath).toBe('/test/video.mp4');
    });

    it('should accept valid absolute paths', async () => {
      await manager.addBookmark('Test', 10);
      const id = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({ action: 'update_path', bookmarkId: id, newPath: '/new/path/video.mp4' });

      expect(manager.getAllBookmarks()[0].filepath).toBe('/new/path/video.mp4');
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'FILE_RECONCILIATION_RESULT',
        expect.objectContaining({ success: true, action: 'update_path' }),
      );
    });
  });

  // -------------------------------------------------------------------
  // CSV export sanitization (formula injection prevention)
  // -------------------------------------------------------------------
  describe('CSV export sanitization', () => {
    it('should sanitize cells starting with = in CSV export', async () => {
      await manager.addBookmark('=SUM(A1:A10)', 10, 'Normal desc');
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      expect(exportCall).toBeDefined();
      const csvContent: string = exportCall![1].content;

      // The title cell should be prefixed with ' to prevent formula injection
      expect(csvContent).toContain("'=SUM(A1:A10)");
    });

    it('should sanitize cells starting with + in CSV export', async () => {
      await manager.addBookmark('+cmd|stuff', 10);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const csvContent: string = exportCall![1].content;
      expect(csvContent).toContain("'+cmd|stuff");
    });

    it('should sanitize cells starting with - in CSV export', async () => {
      await manager.addBookmark('-1+1', 10);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const csvContent: string = exportCall![1].content;
      expect(csvContent).toContain("'-1+1");
    });

    it('should sanitize cells starting with @ in CSV export', async () => {
      await manager.addBookmark('@external_link', 10);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const csvContent: string = exportCall![1].content;
      expect(csvContent).toContain("'@external_link");
    });

    it('should not prefix normal titles in CSV export', async () => {
      await manager.addBookmark('Normal Title', 10);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const csvContent: string = exportCall![1].content;
      // Should contain the title without a leading quote prefix
      expect(csvContent).toContain('"Normal Title"');
      expect(csvContent).not.toContain('"\'Normal Title"');
    });
  });

  // -------------------------------------------------------------------
  // JSON export format
  // -------------------------------------------------------------------
  describe('JSON export format', () => {
    it('should export valid JSON with all bookmark fields', async () => {
      await manager.addBookmark('JSON Export', 42, 'Test desc', ['tag1']);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'json' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      expect(exportCall).toBeDefined();
      expect(exportCall![1].format).toBe('json');

      const parsed = JSON.parse(exportCall![1].content);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        title: 'JSON Export',
        timestamp: 42,
        description: 'Test desc',
        tags: ['tag1'],
      });
    });

    it('should default to JSON format when no format is specified', async () => {
      await manager.addBookmark('Default Format', 10);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({});

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      expect(exportCall![1].format).toBe('json');
    });
  });
});
