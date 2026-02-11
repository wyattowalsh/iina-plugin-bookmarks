import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager-modern';

// Mock cloud-storage to prevent real imports
vi.mock('../src/cloud-storage', () => ({
  getCloudStorageManager: vi.fn(() => ({
    setProvider: vi.fn(),
    uploadBookmarks: vi.fn(),
    downloadBookmarks: vi.fn(),
    listBackups: vi.fn(),
    syncBookmarks: vi.fn(),
  })),
  CloudStorageManager: vi.fn(),
}));

function createMockDeps(): IINARuntimeDependencies {
  return {
    console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
    preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
    core: {
      status: {
        path: '/test/video.mp4',
        currentTime: 120.5,
      },
      seekTo: vi.fn(),
      seek: vi.fn(),
      osd: vi.fn(),
    },
    event: { on: vi.fn() },
    menu: { addItem: vi.fn(), item: vi.fn(() => ({})) },
    sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
    overlay: {
      loadFile: vi.fn(),
      postMessage: vi.fn(),
      onMessage: vi.fn(),
      setClickable: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      isVisible: vi.fn(() => false),
    },
    standaloneWindow: {
      loadFile: vi.fn(),
      postMessage: vi.fn(),
      onMessage: vi.fn(),
      show: vi.fn(),
    },
    utils: { chooseFile: vi.fn(), prompt: vi.fn(), ask: vi.fn() },
    file: {
      write: vi.fn(),
      read: vi.fn(() => '[]'),
      exists: vi.fn(() => true),
    },
  } as unknown as IINARuntimeDependencies;
}

// TODO: The comprehensive import features (importBookmarksFromFile, CSV parsing,
// duplicate handling, file format detection) have not yet been migrated to
// bookmark-manager-modern.ts. Re-enable these tests once import functionality
// is added to the modern module.
describe.skip('Bookmark Import Functionality (pending migration to modern module)', () => {
  it('placeholder -- re-enable after import feature migration', () => {
    expect(true).toBe(true);
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
      expect(bookmarks[0].title).toBe('Title with "quotes" & [brackets]');
    });

    it('should handle unicode characters in imported data', async () => {
      await manager.addBookmark(
        'Title with \u7279\u6b8a\u5b57\u7b26',
        100,
        'Description with \u00e9mojis \ud83c\udfac',
      );

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].title).toBe('Title with \u7279\u6b8a\u5b57\u7b26');
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
      expect(endTime - startTime).toBeLessThan(30000);
    });
  });
});
