import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager-modern';

/**
 * Creates a fully-mocked IINARuntimeDependencies object for testing.
 * Every function is a vi.fn() so callers can assert on calls.
 */
function createMockDeps(overrides: Record<string, any> = {}): IINARuntimeDependencies {
  return {
    console: {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
    core: {
      status: {
        path: '/test/video.mp4',
        currentTime: 120,
      },
      seekTo: vi.fn(),
      seek: vi.fn(),
      osd: vi.fn(),
    },
    preferences: {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
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
      isVisible: vi.fn().mockReturnValue(false),
    },
    standaloneWindow: {
      loadFile: vi.fn(),
      postMessage: vi.fn(),
      onMessage: vi.fn(),
      show: vi.fn(),
    },
    utils: {
      ask: vi.fn(),
      prompt: vi.fn(),
      chooseFile: vi.fn(),
    },
    file: {
      read: vi.fn(),
      write: vi.fn(),
      exists: vi.fn(),
    },
    ...overrides,
  } as unknown as IINARuntimeDependencies;
}

// ---------- vi.mock for cloud-storage (avoids real import) ----------
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

describe('BookmarkManager (modern)', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  // ---------------------------------------------------------------
  // Construction & Initialisation
  // ---------------------------------------------------------------
  describe('constructor', () => {
    it('should load bookmarks, setup UI, and log success', () => {
      expect(deps.preferences.get).toHaveBeenCalledWith('bookmarks');
      expect(deps.sidebar.loadFile).toHaveBeenCalledWith('ui/sidebar/index.html');
      expect(deps.overlay.loadFile).toHaveBeenCalledWith('ui/overlay/index.html');
      expect(deps.standaloneWindow.loadFile).toHaveBeenCalledWith('ui/window/index.html');
      expect(deps.console.log).toHaveBeenCalledWith(
        expect.stringContaining('BookmarkManager initialized'),
      );
    });

    it('should load existing bookmarks from preferences', () => {
      const stored = JSON.stringify([
        {
          id: 'b1',
          title: 'Stored',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ]);
      const d = createMockDeps();
      (d.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'bookmarks' ? stored : null,
      );
      const m = new BookmarkManager(d);
      expect(m.getAllBookmarks()).toHaveLength(1);
      expect(m.getAllBookmarks()[0].title).toBe('Stored');
    });
  });

  // ---------------------------------------------------------------
  // addBookmark
  // ---------------------------------------------------------------
  describe('addBookmark', () => {
    it('should add a bookmark with provided values', async () => {
      await manager.addBookmark('My Title', 42, 'My desc', ['tag1']);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]).toMatchObject({
        title: 'My Title',
        timestamp: 42,
        description: 'My desc',
        tags: ['tag1'],
        filepath: '/test/video.mp4',
      });
    });

    it('should generate a title from filename when none is provided', async () => {
      await manager.addBookmark(undefined, 90);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].title).toContain('video');
      expect(bookmarks[0].title).toContain('1:30');
    });

    it('should use current playback time when timestamp is not provided', async () => {
      await manager.addBookmark('No TS');

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].timestamp).toBe(120); // from deps.core.status.currentTime
    });

    it('should save bookmarks to preferences after adding', async () => {
      await manager.addBookmark('Save Test', 10);
      expect(deps.preferences.set).toHaveBeenCalledWith(
        'bookmarks',
        expect.stringContaining('Save Test'),
      );
    });

    it('should enforce maxBookmarks limit', async () => {
      (deps.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'maxBookmarks') return '2';
        return null;
      });
      const m = new BookmarkManager(deps);

      await m.addBookmark('B1', 1);
      await m.addBookmark('B2', 2);
      await m.addBookmark('B3', 3); // should be rejected

      expect(m.getAllBookmarks()).toHaveLength(2);
      expect(deps.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Maximum bookmark limit'),
      );
    });

    it('should accept timestamp of 0', async () => {
      await manager.addBookmark('Start', 0);
      expect(manager.getAllBookmarks()[0].timestamp).toBe(0);
    });

    it('should default tags to empty array when none provided', async () => {
      await manager.addBookmark('No Tags', 5);
      expect(manager.getAllBookmarks()[0].tags).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // removeBookmark
  // ---------------------------------------------------------------
  describe('removeBookmark', () => {
    it('should remove existing bookmark and save immediately', async () => {
      await manager.addBookmark('ToRemove', 10);
      const id = manager.getAllBookmarks()[0].id;

      // Reset to track save calls after removal
      (deps.preferences.set as ReturnType<typeof vi.fn>).mockClear();

      manager.removeBookmark(id);

      expect(manager.getAllBookmarks()).toHaveLength(0);
      expect(deps.preferences.set).toHaveBeenCalledWith('bookmarks', expect.any(String));
    });

    it('should warn when bookmark not found', () => {
      manager.removeBookmark('nonexistent-id');
      expect(deps.console.warn).toHaveBeenCalledWith(expect.stringContaining('Bookmark not found'));
    });
  });

  // ---------------------------------------------------------------
  // jumpToBookmark
  // ---------------------------------------------------------------
  describe('jumpToBookmark', () => {
    it('should call seekTo with correct timestamp', async () => {
      await manager.addBookmark('Jump Target', 99.5);
      const id = manager.getAllBookmarks()[0].id;

      manager.jumpToBookmark(id);

      expect(deps.core.seekTo).toHaveBeenCalledWith(99.5);
    });

    it('should fall back to seek() if seekTo is not available', async () => {
      const d = createMockDeps();
      (d.core as any).seekTo = undefined;
      const m = new BookmarkManager(d);

      await m.addBookmark('Fallback', 50);
      const id = m.getAllBookmarks()[0].id;
      m.jumpToBookmark(id);

      expect(d.core.seek).toHaveBeenCalledWith(50);
    });

    it('should log error for nonexistent bookmark', () => {
      manager.jumpToBookmark('bad-id');
      expect(deps.console.error).toHaveBeenCalledWith(
        expect.stringContaining('Bookmark not found'),
      );
    });
  });

  // ---------------------------------------------------------------
  // saveBookmarks (tested through public API -- backup creation)
  // ---------------------------------------------------------------
  describe('saveBookmarks (via addBookmark)', () => {
    it('should create a backup of existing data before writing', async () => {
      // Pre-populate some bookmarks
      const existingData = JSON.stringify([
        {
          id: 'old',
          title: 'Old',
          timestamp: 1,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ]);
      const d = createMockDeps();
      (d.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'bookmarks') return existingData;
        return null;
      });

      const m = new BookmarkManager(d);
      (d.preferences.set as ReturnType<typeof vi.fn>).mockClear();
      (d.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'bookmarks') return existingData;
        return null;
      });

      await m.addBookmark('New', 10);

      // Should have set the backup key
      expect(d.preferences.set).toHaveBeenCalledWith('bookmarks_backup', existingData);
    });
  });

  // ---------------------------------------------------------------
  // recoverFromBackup
  // ---------------------------------------------------------------
  describe('recoverFromBackup', () => {
    it('should load bookmarks from backup and re-save as primary', () => {
      const backupData = JSON.stringify([
        {
          id: 'r1',
          title: 'Recovered',
          timestamp: 5,
          filepath: '/r.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ]);
      const d = createMockDeps();
      (d.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'bookmarks') return '{{CORRUPT}}'; // triggers load failure -> auto recovery
        if (key === 'bookmarks_backup') return backupData;
        return null;
      });

      const m = new BookmarkManager(d);
      expect(m.getAllBookmarks()).toHaveLength(1);
      expect(m.getAllBookmarks()[0].title).toBe('Recovered');
      // The primary key should have been restored
      expect(d.preferences.set).toHaveBeenCalledWith('bookmarks', backupData);
    });

    it('should return false when no backup exists', () => {
      const result = manager.recoverFromBackup();
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // updateBookmark
  // ---------------------------------------------------------------
  describe('updateBookmark', () => {
    it('should update fields and save', async () => {
      await manager.addBookmark('Original', 10);
      const id = manager.getAllBookmarks()[0].id;

      manager.updateBookmark(id, { title: 'Updated' });

      expect(manager.getAllBookmarks()[0].title).toBe('Updated');
    });

    it('should warn when bookmark not found', () => {
      manager.updateBookmark('missing', { title: 'X' });
      expect(deps.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Bookmark not found for update'),
      );
    });
  });

  // ---------------------------------------------------------------
  // getBookmarksForFile
  // ---------------------------------------------------------------
  describe('getBookmarksForFile', () => {
    it('should filter bookmarks by filepath', async () => {
      await manager.addBookmark('A', 1);
      // Change the mock path for the second bookmark
      (deps.core.status as any).path = '/other/file.mp4';
      await manager.addBookmark('B', 2);

      expect(manager.getBookmarksForFile('/test/video.mp4')).toHaveLength(1);
      expect(manager.getBookmarksForFile('/other/file.mp4')).toHaveLength(1);
    });

    it('should return all bookmarks when no filepath is given', async () => {
      await manager.addBookmark('A', 1);
      await manager.addBookmark('B', 2);
      expect(manager.getBookmarksForFile()).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // UI message handling
  // ---------------------------------------------------------------
  describe('UI message handling', () => {
    it('should register onMessage handlers for all three UIs', () => {
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith(expect.any(Function));
      expect(deps.overlay.onMessage).toHaveBeenCalledWith(expect.any(Function));
      expect(deps.standaloneWindow.onMessage).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle ADD_BOOKMARK message from sidebar', async () => {
      // Grab the handler that was registered on sidebar.onMessage
      const handler = (deps.sidebar.onMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // Send a JSON string message (matching the real IINA protocol)
      handler(
        JSON.stringify({
          type: 'ADD_BOOKMARK',
          payload: { title: 'From UI', timestamp: 55, description: 'UI desc', tags: ['ui'] },
        }),
      );

      // Allow the async addBookmark to settle
      await vi.waitFor(() => {
        expect(manager.getAllBookmarks().length).toBeGreaterThanOrEqual(1);
      });

      const added = manager.getAllBookmarks().find((b) => b.title === 'From UI');
      expect(added).toBeDefined();
      expect(added!.timestamp).toBe(55);
    });

    it('should handle DELETE_BOOKMARK message', async () => {
      await manager.addBookmark('ToDelete', 10);
      const id = manager.getAllBookmarks()[0].id;

      const handler = (deps.sidebar.onMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      handler(JSON.stringify({ type: 'DELETE_BOOKMARK', payload: { id } }));

      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should handle JUMP_TO_BOOKMARK message', async () => {
      await manager.addBookmark('JumpMe', 77);
      const id = manager.getAllBookmarks()[0].id;

      const handler = (deps.sidebar.onMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      handler(JSON.stringify({ type: 'JUMP_TO_BOOKMARK', payload: { id } }));

      expect(deps.core.seekTo).toHaveBeenCalledWith(77);
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle missing filepath gracefully', async () => {
      (deps.core.status as any).path = undefined;
      await manager.addBookmark('No Path', 10);

      expect(manager.getAllBookmarks()[0].filepath).toBe('/unknown/file.mp4');
    });

    it('should handle missing currentTime gracefully', async () => {
      (deps.core.status as any).currentTime = undefined;
      await manager.addBookmark('No Time');

      expect(manager.getAllBookmarks()[0].timestamp).toBe(0);
    });

    it('should return a copy of bookmarks (not the internal array)', async () => {
      await manager.addBookmark('Copy Test', 1);
      const all = manager.getAllBookmarks();
      all.push({
        id: 'injected',
        title: 'Hack',
        timestamp: 999,
        filepath: '/x',
        createdAt: '',
        updatedAt: '',
        tags: [],
      });
      expect(manager.getAllBookmarks()).toHaveLength(1);
    });
  });
});
