import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestHarness, makeBookmark } from './helpers';

describe('Persistence and Recovery Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recover from backup when primary storage is corrupt', () => {
    const validBookmarks = [
      makeBookmark('1', 'Backup Bookmark', 100),
      makeBookmark('2', 'Another One', 200),
    ];

    // Primary is corrupt, backup is valid
    const preferences = {
      get: vi.fn((key: string) => {
        if (key === 'bookmarks') return 'CORRUPT{JSON';
        if (key === 'bookmarks_backup') return JSON.stringify(validBookmarks);
        return null;
      }),
      set: vi.fn(),
    };

    const { send, getLastMessage } = createTestHarness({ preferences });
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });

    const bookmarks = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(bookmarks.length).toBe(2);
    expect(bookmarks[0].title).toBe('Backup Bookmark');
  });

  it('should start empty when both primary and backup are corrupt', () => {
    const preferences = {
      get: vi.fn((key: string) => {
        if (key === 'bookmarks') return 'CORRUPT{';
        if (key === 'bookmarks_backup') return 'ALSO{CORRUPT';
        return null;
      }),
      set: vi.fn(),
    };

    const { send, getLastMessage } = createTestHarness({ preferences });
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });

    const bookmarks = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(bookmarks.length).toBe(0);
  });

  it('should rotate backups after adding a bookmark', async () => {
    const existingBookmarks = [makeBookmark('1', 'Existing', 100)];
    const preferences = {
      get: vi.fn((key: string) => {
        if (key === 'bookmarks') return JSON.stringify(existingBookmarks);
        return null;
      }),
      set: vi.fn(),
    };

    const { send, deps } = createTestHarness({ preferences });

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 200;

    send('sidebar', 'ADD_BOOKMARK', { title: 'New Bookmark' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should save to both main and backup keys
    expect(deps.preferences.set).toHaveBeenCalledWith(
      'bookmarks_backup',
      JSON.stringify(existingBookmarks),
    );
    expect(deps.preferences.set).toHaveBeenCalledWith(
      'bookmarks',
      expect.stringContaining('"title":"New Bookmark"'),
    );
  });

  it('should preserve in-memory state when save fails', async () => {
    const failingPrefs = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(() => {
        throw new Error('Storage failure');
      }),
    };

    const { send, getLastMessage, deps } = createTestHarness({
      preferences: failingPrefs,
    });

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 100;

    send('sidebar', 'ADD_BOOKMARK', { title: 'Test Bookmark' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Error should be logged
    expect(deps.console.error).toHaveBeenCalled();

    // Should NOT send ERROR message (current behavior)
    const errorMsg = getLastMessage('sidebar', 'ERROR');
    expect(errorMsg).toBeUndefined();

    // Bookmark should still be in memory
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });
    const bookmarks = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].title).toBe('Test Bookmark');
  });

  it('should round-trip sort preferences correctly', () => {
    const sortPrefs = { sortBy: 'title', sortDirection: 'asc' as const };

    const preferences = {
      get: vi.fn((key: string) => {
        if (key === 'sortPreferences') return JSON.stringify(sortPrefs);
        return null;
      }),
      set: vi.fn(),
    };

    const { getMessages } = createTestHarness({ preferences });

    // On init, BookmarkManager should broadcast sort preferences to all UIs
    const sidebarMessages = getMessages('sidebar', 'SORT_PREFERENCES');
    const overlayMessages = getMessages('overlay', 'SORT_PREFERENCES');
    const windowMessages = getMessages('window', 'SORT_PREFERENCES');

    expect(sidebarMessages.length).toBeGreaterThan(0);
    expect(overlayMessages.length).toBeGreaterThan(0);
    expect(windowMessages.length).toBeGreaterThan(0);

    expect(sidebarMessages[0].data).toEqual(sortPrefs);
    expect(overlayMessages[0].data).toEqual(sortPrefs);
    expect(windowMessages[0].data).toEqual(sortPrefs);
  });

  it('should handle corrupt sort preferences gracefully', () => {
    const preferences = {
      get: vi.fn((key: string) => {
        if (key === 'sortPreferences') return 'CORRUPT{JSON';
        return null;
      }),
      set: vi.fn(),
    };

    const { getMessages, deps } = createTestHarness({ preferences });

    // Should not broadcast invalid preferences — just verify no crash
    getMessages('sidebar', 'SORT_PREFERENCES');
    expect(deps.console.error).toHaveBeenCalled();
  });

  it('should load bookmarks from valid JSON on construction', () => {
    const savedBookmarks = [
      makeBookmark('1', 'Saved Bookmark 1', 100),
      makeBookmark('2', 'Saved Bookmark 2', 200),
      makeBookmark('3', 'Saved Bookmark 3', 300),
    ];

    const preferences = {
      get: vi.fn((key: string) => {
        if (key === 'bookmarks') return JSON.stringify(savedBookmarks);
        return null;
      }),
      set: vi.fn(),
    };

    const { send, getLastMessage } = createTestHarness({ preferences });
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });

    const bookmarks = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(bookmarks.length).toBe(3);
    expect(bookmarks[0].title).toBe('Saved Bookmark 1');
    expect(bookmarks[1].title).toBe('Saved Bookmark 2');
    expect(bookmarks[2].title).toBe('Saved Bookmark 3');
  });
});
