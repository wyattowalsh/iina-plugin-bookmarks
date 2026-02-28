import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps, findHandler } from './helpers/mock-deps';

describe('BookmarkManager', () => {
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
          updatedAt: '2024-01-01T00:00:00Z',
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

      await m.addBookmark('B1', 10);
      await m.addBookmark('B2', 20);
      await m.addBookmark('B3', 30); // should be rejected

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

    it('should show OSD warning if seekTo is not available and NOT fall back to seek()', async () => {
      const d = createMockDeps();
      (d.core as any).seekTo = undefined;
      const m = new BookmarkManager(d);

      await m.addBookmark('Fallback', 50);
      const id = m.getAllBookmarks()[0].id;
      m.jumpToBookmark(id);

      // Should show OSD warning
      expect(d.core.osd).toHaveBeenCalledWith(expect.stringContaining('seekTo() unavailable'));
      // Should NOT fall back to seek() (relative seek would be incorrect for bookmarks)
      expect(d.core.seek).not.toHaveBeenCalled();
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
          updatedAt: '2024-01-01T00:00:00Z',
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

    it('should start with empty bookmarks when no backup exists and primary is corrupt', () => {
      const d = createMockDeps();
      (d.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'bookmarks') return '{{CORRUPT}}';
        return null; // no backup either
      });

      const m = new BookmarkManager(d);
      expect(m.getAllBookmarks()).toHaveLength(0);
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
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      expect(manager.getBookmarksForFile()).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // UI message handling
  // ---------------------------------------------------------------
  describe('UI message handling', () => {
    it('should register onMessage handlers for all three UIs', () => {
      // Each UI gets per-name handlers for each message type
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith('UI_READY', expect.any(Function));
      expect(deps.overlay.onMessage).toHaveBeenCalledWith('UI_READY', expect.any(Function));
      expect(deps.standaloneWindow.onMessage).toHaveBeenCalledWith(
        'UI_READY',
        expect.any(Function),
      );
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith('ADD_BOOKMARK', expect.any(Function));
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith('DELETE_BOOKMARK', expect.any(Function));
      // New message types
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith('RECONCILE_FILES', expect.any(Function));
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith(
        'REQUEST_BOOKMARK_DEFAULTS',
        expect.any(Function),
      );
      expect(deps.sidebar.onMessage).toHaveBeenCalledWith(
        'SAVE_SORT_PREFERENCES',
        expect.any(Function),
      );
    });

    it('should handle ADD_BOOKMARK message from sidebar', async () => {
      const handler = findHandler(deps.sidebar.onMessage, 'ADD_BOOKMARK');

      // Data is passed directly (IINA named-channel protocol)
      handler({ title: 'From UI', timestamp: 55, description: 'UI desc', tags: ['ui'] });

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

      const handler = findHandler(deps.sidebar.onMessage, 'DELETE_BOOKMARK');
      handler({ id });

      expect(manager.getAllBookmarks()).toHaveLength(0);
    });

    it('should handle JUMP_TO_BOOKMARK message', async () => {
      await manager.addBookmark('JumpMe', 77);
      const id = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'JUMP_TO_BOOKMARK');
      handler({ id });

      expect(deps.core.seekTo).toHaveBeenCalledWith(77);
    });

    it('should send BOOKMARK_ADDED confirmation after ADD_BOOKMARK', async () => {
      const handler = findHandler(deps.sidebar.onMessage, 'ADD_BOOKMARK');
      handler({ title: 'Confirm Test', timestamp: 10 });

      await vi.waitFor(() => {
        expect(deps.sidebar.postMessage).toHaveBeenCalledWith('BOOKMARK_ADDED', {});
      });
    });

    it('should send BOOKMARK_DELETED confirmation after DELETE_BOOKMARK', async () => {
      await manager.addBookmark('ToConfirmDelete', 10);
      const id = manager.getAllBookmarks()[0].id;
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'DELETE_BOOKMARK');
      handler({ id });

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith('BOOKMARK_DELETED', {});
    });

    it('should send BOOKMARK_JUMPED confirmation after JUMP_TO_BOOKMARK', async () => {
      await manager.addBookmark('ToConfirmJump', 33);
      const id = manager.getAllBookmarks()[0].id;
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'JUMP_TO_BOOKMARK');
      handler({ id });

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith('BOOKMARK_JUMPED', {});
    });

    it('should handle REQUEST_BOOKMARK_DEFAULTS message', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'REQUEST_BOOKMARK_DEFAULTS');
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      handler({});

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'BOOKMARK_DEFAULTS',
        expect.objectContaining({
          title: expect.any(String),
          timestamp: expect.any(Number),
          filepath: expect.any(String),
        }),
      );
    });

    it('should handle SAVE_SORT_PREFERENCES message', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'SAVE_SORT_PREFERENCES');

      handler({ preferences: { sortBy: 'timestamp', sortDirection: 'asc' } });

      expect(deps.preferences.set).toHaveBeenCalledWith(
        'sortPreferences',
        expect.stringContaining('timestamp'),
      );
    });

    it('should handle RECONCILE_FILES message with no missing files', () => {
      const handler = findHandler(deps.sidebar.onMessage, 'RECONCILE_FILES');
      (deps.file.exists as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      handler({});

      // All files exist — opens dialog with empty movedFiles
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'SHOW_FILE_RECONCILIATION_DIALOG',
        expect.objectContaining({ movedFiles: [] }),
      );
    });

    it('should handle RECONCILE_FILES message with missing files', async () => {
      await manager.addBookmark('Missing File', 10);
      (deps.file.exists as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'RECONCILE_FILES');
      handler({});

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'SHOW_FILE_RECONCILIATION_DIALOG',
        expect.objectContaining({
          movedFiles: expect.arrayContaining([expect.objectContaining({ title: 'Missing File' })]),
        }),
      );
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

  // ---------------------------------------------------------------
  // destroy (event cleanup)
  // ---------------------------------------------------------------
  describe('destroy', () => {
    it('should unregister event listeners', () => {
      const d = createMockDeps();
      const eventId = 'evt-123';
      (d.event.on as ReturnType<typeof vi.fn>).mockReturnValue(eventId);
      (d.event as any).off = vi.fn();

      const m = new BookmarkManager(d);
      m.destroy();

      expect(d.event.off).toHaveBeenCalledWith('iina.file-loaded', eventId);
    });

    it('should be safe to call destroy multiple times', () => {
      const d = createMockDeps();
      (d.event.on as ReturnType<typeof vi.fn>).mockReturnValue('evt-1');
      (d.event as any).off = vi.fn();

      const m = new BookmarkManager(d);
      m.destroy();
      m.destroy(); // second call should be a no-op

      // off should have been called once for the single event
      expect(d.event.off).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------
  // generateId monotonic counter
  // ---------------------------------------------------------------
  describe('generateId (via addBookmark)', () => {
    it('should generate unique IDs for consecutive bookmarks', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      await manager.addBookmark('C', 30);

      const ids = manager.getAllBookmarks().map((b) => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  // ---------------------------------------------------------------
  // Chapter & subtitle enrichment
  // ---------------------------------------------------------------
  describe('Chapter & subtitle enrichment', () => {
    it('should auto-populate chapter title when chapters available', async () => {
      (deps.core.getChapters as ReturnType<typeof vi.fn>).mockReturnValue([
        { title: 'Introduction', time: 0 },
        { title: 'Main Content', time: 60 },
        { title: 'Conclusion', time: 300 },
      ]);
      deps.core.status.currentTime = 120;
      await manager.addBookmark();
      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].chapterTitle).toBe('Main Content');
    });

    it('should capture subtitle text', async () => {
      deps.mpv = { set: vi.fn(), getString: vi.fn().mockReturnValue('Hello world') };
      await manager.addBookmark();
      expect(manager.getAllBookmarks()[0].subtitleText).toBe('Hello world');
    });

    it('should generate chapter-aware auto-title', async () => {
      (deps.core.getChapters as ReturnType<typeof vi.fn>).mockReturnValue([
        { title: 'Intro', time: 0 },
      ]);
      deps.core.status.currentTime = 30;
      await manager.addBookmark();
      expect(manager.getAllBookmarks()[0].title).toContain('Ch: Intro');
    });
  });

  // ---------------------------------------------------------------
  // Auto-resume
  // ---------------------------------------------------------------
  describe('Auto-resume', () => {
    it('should save resume position for current file', () => {
      deps.core.status.position = 120;
      deps.core.status.duration = 3600;
      manager.saveResumePosition();
      expect(deps.preferences.set).toHaveBeenCalledWith(
        'resumePositions',
        expect.stringContaining('120'),
      );
    });

    it('should not save position if less than 5 seconds', () => {
      deps.core.status.position = 3;
      (deps.preferences.set as ReturnType<typeof vi.fn>).mockClear();
      manager.saveResumePosition();
      expect(deps.preferences.set).not.toHaveBeenCalledWith('resumePositions', expect.anything());
    });

    it('should send RESUME_POSITION on file load if position saved', () => {
      (deps.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'resumePositions') return JSON.stringify({ '/test/video.mp4': 300 });
        return null;
      });
      (deps.event.on as ReturnType<typeof vi.fn>).mockClear();
      void new BookmarkManager(deps);
      const fileLoadedHandler = findHandler(deps.event.on, 'iina.file-loaded');
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();
      fileLoadedHandler({});
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith('RESUME_POSITION', {
        filepath: '/test/video.mp4',
        timestamp: 300,
      });
    });
  });

  // ---------------------------------------------------------------
  // Duplicate detection
  // ---------------------------------------------------------------
  describe('Duplicate detection', () => {
    it('should detect near-duplicate bookmarks', async () => {
      await manager.addBookmark('First', 100);
      await manager.addBookmark('Second', 103); // 3s apart, within default 5s threshold
      expect(manager.getAllBookmarks()).toHaveLength(1);
    });

    it('should allow bookmark when outside threshold', async () => {
      await manager.addBookmark('First', 100);
      await manager.addBookmark('Second', 110); // 10s apart
      expect(manager.getAllBookmarks()).toHaveLength(2);
    });

    it('should respect custom threshold preference', async () => {
      (deps.preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'duplicateDetectionThreshold') return '2';
        return null;
      });
      manager = new BookmarkManager(deps);
      await manager.addBookmark('First', 100);
      await manager.addBookmark('Second', 103); // 3s apart, outside 2s threshold
      expect(manager.getAllBookmarks()).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // Scratchpad lifecycle
  // ---------------------------------------------------------------
  describe('Scratchpad lifecycle', () => {
    it('should promote scratchpad bookmarks', async () => {
      await manager.addBookmark('Test');
      const id = manager.getAllBookmarks()[0].id;
      manager.updateBookmark(id, { scratchpad: true });
      manager.promoteScratchpad([id]);
      expect(manager.getAllBookmarks()[0].scratchpad).toBeFalsy();
    });

    it('should discard only scratchpad bookmarks', async () => {
      await manager.addBookmark('Regular', 100);
      await manager.addBookmark('Quick', 200);
      const bookmarks = manager.getAllBookmarks();
      manager.updateBookmark(bookmarks[1].id, { scratchpad: true });
      manager.discardScratchpad([bookmarks[0].id, bookmarks[1].id]);
      expect(manager.getAllBookmarks()).toHaveLength(1);
      expect(manager.getAllBookmarks()[0].title).toBe('Regular');
    });
  });

  // ---------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------
  describe('Collections', () => {
    it('should create a collection', () => {
      manager.createCollection('Test Collection', 'A test', 'blue');
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'COLLECTIONS_UPDATED',
        expect.any(Array),
      );
    });

    it('should add bookmarks to collection', async () => {
      await manager.addBookmark('Test');
      const bookmarkId = manager.getAllBookmarks()[0].id;
      manager.createCollection('My Collection');
      const collectionsCall = (deps.sidebar.postMessage as any).mock.calls.find(
        (c: any[]) => c[0] === 'COLLECTIONS_UPDATED',
      );
      const collectionId = collectionsCall[1][0].id;
      manager.addToCollection([bookmarkId], collectionId);
    });

    it('should clean bookmark IDs from collections on delete', async () => {
      await manager.addBookmark('Test');
      const bookmarkId = manager.getAllBookmarks()[0].id;
      manager.createCollection('My Collection');
      const collectionsCall = (deps.sidebar.postMessage as any).mock.calls.find(
        (c: any[]) => c[0] === 'COLLECTIONS_UPDATED',
      );
      const collectionId = collectionsCall[1][0].id;
      manager.addToCollection([bookmarkId], collectionId);
      manager.removeBookmark(bookmarkId);
    });

    it('should create built-in smart collections on first run', () => {
      expect(deps.preferences.set).toHaveBeenCalledWith(
        'smart_collections',
        expect.stringContaining('sc-recent'),
      );
    });

    it('should not delete built-in smart collections', () => {
      manager.deleteSmartCollection('sc-recent');
      expect(deps.preferences.set).toHaveBeenCalledWith(
        'smart_collections',
        expect.stringContaining('sc-recent'),
      );
    });
  });

  // ---------------------------------------------------------------
  // Batch operations
  // ---------------------------------------------------------------
  describe('Batch operations', () => {
    it('should batch delete multiple bookmarks', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      await manager.addBookmark('C', 30);
      const ids = manager.getAllBookmarks().map((b) => b.id);
      manager.batchDelete(ids.slice(0, 2));
      expect(manager.getAllBookmarks()).toHaveLength(1);
    });

    it('should batch add tags', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const ids = manager.getAllBookmarks().map((b) => b.id);
      manager.batchTag(ids, ['important', 'work'], 'add');
      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].tags).toContain('important');
      expect(bookmarks[1].tags).toContain('work');
    });

    it('should batch pin bookmarks', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const ids = manager.getAllBookmarks().map((b) => b.id);
      manager.batchPin(ids, true);
      expect(manager.getAllBookmarks().every((b) => b.pinned)).toBe(true);
    });

    it('should batch color bookmarks', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const ids = manager.getAllBookmarks().map((b) => b.id);
      manager.batchColor(ids, 'red');
      expect(manager.getAllBookmarks().every((b) => b.color === 'red')).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // A-B loop
  // ---------------------------------------------------------------
  describe('A-B loop', () => {
    it('should set A-B loop for range bookmark', async () => {
      await manager.addBookmark('Range', 100);
      const id = manager.getAllBookmarks()[0].id;
      manager.updateBookmark(id, { endTimestamp: 200 });
      manager.setABLoop(id);
      expect(deps.mpv?.set).toHaveBeenCalledWith('ab-loop-a', 100);
      expect(deps.mpv?.set).toHaveBeenCalledWith('ab-loop-b', 200);
    });

    it('should not set loop for point bookmark', async () => {
      await manager.addBookmark('Point', 100);
      const id = manager.getAllBookmarks()[0].id;
      manager.setABLoop(id);
      expect(deps.mpv?.set).not.toHaveBeenCalled();
    });

    it('should clear A-B loop', () => {
      manager.clearABLoop();
      expect(deps.mpv?.set).toHaveBeenCalledWith('ab-loop-a', 'no');
      expect(deps.mpv?.set).toHaveBeenCalledWith('ab-loop-b', 'no');
    });
  });

  // ---------------------------------------------------------------
  // EXPORT_BOOKMARKS message handler
  // ---------------------------------------------------------------
  describe('EXPORT_BOOKMARKS handler', () => {
    it('should export bookmarks as JSON by default', async () => {
      await manager.addBookmark('Export JSON', 42, 'Desc', ['tag']);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({});

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      expect(exportCall).toBeDefined();
      expect(exportCall![1].format).toBe('json');

      const parsed = JSON.parse(exportCall![1].content);
      // v2 format
      expect(parsed.version).toBe(2);
      expect(parsed.bookmarks).toHaveLength(1);
      expect(parsed.bookmarks[0].title).toBe('Export JSON');
      expect(parsed.bookmarks[0].timestamp).toBe(42);
    });

    it('should export bookmarks as CSV with header row', async () => {
      await manager.addBookmark('CSV Test', 10, 'A desc', ['t1', 't2']);
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      expect(exportCall![1].format).toBe('csv');

      const csv: string = exportCall![1].content;
      const lines = csv.split('\n');
      // First line is the header
      expect(lines[0]).toBe('id,title,timestamp,filepath,description,createdAt,updatedAt,tags');
      // Second line is the data row
      expect(lines[1]).toContain('CSV Test');
      expect(lines[1]).toContain('t1;t2');
    });

    it('should apply sanitizeCsvCell to formula-dangerous cells', async () => {
      await manager.addBookmark('=FORMULA', 10, '+cmd|data');
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'csv' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const csv: string = exportCall![1].content;
      // Both the title (=FORMULA) and description (+cmd|data) should be sanitized
      expect(csv).toContain("'=FORMULA");
      expect(csv).toContain("'+cmd|data");
    });

    it('should export empty bookmark list as v2 format', () => {
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'json' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const parsed = JSON.parse(exportCall![1].content);
      expect(parsed.version).toBe(2);
      expect(parsed.bookmarks).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // FILE_RECONCILIATION_REQUEST message handler
  // ---------------------------------------------------------------
  describe('FILE_RECONCILIATION_REQUEST handler', () => {
    it('should update bookmark path on update_path action', async () => {
      await manager.addBookmark('Moved File', 10);
      const id = manager.getAllBookmarks()[0].id;
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({ action: 'update_path', bookmarkId: id, newPath: '/new/location/video.mp4' });

      expect(manager.getAllBookmarks()[0].filepath).toBe('/new/location/video.mp4');
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'FILE_RECONCILIATION_RESULT',
        expect.objectContaining({
          success: true,
          action: 'update_path',
          bookmarkId: id,
          oldPath: '/test/video.mp4',
          newPath: '/new/location/video.mp4',
        }),
      );
    });

    it('should remove bookmark on remove_bookmark action', async () => {
      await manager.addBookmark('To Remove', 10);
      const id = manager.getAllBookmarks()[0].id;
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({ action: 'remove_bookmark', bookmarkId: id });

      expect(manager.getAllBookmarks()).toHaveLength(0);
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'FILE_RECONCILIATION_RESULT',
        expect.objectContaining({
          success: true,
          action: 'remove_bookmark',
          bookmarkId: id,
        }),
      );
    });

    it('should return empty results on search_similar action', async () => {
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({
        action: 'search_similar',
        bookmarkId: 'bm-1',
        originalPath: '/old/path.mp4',
      });

      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'FILE_RECONCILIATION_RESULT',
        expect.objectContaining({
          success: true,
          action: 'search_similar',
          similarFiles: [],
        }),
      );
    });

    it('should reject paths not starting with / on update_path', async () => {
      await manager.addBookmark('Test', 10);
      const id = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'FILE_RECONCILIATION_REQUEST');
      handler({ action: 'update_path', bookmarkId: id, newPath: 'relative/path.mp4' });

      // Path should remain unchanged
      expect(manager.getAllBookmarks()[0].filepath).toBe('/test/video.mp4');
    });
  });

  // ---------------------------------------------------------------
  // Bookmark chaining (next/prev)
  // ---------------------------------------------------------------
  describe('Bookmark chaining', () => {
    it('should find next bookmark in same file', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      await manager.addBookmark('C', 30);
      const bookmarks = manager.getAllBookmarks();
      const next = manager.getAdjacentBookmark(bookmarks[0].id, 'next', 'file');
      expect(next?.title).toBe('B');
    });

    it('should find previous bookmark in same file', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();
      const prev = manager.getAdjacentBookmark(bookmarks[1].id, 'prev', 'file');
      expect(prev?.title).toBe('A');
    });

    it('should return null at end of bookmarks', async () => {
      await manager.addBookmark('A', 10);
      const bookmarks = manager.getAllBookmarks();
      const next = manager.getAdjacentBookmark(bookmarks[0].id, 'next', 'file');
      expect(next).toBeNull();
    });

    it('should return null at start of bookmarks', async () => {
      await manager.addBookmark('A', 10);
      const bookmarks = manager.getAllBookmarks();
      const prev = manager.getAdjacentBookmark(bookmarks[0].id, 'prev', 'file');
      expect(prev).toBeNull();
    });

    it('should navigate across files in all scope', async () => {
      (deps.core.status as any).path = '/test/aaa.mp4';
      await manager.addBookmark('A', 10);
      (deps.core.status as any).path = '/test/zzz.mp4';
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();
      const next = manager.getAdjacentBookmark(bookmarks[0].id, 'next', 'all');
      expect(next?.title).toBe('B');
    });

    it('should return null for unknown bookmark id', () => {
      const result = manager.getAdjacentBookmark('nonexistent', 'next', 'file');
      expect(result).toBeNull();
    });

    it('should call jumpToBookmark and show OSD when navigating', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();

      manager.navigateBookmark(bookmarks[0].id, 'next', 'file');

      expect(deps.core.seekTo).toHaveBeenCalledWith(20);
      expect(deps.core.osd).toHaveBeenCalledWith(expect.stringContaining('B'));
    });

    it('should show end of bookmarks OSD when no adjacent exists', async () => {
      await manager.addBookmark('A', 10);
      const bookmarks = manager.getAllBookmarks();

      manager.navigateBookmark(bookmarks[0].id, 'next', 'file');

      expect(deps.core.osd).toHaveBeenCalledWith('End of bookmarks');
    });
  });

  // ---------------------------------------------------------------
  // Thumbnail generation
  // ---------------------------------------------------------------
  describe('Thumbnail generation', () => {
    it('should generate thumbnail via REQUEST_THUMBNAIL message', async () => {
      await manager.addBookmark('Test', 100);
      const bookmark = manager.getAllBookmarks()[0];
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'REQUEST_THUMBNAIL');
      handler({ bookmarkId: bookmark.id });

      expect(deps.utils.exec).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-ss', '100', '-i', '/test/video.mp4']),
      );
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'THUMBNAIL_READY',
        expect.objectContaining({
          bookmarkId: bookmark.id,
          path: expect.stringContaining(bookmark.id),
        }),
      );
    });

    it('should not generate thumbnail when exec is unavailable', async () => {
      const d = createMockDeps();
      (d.utils as any).exec = undefined;
      const m = new BookmarkManager(d);

      await m.addBookmark('Test', 100);
      const bookmark = m.getAllBookmarks()[0];

      const handler = findHandler(d.sidebar.onMessage, 'REQUEST_THUMBNAIL');
      handler({ bookmarkId: bookmark.id });

      expect(d.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('utils.exec unavailable'),
      );
    });

    it('should not generate thumbnail when source file does not exist', async () => {
      (deps.file.exists as ReturnType<typeof vi.fn>).mockReturnValue(false);
      await manager.addBookmark('Test', 100);
      const bookmark = manager.getAllBookmarks()[0];

      const handler = findHandler(deps.sidebar.onMessage, 'REQUEST_THUMBNAIL');
      handler({ bookmarkId: bookmark.id });

      expect(deps.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Source file not found'),
      );
    });
  });

  // ---------------------------------------------------------------
  // I/O range marking
  // ---------------------------------------------------------------
  describe('I/O range marking', () => {
    it('should create range bookmark from in/out points', async () => {
      (deps.core.status as any).currentTime = 100;
      const inHandler = findHandler(deps.sidebar.onMessage, 'SET_IN_POINT');
      inHandler({});

      expect(deps.core.osd).toHaveBeenCalledWith(expect.stringContaining('In:'));

      (deps.core.status as any).currentTime = 200;
      const outHandler = findHandler(deps.sidebar.onMessage, 'SET_OUT_POINT');
      outHandler({});

      await vi.waitFor(() => {
        expect(manager.getAllBookmarks().length).toBeGreaterThanOrEqual(1);
      });

      const bookmark = manager.getAllBookmarks()[manager.getAllBookmarks().length - 1];
      expect(bookmark.endTimestamp).toBe(200);
    });

    it('should show OSD message when out point set without in point', () => {
      const outHandler = findHandler(deps.sidebar.onMessage, 'SET_OUT_POINT');
      outHandler({});

      expect(deps.core.osd).toHaveBeenCalledWith('Set In point first (press I)');
    });

    it('should swap in/out if out time is before in time', async () => {
      (deps.core.status as any).currentTime = 200;
      const inHandler = findHandler(deps.sidebar.onMessage, 'SET_IN_POINT');
      inHandler({});

      (deps.core.status as any).currentTime = 100;
      const outHandler = findHandler(deps.sidebar.onMessage, 'SET_OUT_POINT');
      outHandler({});

      await vi.waitFor(() => {
        expect(manager.getAllBookmarks().length).toBeGreaterThanOrEqual(1);
      });

      const bookmark = manager.getAllBookmarks()[manager.getAllBookmarks().length - 1];
      expect(bookmark.timestamp).toBe(100);
      expect(bookmark.endTimestamp).toBe(200);
    });
  });

  // ---------------------------------------------------------------
  // NEXT_BOOKMARK / PREV_BOOKMARK message handlers
  // ---------------------------------------------------------------
  describe('NEXT_BOOKMARK / PREV_BOOKMARK handlers', () => {
    it('should handle NEXT_BOOKMARK message', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();

      const handler = findHandler(deps.sidebar.onMessage, 'NEXT_BOOKMARK');
      handler({ currentId: bookmarks[0].id });

      expect(deps.core.seekTo).toHaveBeenCalledWith(20);
    });

    it('should handle PREV_BOOKMARK message', async () => {
      await manager.addBookmark('A', 10);
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();

      const handler = findHandler(deps.sidebar.onMessage, 'PREV_BOOKMARK');
      handler({ currentId: bookmarks[1].id });

      expect(deps.core.seekTo).toHaveBeenCalledWith(10);
    });

    it('should default to file scope when scope not provided', async () => {
      await manager.addBookmark('A', 10);
      (deps.core.status as any).path = '/test/other.mp4';
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();

      const handler = findHandler(deps.sidebar.onMessage, 'NEXT_BOOKMARK');
      handler({ currentId: bookmarks[0].id });

      expect(deps.core.osd).toHaveBeenCalledWith('End of bookmarks');
    });

    it('should support all scope for cross-file navigation', async () => {
      (deps.core.status as any).path = '/test/aaa.mp4';
      await manager.addBookmark('A', 10);
      (deps.core.status as any).path = '/test/zzz.mp4';
      await manager.addBookmark('B', 20);
      const bookmarks = manager.getAllBookmarks();

      const handler = findHandler(deps.sidebar.onMessage, 'NEXT_BOOKMARK');
      handler({ currentId: bookmarks[0].id, scope: 'all' });

      expect(deps.core.seekTo).toHaveBeenCalledWith(20);
    });
  });

  // ---------------------------------------------------------------
  // Global hotkey menu items
  // ---------------------------------------------------------------
  describe('Global hotkey menu items', () => {
    it('should register Quick Bookmark, Next, and Previous menu items', () => {
      expect(deps.menu.item).toHaveBeenCalledWith(
        'Quick Bookmark',
        expect.any(Function),
        expect.objectContaining({ keyBinding: 'Ctrl+b' }),
      );
      expect(deps.menu.item).toHaveBeenCalledWith(
        'Next Bookmark',
        expect.any(Function),
        expect.objectContaining({ keyBinding: 'Ctrl+]' }),
      );
      expect(deps.menu.item).toHaveBeenCalledWith(
        'Previous Bookmark',
        expect.any(Function),
        expect.objectContaining({ keyBinding: 'Ctrl+[' }),
      );
    });
  });

  // ---------------------------------------------------------------
  // file-based auto-backup (HR-S-002)
  // ---------------------------------------------------------------
  describe('file-based auto-backup', () => {
    it('should write auto-backup file when a bookmark is saved', async () => {
      await manager.addBookmark('Auto Backup Test', 30);
      expect(deps.file.write).toHaveBeenCalledWith(
        '@data/bookmarks-backup.json',
        expect.stringContaining('"title": "Auto Backup Test"'),
      );
    });
  });

  // ---------------------------------------------------------------
  // UPDATE_BOOKMARK message handler (HR-S-006)
  // ---------------------------------------------------------------
  describe('UPDATE_BOOKMARK handler', () => {
    it('should update bookmark title and description from sidebar message', async () => {
      await manager.addBookmark('Original Title', 10, 'Original desc', ['tag1']);
      const id = manager.getAllBookmarks()[0].id;

      const handler = findHandler(deps.sidebar.onMessage, 'UPDATE_BOOKMARK');
      handler({
        id,
        data: { title: 'Updated Title', description: 'Updated desc', tags: ['tag2'] },
      });

      const updated = manager.getAllBookmarks()[0];
      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated desc');
      expect(updated.tags).toEqual(['tag2']);
      expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
        'BOOKMARKS_UPDATED',
        expect.arrayContaining([expect.objectContaining({ title: 'Updated Title' })]),
      );
    });

    it('should ignore UPDATE_BOOKMARK with missing id', async () => {
      await manager.addBookmark('Unchanged', 10);

      const handler = findHandler(deps.sidebar.onMessage, 'UPDATE_BOOKMARK');
      handler({ data: { title: 'Should Not Apply' } });

      expect(manager.getAllBookmarks()[0].title).toBe('Unchanged');
    });
  });

  // ---------------------------------------------------------------
  // IMPORT_BOOKMARKS message handler (HR-S-007)
  // ---------------------------------------------------------------
  describe('IMPORT_BOOKMARKS handler', () => {
    it('should import valid bookmarks and post IMPORT_RESULT', async () => {
      const now = new Date().toISOString();
      const importData = [
        {
          id: 'imp-1',
          title: 'Imported BM',
          timestamp: 99,
          filepath: '/import/video.mp4',
          createdAt: now,
          updatedAt: now,
          tags: [],
        },
      ];
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({ bookmarks: importData });

      const resultCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'IMPORT_RESULT',
      );
      expect(resultCall).toBeDefined();
      expect(resultCall![1].success).toBe(true);
      expect(resultCall![1].importedCount).toBeGreaterThanOrEqual(1);
      const imported = manager.getAllBookmarks().find((b) => b.title === 'Imported BM');
      expect(imported).toBeDefined();
    });

    it('should ignore IMPORT_BOOKMARKS when bookmarks payload is missing', () => {
      const before = manager.getAllBookmarks().length;

      const handler = findHandler(deps.sidebar.onMessage, 'IMPORT_BOOKMARKS');
      handler({});

      expect(manager.getAllBookmarks().length).toBe(before);
    });
  });

  // ---------------------------------------------------------------
  // Manage Bookmarks menu handler call order (HR-S-005)
  // ---------------------------------------------------------------
  describe('Manage Bookmarks menu handler', () => {
    it('should call postMessage before show() when Manage Bookmarks is clicked', async () => {
      await manager.addBookmark('Menu Test', 5);
      const callOrder: string[] = [];

      (deps.standaloneWindow.postMessage as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('postMessage');
      });
      (deps.standaloneWindow.show as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('show');
      });

      // menu.item(label, callback) is called with the label and handler directly
      const menuItemCalls = (deps.menu.item as ReturnType<typeof vi.fn>).mock.calls;
      const manageItemCall = menuItemCalls.find(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('Manage'),
      );
      expect(manageItemCall).toBeDefined();
      manageItemCall![1](); // invoke the callback (2nd arg to menu.item)

      expect(callOrder[0]).toBe('postMessage');
      expect(callOrder[1]).toBe('show');
    });
  });

  // ---------------------------------------------------------------
  // Deferred UI initialization (window not loaded)
  // ---------------------------------------------------------------
  describe('deferred UI initialization', () => {
    it('should NOT call loadFile when window is not loaded', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      new BookmarkManager(d);

      expect(d.sidebar.loadFile).not.toHaveBeenCalled();
      expect(d.overlay.loadFile).not.toHaveBeenCalled();
      expect(d.standaloneWindow.loadFile).not.toHaveBeenCalled();
    });

    it('should register iina.window-loaded event when window is not loaded', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      new BookmarkManager(d);

      expect(d.event.on).toHaveBeenCalledWith('iina.window-loaded', expect.any(Function));
    });

    it('should call loadFile when window-loaded event fires', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      new BookmarkManager(d);

      // Find and invoke the window-loaded callback
      const windowLoadedCall = (d.event.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'iina.window-loaded',
      );
      expect(windowLoadedCall).toBeDefined();
      windowLoadedCall![1](); // fire the callback

      expect(d.sidebar.loadFile).toHaveBeenCalledWith('ui/sidebar/index.html');
      expect(d.overlay.loadFile).toHaveBeenCalledWith('ui/overlay/index.html');
      expect(d.standaloneWindow.loadFile).toHaveBeenCalledWith('ui/window/index.html');
    });

    it('should set up message listeners after window-loaded fires', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      new BookmarkManager(d);

      // Before window-loaded: no onMessage handlers
      expect(d.sidebar.onMessage).not.toHaveBeenCalled();

      // Fire window-loaded
      const windowLoadedCall = (d.event.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'iina.window-loaded',
      );
      windowLoadedCall![1]();

      // After window-loaded: onMessage handlers registered
      expect(d.sidebar.onMessage).toHaveBeenCalledWith('UI_READY', expect.any(Function));
    });

    it('should initialize UI immediately when window is already loaded', () => {
      const d = createMockDeps(); // window.loaded = true by default
      new BookmarkManager(d);

      expect(d.sidebar.loadFile).toHaveBeenCalledWith('ui/sidebar/index.html');
      expect(d.sidebar.onMessage).toHaveBeenCalledWith('UI_READY', expect.any(Function));
    });

    it('should not call refreshUI before UI is initialized', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      new BookmarkManager(d);

      // Trigger file-loaded event (which calls refreshUI)
      const fileLoadedCall = (d.event.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'iina.file-loaded',
      );
      fileLoadedCall![1](); // fire file-loaded

      // refreshUI should be a no-op since UI isn't initialized
      expect(d.sidebar.postMessage).not.toHaveBeenCalledWith(
        'BOOKMARKS_UPDATED',
        expect.anything(),
      );
    });

    it('should not send bookmarks when menu handler fires before UI is ready', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      new BookmarkManager(d);
      const manageCall = (d.menu.item as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('Manage'),
      );
      expect(manageCall).toBeDefined();
      manageCall![1]();
      expect(d.standaloneWindow.postMessage).not.toHaveBeenCalled();
    });

    it('should clean up window-loaded event in destroy()', () => {
      const d = createMockDeps();
      (d.core as any).window = undefined;
      const eventId = 'wl-123';
      (d.event.on as ReturnType<typeof vi.fn>).mockReturnValue(eventId);

      const m = new BookmarkManager(d);
      m.destroy();

      expect(d.event.off).toHaveBeenCalledWith('iina.window-loaded', eventId);
    });
  });

  // ---------------------------------------------------------------
  // Cross-file jump
  // ---------------------------------------------------------------
  describe('Cross-file jump', () => {
    it('should seek directly when bookmark file matches current file', async () => {
      await manager.addBookmark('Same File', 99.5);
      const id = manager.getAllBookmarks()[0].id;

      manager.jumpToBookmark(id);

      expect(deps.core.seekTo).toHaveBeenCalledWith(99.5);
      expect(deps.core.osd).toHaveBeenCalledWith(expect.stringContaining('Jumped to'));
      expect(deps.core.open).not.toHaveBeenCalled();
    });

    it('should open file and seek on file-started for cross-file jump', async () => {
      const d = createMockDeps();
      const m = new BookmarkManager(d);

      await m.addBookmark('Target', 45);
      const bm = m.getAllBookmarks()[0];

      (d.core.status as any).path = '/different/file.mp4';

      let fileStartedCallback: (() => void) | null = null;
      (d.event.on as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, cb: () => void) => {
          if (event === 'iina.file-started') {
            fileStartedCallback = cb;
          }
          return 'listener-id';
        },
      );

      m.jumpToBookmark(bm.id);

      expect(d.core.open).toHaveBeenCalledWith('/test/video.mp4');

      expect(fileStartedCallback).not.toBeNull();
      fileStartedCallback!();

      expect(d.core.seekTo).toHaveBeenCalledWith(45);
      expect(d.core.osd).toHaveBeenCalledWith(expect.stringContaining('Jumped to'));
    });

    it('should cancel previous pending seek on new jump', async () => {
      const d = createMockDeps();
      const m = new BookmarkManager(d);

      await m.addBookmark('First', 10);
      await m.addBookmark('Second', 20);
      const [bm1, bm2] = m.getAllBookmarks();

      (d.core.status as any).path = '/different/file.mp4';

      const fileStartedCallbacks: (() => void)[] = [];
      let listenerIdCounter = 0;
      (d.event.on as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, cb: () => void) => {
          if (event === 'iina.file-started') {
            fileStartedCallbacks.push(cb);
          }
          return `listener-${listenerIdCounter++}`;
        },
      );

      m.jumpToBookmark(bm1.id);
      expect(d.core.open).toHaveBeenCalledWith('/test/video.mp4');

      (d.core.open as ReturnType<typeof vi.fn>).mockClear();
      m.jumpToBookmark(bm2.id);
      expect(d.core.open).toHaveBeenCalledWith('/test/video.mp4');

      expect(d.event.off).toHaveBeenCalledWith('iina.file-started', 'listener-0');

      fileStartedCallbacks[1]();

      expect(d.core.seekTo).toHaveBeenCalledWith(20);
    });

    it('should timeout cross-file jump after 10 seconds', async () => {
      vi.useFakeTimers();

      try {
        const d = createMockDeps();
        const m = new BookmarkManager(d);

        await m.addBookmark('Timeout', 50);
        const bm = m.getAllBookmarks()[0];

        (d.core.status as any).path = '/different/file.mp4';

        (d.event.on as ReturnType<typeof vi.fn>).mockImplementation(() => 'timeout-listener');

        m.jumpToBookmark(bm.id);
        expect(d.core.open).toHaveBeenCalledWith('/test/video.mp4');

        vi.advanceTimersByTime(10001);

        expect(d.core.osd).toHaveBeenCalledWith(expect.stringContaining('Jump timed out'));
        expect(d.event.off).toHaveBeenCalledWith('iina.file-started', 'timeout-listener');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle missing core.open gracefully', async () => {
      const d = createMockDeps();
      (d.core as any).open = undefined;
      const m = new BookmarkManager(d);

      await m.addBookmark('No Open', 50);
      const bm = m.getAllBookmarks()[0];

      (d.core.status as any).path = '/different/file.mp4';

      m.jumpToBookmark(bm.id);

      expect(d.core.osd).toHaveBeenCalledWith(
        expect.stringContaining('Cannot open different file'),
      );
      expect(d.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('core.open() unavailable'),
      );
    });
  });

  // ---------------------------------------------------------------
  // sendBookmarksToUI scope
  // ---------------------------------------------------------------
  describe('sendBookmarksToUI scope', () => {
    it('should send all bookmarks to sidebar', async () => {
      await manager.addBookmark('Current', 10);
      (deps.core.status as any).path = '/other/file.mp4';
      await manager.addBookmark('Other', 20);
      (deps.core.status as any).path = '/test/video.mp4';

      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'UI_READY');
      handler({});

      const call = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'BOOKMARKS_UPDATED',
      );
      expect(call).toBeDefined();
      expect(call![1]).toHaveLength(2);
    });

    it('should send all bookmarks to window', async () => {
      await manager.addBookmark('Current', 10);
      (deps.core.status as any).path = '/other/file.mp4';
      await manager.addBookmark('Other', 20);
      (deps.core.status as any).path = '/test/video.mp4';

      (deps.standaloneWindow.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.standaloneWindow.onMessage, 'UI_READY');
      handler({});

      const call = (deps.standaloneWindow.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'BOOKMARKS_UPDATED',
      );
      expect(call).toBeDefined();
      expect(call![1]).toHaveLength(2);
    });

    it('should send only current-file bookmarks to overlay', async () => {
      await manager.addBookmark('Current', 10);
      (deps.core.status as any).path = '/other/file.mp4';
      await manager.addBookmark('Other', 20);
      (deps.core.status as any).path = '/test/video.mp4';

      (deps.overlay.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.overlay.onMessage, 'UI_READY');
      handler({});

      const call = (deps.overlay.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'BOOKMARKS_UPDATED',
      );
      expect(call).toBeDefined();
      expect(call![1]).toHaveLength(1);
      expect(call![1][0].title).toBe('Current');
    });
  });

  // ---------------------------------------------------------------
  // Playback status broadcast
  // ---------------------------------------------------------------
  describe('Playback status broadcast', () => {
    it('should broadcast playback status on file-loaded event', () => {
      const d = createMockDeps();
      let fileLoadedCb: (() => void) | null = null;
      (d.event.on as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, cb: () => void) => {
          if (event === 'iina.file-loaded') {
            fileLoadedCb = cb;
          }
          return 'fl-id';
        },
      );
      const m = new BookmarkManager(d);

      (d.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();
      (d.overlay.postMessage as ReturnType<typeof vi.fn>).mockClear();
      (d.standaloneWindow.postMessage as ReturnType<typeof vi.fn>).mockClear();

      expect(fileLoadedCb).not.toBeNull();
      fileLoadedCb!();

      for (const ui of [d.sidebar, d.overlay, d.standaloneWindow]) {
        const call = (ui.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: any[]) => c[0] === 'PLAYBACK_STATUS',
        );
        expect(call).toBeDefined();
        expect(call![1]).toEqual(
          expect.objectContaining({
            duration: expect.any(Number),
            position: expect.any(Number),
            chapters: [],
          }),
        );
      }

      m.destroy();
    });

    it('should broadcast playback status every 5 seconds after file-loaded', () => {
      vi.useFakeTimers();

      try {
        const d = createMockDeps();
        let fileLoadedCb: (() => void) | null = null;
        (d.event.on as ReturnType<typeof vi.fn>).mockImplementation(
          (event: string, cb: () => void) => {
            if (event === 'iina.file-loaded') {
              fileLoadedCb = cb;
            }
            return 'fl-id';
          },
        );
        const m = new BookmarkManager(d);

        fileLoadedCb!();

        (d.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

        vi.advanceTimersByTime(5000);

        const calls = (d.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
          (c: any[]) => c[0] === 'PLAYBACK_STATUS',
        );
        expect(calls.length).toBeGreaterThanOrEqual(1);

        m.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should stop playback broadcast on destroy', () => {
      vi.useFakeTimers();

      try {
        const d = createMockDeps();
        let fileLoadedCb: (() => void) | null = null;
        (d.event.on as ReturnType<typeof vi.fn>).mockImplementation(
          (event: string, cb: () => void) => {
            if (event === 'iina.file-loaded') {
              fileLoadedCb = cb;
            }
            return 'fl-id';
          },
        );
        const m = new BookmarkManager(d);

        fileLoadedCb!();

        m.destroy();

        (d.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();
        vi.advanceTimersByTime(10000);

        const calls = (d.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
          (c: any[]) => c[0] === 'PLAYBACK_STATUS',
        );
        expect(calls).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
