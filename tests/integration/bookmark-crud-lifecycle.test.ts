import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestHarness } from './helpers';
import { MAX_TIMESTAMP } from '../../src/types';

describe('Bookmark CRUD Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle full CRUD from sidebar: ADD → UPDATE → DELETE with broadcasts', async () => {
    const { send, getLastMessage, deps, clearMessages } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 60;

    // ADD
    send('sidebar', 'ADD_BOOKMARK', { title: 'First Bookmark', timestamp: 60 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // All UIs should receive BOOKMARKS_UPDATED
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      const updated = getLastMessage(ui, 'BOOKMARKS_UPDATED');
      expect(updated).toBeDefined();
      expect(updated.length).toBe(1);
      expect(updated[0].title).toBe('First Bookmark');
    }

    const bookmarkId = getLastMessage('sidebar', 'BOOKMARKS_UPDATED')[0].id;

    clearMessages();

    // UPDATE
    send('sidebar', 'UPDATE_BOOKMARK', {
      id: bookmarkId,
      data: { title: 'Updated Title', tags: ['test', 'updated'] },
    });

    // All UIs should receive the updated bookmarks
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      const updated = getLastMessage(ui, 'BOOKMARKS_UPDATED');
      expect(updated).toBeDefined();
      expect(updated[0].title).toBe('Updated Title');
      expect(updated[0].tags).toEqual(['test', 'updated']);
    }

    clearMessages();

    // DELETE
    send('sidebar', 'DELETE_BOOKMARK', { id: bookmarkId });

    // All UIs should receive the updated (now empty) bookmarks list
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      const updated = getLastMessage(ui, 'BOOKMARKS_UPDATED');
      expect(updated).toBeDefined();
      expect(updated.length).toBe(0);
    }

    // Sidebar should receive BOOKMARK_DELETED confirmation
    const confirmation = getLastMessage('sidebar', 'BOOKMARK_DELETED');
    expect(confirmation).toBeDefined();
  });

  it('should route messages from different UIs correctly', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 100;

    // ADD from overlay
    send('overlay', 'ADD_BOOKMARK', { title: 'From Overlay' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const overlayConfirmation = getLastMessage('overlay', 'BOOKMARK_ADDED');
    expect(overlayConfirmation).toBeDefined();

    const bookmarkId = getLastMessage('overlay', 'BOOKMARKS_UPDATED')[0].id;

    // DELETE from window
    send('window', 'DELETE_BOOKMARK', { id: bookmarkId });

    const windowConfirmation = getLastMessage('window', 'BOOKMARK_DELETED');
    expect(windowConfirmation).toBeDefined();

    // All UIs receive broadcasts
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      const updated = getLastMessage(ui, 'BOOKMARKS_UPDATED');
      expect(updated.length).toBe(0);
    }
  });

  it('should send file-filtered bookmarks on UI_READY', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    // Add bookmarks for two different files
    deps.core.status.path = '/movies/file1.mp4';
    deps.core.status.currentTime = 50;
    send('sidebar', 'ADD_BOOKMARK', { title: 'File 1 Bookmark' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    deps.core.status.path = '/movies/file2.mp4';
    deps.core.status.currentTime = 100;
    send('sidebar', 'ADD_BOOKMARK', { title: 'File 2 Bookmark' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate switching back to file1 and sending UI_READY
    deps.core.status.path = '/movies/file1.mp4';
    send('overlay', 'UI_READY', { uiType: 'overlay' });

    const bookmarks = getLastMessage('overlay', 'BOOKMARKS_UPDATED');
    expect(bookmarks).toBeDefined();
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].title).toBe('File 1 Bookmark');
    expect(bookmarks[0].filepath).toBe('/movies/file1.mp4');
  });

  it('should jump to bookmark when requested', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 60;

    send('sidebar', 'ADD_BOOKMARK', { title: 'Jump Test', timestamp: 120 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const bookmarkId = getLastMessage('sidebar', 'BOOKMARKS_UPDATED')[0].id;

    send('sidebar', 'JUMP_TO_BOOKMARK', { id: bookmarkId });

    // Should call seekTo with the bookmark's timestamp
    expect(deps.core.seekTo).toHaveBeenCalledWith(120);

    // Should send confirmation
    const confirmation = getLastMessage('sidebar', 'BOOKMARK_JUMPED');
    expect(confirmation).toBeDefined();
  });

  it('should respond to REQUEST_BOOKMARK_DEFAULTS with current context', () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/movies/inception.mkv';
    deps.core.status.currentTime = 300;
    deps.core.status.metadata = { title: 'Inception' };

    send('window', 'REQUEST_BOOKMARK_DEFAULTS', {});

    const defaults = getLastMessage('window', 'BOOKMARK_DEFAULTS');
    expect(defaults).toBeDefined();
    expect(defaults.timestamp).toBe(300);
    expect(defaults.filepath).toBe('/movies/inception.mkv');
    expect(defaults.title).toContain('inception');
  });

  it('should reject bookmark with invalid timestamp (negative)', async () => {
    const { send, getLastMessage, deps, clearMessages } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';

    // First, send UI_READY to get initial state
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });
    const initial = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(initial.length).toBe(0);

    clearMessages();

    send('sidebar', 'ADD_BOOKMARK', { title: 'Invalid', timestamp: -10 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should log an error
    expect(deps.console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid timestamp'));

    // Should still send BOOKMARK_ADDED (current behavior: promise resolves even on early return)
    const confirmation = getLastMessage('sidebar', 'BOOKMARK_ADDED');
    expect(confirmation).toBeDefined();

    // But should NOT broadcast BOOKMARKS_UPDATED (no bookmark was actually added)
    const updated = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(updated).toBeUndefined();
  });

  it('should reject bookmark with timestamp exceeding MAX_TIMESTAMP', async () => {
    const { send, getLastMessage, deps, clearMessages } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';

    // First, send UI_READY to get initial state
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });
    const initial = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(initial.length).toBe(0);

    clearMessages();

    send('sidebar', 'ADD_BOOKMARK', { title: 'Too Long', timestamp: MAX_TIMESTAMP + 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should log an error
    expect(deps.console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid timestamp'));

    // Should still send BOOKMARK_ADDED (current behavior: promise resolves even on early return)
    const confirmation = getLastMessage('sidebar', 'BOOKMARK_ADDED');
    expect(confirmation).toBeDefined();

    // But should NOT broadcast BOOKMARKS_UPDATED (no bookmark was actually added)
    const updated = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(updated).toBeUndefined();
  });

  it('should handle DELETE with nonexistent ID gracefully', () => {
    const { send, deps } = createTestHarness();

    // Should not crash
    send('sidebar', 'DELETE_BOOKMARK', { id: 'nonexistent-id' });

    // Should log a warning
    expect(deps.console.warn).toHaveBeenCalled();
  });

  it('should save and broadcast sort preferences', () => {
    const { send, deps } = createTestHarness();

    const sortPrefs = { sortBy: 'timestamp', sortDirection: 'desc' as const };
    send('sidebar', 'SAVE_SORT_PREFERENCES', { preferences: sortPrefs });

    // Should save to preferences
    expect(deps.preferences.set).toHaveBeenCalledWith('sortPreferences', JSON.stringify(sortPrefs));
  });
});
