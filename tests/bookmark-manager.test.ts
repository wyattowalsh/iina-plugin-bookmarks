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
      await manager.addBookmark('A', 1);
      await manager.addBookmark('B', 2);
      await manager.addBookmark('C', 3);

      const ids = manager.getAllBookmarks().map((b) => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
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
      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Export JSON');
      expect(parsed[0].timestamp).toBe(42);
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

    it('should export empty bookmark list', () => {
      (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mockClear();

      const handler = findHandler(deps.sidebar.onMessage, 'EXPORT_BOOKMARKS');
      handler({ format: 'json' });

      const exportCall = (deps.sidebar.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: any[]) => c[0] === 'EXPORT_RESULT',
      );
      const parsed = JSON.parse(exportCall![1].content);
      expect(parsed).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // CLOUD_SYNC_REQUEST message handler
  // ---------------------------------------------------------------
  describe('CLOUD_SYNC_REQUEST handler', () => {
    function findHandler(uiMock: any, msgType: string) {
      const call = uiMock.mock.calls.find((c: any[]) => c[0] === msgType);
      return call![1];
    }

    it('should handle upload action and post success result', async () => {
      const { getCloudStorageManager } = await import('../src/cloud-storage');
      const mockCloudManager = (getCloudStorageManager as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      if (!mockCloudManager) return; // skip if mock not available

      mockCloudManager.setProvider.mockResolvedValue(true);
      mockCloudManager.uploadBookmarks.mockResolvedValue('backup-123');

      await manager.addBookmark('Cloud BM', 10);

      const handler = findHandler(deps.sidebar.onMessage, 'CLOUD_SYNC_REQUEST');
      handler({
        action: 'upload',
        provider: 'gdrive',
        credentials: { accessToken: 'tok' },
      });

      // Wait for async handler to complete
      await vi.waitFor(() => {
        expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
          'CLOUD_SYNC_RESULT',
          expect.objectContaining({ success: true, action: 'upload' }),
        );
      });
    });

    it('should handle upload auth failure and post error result', async () => {
      const { getCloudStorageManager } = await import('../src/cloud-storage');
      const mockCloudManager = (getCloudStorageManager as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      if (!mockCloudManager) return;

      mockCloudManager.setProvider.mockResolvedValue(false);

      const handler = findHandler(deps.sidebar.onMessage, 'CLOUD_SYNC_REQUEST');
      handler({
        action: 'upload',
        provider: 'gdrive',
        credentials: { accessToken: 'bad' },
      });

      await vi.waitFor(() => {
        expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
          'CLOUD_SYNC_RESULT',
          expect.objectContaining({
            success: false,
            action: 'upload',
            error: expect.stringContaining('authenticate'),
          }),
        );
      });
    });

    it('should handle download action and post bookmarks', async () => {
      const { getCloudStorageManager } = await import('../src/cloud-storage');
      const mockCloudManager = (getCloudStorageManager as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      if (!mockCloudManager) return;

      mockCloudManager.setProvider.mockResolvedValue(true);
      mockCloudManager.listBackups.mockResolvedValue(['backup-1.json']);
      mockCloudManager.downloadBookmarks.mockResolvedValue({
        bookmarks: [{ id: 'c1', title: 'Cloud' }],
        metadata: { version: '1.0.0' },
      });

      const handler = findHandler(deps.sidebar.onMessage, 'CLOUD_SYNC_REQUEST');
      handler({
        action: 'download',
        provider: 'gdrive',
        credentials: { accessToken: 'tok' },
      });

      await vi.waitFor(() => {
        expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
          'CLOUD_SYNC_RESULT',
          expect.objectContaining({
            success: true,
            action: 'download',
            bookmarks: expect.any(Array),
          }),
        );
      });
    });

    it('should handle sync action and merge bookmarks', async () => {
      const { getCloudStorageManager } = await import('../src/cloud-storage');
      const mockCloudManager = (getCloudStorageManager as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      if (!mockCloudManager) return;

      mockCloudManager.setProvider.mockResolvedValue(true);
      mockCloudManager.syncBookmarks.mockResolvedValue({
        merged: [{ id: 'm1', title: 'Merged' }],
        added: 1,
        updated: 0,
        conflicts: [],
      });

      const handler = findHandler(deps.sidebar.onMessage, 'CLOUD_SYNC_REQUEST');
      handler({
        action: 'sync',
        provider: 'gdrive',
        credentials: { accessToken: 'tok' },
      });

      await vi.waitFor(() => {
        expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
          'CLOUD_SYNC_RESULT',
          expect.objectContaining({
            success: true,
            action: 'sync',
            syncStats: expect.objectContaining({ added: 1, updated: 0 }),
          }),
        );
      });
    });

    it('should handle network error during download', async () => {
      const { getCloudStorageManager } = await import('../src/cloud-storage');
      const mockCloudManager = (getCloudStorageManager as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      if (!mockCloudManager) return;

      mockCloudManager.setProvider.mockResolvedValue(true);
      mockCloudManager.listBackups.mockRejectedValue(new Error('Network error'));

      const handler = findHandler(deps.sidebar.onMessage, 'CLOUD_SYNC_REQUEST');
      handler({
        action: 'download',
        provider: 'gdrive',
        credentials: { accessToken: 'tok' },
      });

      await vi.waitFor(() => {
        expect(deps.sidebar.postMessage).toHaveBeenCalledWith(
          'CLOUD_SYNC_RESULT',
          expect.objectContaining({
            success: false,
            action: 'download',
            error: 'Network error',
          }),
        );
      });
    });
  });

  // ---------------------------------------------------------------
  // FILE_RECONCILIATION_REQUEST message handler
  // ---------------------------------------------------------------
  describe('FILE_RECONCILIATION_REQUEST handler', () => {
    function findHandler(uiMock: any, msgType: string) {
      const call = uiMock.mock.calls.find((c: any[]) => c[0] === msgType);
      return call![1];
    }

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
});
