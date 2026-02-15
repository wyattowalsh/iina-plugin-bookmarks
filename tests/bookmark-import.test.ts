import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps, findHandler } from './helpers/mock-deps';

describe('Bookmark Import via IMPORT_BOOKMARKS message', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  const makeBookmark = (id: string, title: string, ts: number) => ({
    id,
    title,
    timestamp: ts,
    filepath: '/test/video.mp4',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tags: ['imported'],
  });

  describe('Import modes', () => {
    it('should skip duplicates when duplicateHandling is "skip"', async () => {
      // Pre-add a bookmark with the same id
      await manager.addBookmark('Existing', 10);
      const existingId = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [makeBookmark(existingId, 'Imported Duplicate', 10)],
        options: { duplicateHandling: 'skip', preserveIds: true },
      });

      // Should still have only 1 bookmark with the original title
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].title).toBe('Existing');

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'IMPORT_RESULT',
        expect.objectContaining({ skippedCount: 1, importedCount: 0 }),
      );
    });

    it('should replace existing when duplicateHandling is "replace"', async () => {
      await manager.addBookmark('Original Title', 10);
      const existingId = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [makeBookmark(existingId, 'Replaced Title', 20)],
        options: { duplicateHandling: 'replace', preserveIds: true },
      });

      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].title).toBe('Replaced Title');
      expect(manager.getAllBookmarks()[0].timestamp).toBe(20);

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'IMPORT_RESULT',
        expect.objectContaining({ importedCount: 1, skippedCount: 0 }),
      );
    });

    it('should merge tags when duplicateHandling is "merge"', async () => {
      await manager.addBookmark('MergeMe', 10, 'desc', ['existing-tag']);
      const existingId = manager.getAllBookmarks()[0].id;

      const incoming = makeBookmark(existingId, 'MergeMe', 10);
      incoming.tags = ['new-tag'];

      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [incoming],
        options: { duplicateHandling: 'merge', preserveIds: true },
      });

      expect(manager.getAllBookmarks()).toHaveLength(1);
      const tags = manager.getAllBookmarks()[0].tags || [];
      expect(tags).toContain('existing-tag');
      expect(tags).toContain('new-tag');
    });

    it('should add new bookmarks when no duplicate exists', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          makeBookmark('new1', 'New Bookmark 1', 100),
          makeBookmark('new2', 'New Bookmark 2', 200),
        ],
        options: { duplicateHandling: 'skip' },
      });

      expect(manager.getAllBookmarks()).toHaveLength(2);
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'IMPORT_RESULT',
        expect.objectContaining({ importedCount: 2, skippedCount: 0 }),
      );
    });
  });

  describe('HTML stripping on import', () => {
    it('should sanitize HTML in imported bookmark titles', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 'xss1',
            title: '<script>alert("xss")</script>',
            timestamp: 10,
            filepath: '/test.mp4',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            tags: [],
          },
        ],
        options: { preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === 'xss1');
      expect(bm).toBeDefined();
      // stripHtmlTags removes HTML tags entirely, so <script> is stripped
      expect(bm!.title).not.toContain('<script>');
      expect(bm!.title).not.toContain('</script>');
      // The text content between tags is preserved
      expect(bm!.title).toContain('alert("xss")');
    });

    it('should sanitize HTML in imported bookmark descriptions', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          {
            id: 'xss2',
            title: 'Safe Title',
            timestamp: 10,
            filepath: '/test.mp4',
            description: '<img onerror="alert(1)" src="x">',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            tags: [],
          },
        ],
        options: { preserveIds: true },
      });

      const bm = manager.getAllBookmarks().find((b) => b.id === 'xss2');
      expect(bm).toBeDefined();
      expect(bm!.description).not.toContain('<img');
    });
  });

  describe('Validation of imported bookmarks', () => {
    it('should skip entries that are not objects', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: ['not an object', 42, null, makeBookmark('valid1', 'Valid', 10)],
      });

      // Only the valid one should be imported
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].title).toBe('Valid');
    });

    it('should skip entries with missing required fields', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [
          { id: 'no-title', timestamp: 10, filepath: '/f.mp4', createdAt: 'x', updatedAt: 'x' },
          makeBookmark('valid2', 'Has All Fields', 20),
        ],
      });

      // Entry without title should be skipped by validateBookmarkArray
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].title).toBe('Has All Fields');
    });

    it('should skip entries with negative timestamps', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({
        bookmarks: [makeBookmark('neg', 'Negative', -5)],
      });

      expect(manager.getAllBookmarks()).toHaveLength(0);
    });
  });
});

// Tests for importing data through the existing BookmarkManager addBookmark API
describe('Bookmark Import via addBookmark API', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  describe('Adding imported bookmarks', () => {
    it('should accept bookmarks with all fields', async () => {
      await manager.addBookmark('Imported Bookmark', 120.5, 'Imported description', [
        'tag1',
        'tag2',
      ]);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]).toMatchObject({
        title: 'Imported Bookmark',
        timestamp: 120.5,
        description: 'Imported description',
        tags: ['tag1', 'tag2'],
      });
    });

    it('should accept bookmarks with minimum required data', async () => {
      await manager.addBookmark('Minimal Bookmark', 60);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].title).toBe('Minimal Bookmark');
      expect(bookmarks[0].timestamp).toBe(60);
    });

    it('should handle bulk import of multiple bookmarks', async () => {
      const importData = [
        { title: 'BM 1', timestamp: 10, description: 'Desc 1', tags: ['a'] },
        { title: 'BM 2', timestamp: 20, description: 'Desc 2', tags: ['b'] },
        { title: 'BM 3', timestamp: 30, description: 'Desc 3', tags: ['c'] },
      ];

      for (const data of importData) {
        await manager.addBookmark(data.title, data.timestamp, data.description, data.tags);
      }

      expect(manager.getAllBookmarks()).toHaveLength(3);
      expect(manager.getAllBookmarks().map((b) => b.title)).toEqual(['BM 1', 'BM 2', 'BM 3']);
    });

    it('should save after each imported bookmark', async () => {
      await manager.addBookmark('Import 1', 10);
      await manager.addBookmark('Import 2', 20);

      // preferences.set should have been called for each bookmark save
      const setCalls = (deps.preferences.set as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === 'bookmarks',
      );
      expect(setCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Data sanitization on import', () => {
    it('should handle special characters in imported titles', async () => {
      await manager.addBookmark('Title with "quotes" & [brackets]', 100);

      const bookmarks = manager.getAllBookmarks();
      // stripHtmlTags only encodes < and >, preserves quotes and ampersands
      expect(bookmarks[0].title).toBe('Title with "quotes" & [brackets]');
    });

    it('should handle unicode characters in imported data', async () => {
      await manager.addBookmark(
        'Title with \u7279\u6b8a\u5b57\u7b26',
        100,
        'Description with \u00e9mojis \ud83c\udfac',
      );

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].title).toContain('\u7279\u6b8a\u5b57\u7b26');
    });

    it('should handle very long field values', async () => {
      const longTitle = 'A'.repeat(1000);
      const longDescription = 'B'.repeat(2000);

      await manager.addBookmark(longTitle, 100, longDescription);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].title).toBe(longTitle);
      expect(bookmarks[0].description).toBe(longDescription);
    });
  });

  describe('Performance', () => {
    it('should handle large number of bookmarks efficiently', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        await manager.addBookmark(`Bookmark ${i}`, i * 10, `Description ${i}`, [`tag${i}`]);
      }

      const endTime = Date.now();

      expect(manager.getAllBookmarks()).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
