import { describe, it, expect } from 'vitest';
import { createTestHarness } from './helpers';

describe('Integration Smoke Test', () => {
  it('should construct BookmarkManager and respond to UI_READY', () => {
    const { send, getLastMessage } = createTestHarness();

    // Simulate sidebar sending UI_READY
    send('sidebar', 'UI_READY', { uiType: 'sidebar' });

    // BookmarkManager should respond with BOOKMARKS_UPDATED
    const bookmarks = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(bookmarks).toBeDefined();
    expect(Array.isArray(bookmarks)).toBe(true);
  });

  it('should add a bookmark and broadcast to all UIs', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    // Set up current file path
    deps.core.status.path = '/test/movie.mp4';
    deps.core.status.currentTime = 42;

    // Add bookmark from sidebar
    send('sidebar', 'ADD_BOOKMARK', { title: 'Test Bookmark' });

    // Wait for async add
    await new Promise((resolve) => setTimeout(resolve, 50));

    // All UIs should receive the updated bookmarks list
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      const updated = getLastMessage(ui, 'BOOKMARKS_UPDATED');
      expect(updated).toBeDefined();
      expect(updated.length).toBe(1);
      expect(updated[0].title).toBe('Test Bookmark');
    }
  });

  it('should send BOOKMARK_ADDED confirmation to the source UI', async () => {
    const { send, getMessages } = createTestHarness();

    send('sidebar', 'ADD_BOOKMARK', {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const confirmations = getMessages('sidebar', 'BOOKMARK_ADDED');
    expect(confirmations.length).toBe(1);
  });

  it('should respond to REQUEST_BOOKMARK_DEFAULTS with defaults', () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/movies/inception.mkv';
    deps.core.status.currentTime = 300;

    send('window', 'REQUEST_BOOKMARK_DEFAULTS', {});

    const defaults = getLastMessage('window', 'BOOKMARK_DEFAULTS');
    expect(defaults).toBeDefined();
    expect(defaults.timestamp).toBe(300);
    expect(defaults.filepath).toBe('/movies/inception.mkv');
    expect(defaults.title).toContain('inception');
  });
});
