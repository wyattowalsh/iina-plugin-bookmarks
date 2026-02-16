// Integration tests for file reconciliation workflow via message protocol
// Tests the full cycle: RECONCILE_FILES → dialog → FILE_RECONCILIATION_REQUEST → result

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers';

describe('File reconciliation flow', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('full flow: detects missing files, shows dialog, updates path on request', async () => {
    // Setup: Add 3 bookmarks
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 50));

    harness.deps.core.status.path = '/test/file2.mp4';
    harness.deps.core.status.currentTime = 120;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 2', timestamp: 120 });
    await new Promise((r) => setTimeout(r, 50));

    harness.deps.core.status.path = '/test/file3.mp4';
    harness.deps.core.status.currentTime = 180;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 3', timestamp: 180 });
    await new Promise((r) => setTimeout(r, 50));

    // Get the actual bookmarks that were created (use getAllBookmarks since they span multiple files)
    const bookmarks = harness.manager.getAllBookmarks();
    expect(bookmarks).toHaveLength(3);
    // Bookmarks might be in any order, so find them by title
    const bookmark1 = bookmarks.find((b: any) => b.title === 'Video 1');
    const bookmark2 = bookmarks.find((b: any) => b.title === 'Video 2');
    const bookmark3 = bookmarks.find((b: any) => b.title === 'Video 3');
    expect(bookmark1).toBeDefined();
    expect(bookmark2).toBeDefined();
    expect(bookmark3).toBeDefined();

    harness.clearMessages();

    // Configure file.exists: file1 and file3 are missing (return false)
    harness.deps.file.exists = ((path: string) => {
      if (path === bookmark1!.filepath || path === bookmark3!.filepath) return false;
      return true;
    }) as any;

    // Step 1: Send RECONCILE_FILES
    harness.send('sidebar', 'RECONCILE_FILES');

    // Verify SHOW_FILE_RECONCILIATION_DIALOG with movedFiles containing bookmark1 and bookmark3
    const dialogMsg = harness.getLastMessage('sidebar', 'SHOW_FILE_RECONCILIATION_DIALOG');
    expect(dialogMsg).toBeDefined();
    expect(dialogMsg.movedFiles).toHaveLength(2);
    const movedIds = dialogMsg.movedFiles.map((b: any) => b.id).sort();
    expect(movedIds).toEqual([bookmark1!.id, bookmark3!.id].sort());

    // Step 2: Send FILE_RECONCILIATION_REQUEST to update path for bookmark1
    // Store original path before mutation (getAllBookmarks returns object references)
    const bookmark1OriginalPath = bookmark1!.filepath;
    harness.clearMessages();
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'update_path',
      bookmarkId: bookmark1!.id,
      newPath: '/test/new-path.mp4',
    });

    // Verify FILE_RECONCILIATION_RESULT success
    const result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result).toMatchObject({
      success: true,
      action: 'update_path',
      bookmarkId: bookmark1!.id,
      oldPath: bookmark1OriginalPath,
      newPath: '/test/new-path.mp4',
    });

    // Verify bookmark was updated (use getAllBookmarks since bookmarks span multiple files)
    const updated = harness.manager.getAllBookmarks();
    const updatedB1 = updated.find((b: any) => b.id === bookmark1!.id);
    expect(updatedB1).toBeDefined();
    expect(updatedB1!.filepath).toBe('/test/new-path.mp4');
  });

  it('removes bookmark via reconciliation action', async () => {
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 10));

    const bookmarks = harness.getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    const bookmarkId = bookmarks[0].id;

    harness.clearMessages();

    // Send FILE_RECONCILIATION_REQUEST with remove_bookmark action
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'remove_bookmark',
      bookmarkId,
    });

    // Verify FILE_RECONCILIATION_RESULT success
    const result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result).toMatchObject({
      success: true,
      action: 'remove_bookmark',
      bookmarkId,
    });

    // Verify BOOKMARKS_UPDATED shows bookmark deleted
    const updated = harness.getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(updated).toBeDefined();
    expect(updated.find((b: any) => b.id === bookmarkId)).toBeUndefined();
  });

  it('reports empty movedFiles when all files exist', async () => {
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 10));

    harness.clearMessages();

    // Configure file.exists to return true for all
    harness.deps.file.exists = (() => true) as any;

    harness.send('sidebar', 'RECONCILE_FILES');

    const dialogMsg = harness.getLastMessage('sidebar', 'SHOW_FILE_RECONCILIATION_DIALOG');
    expect(dialogMsg).toBeDefined();
    expect(dialogMsg.movedFiles).toEqual([]);
  });

  it('rejects invalid new path (does not start with /)', async () => {
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 10));

    const bookmarks = harness.getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    const bookmark = bookmarks[0];

    harness.clearMessages();

    // Send FILE_RECONCILIATION_REQUEST with invalid newPath
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'update_path',
      bookmarkId: bookmark.id,
      newPath: 'relative/path.mp4', // Invalid: doesn't start with /
    });

    // Verify path NOT updated (no FILE_RECONCILIATION_RESULT sent)
    const result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result).toBeUndefined();

    // Verify error was logged
    expect(harness.deps.console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid new path'),
    );
  });

  it('handles nonexistent bookmark ID gracefully', () => {
    harness.clearMessages();

    // Send FILE_RECONCILIATION_REQUEST for nonexistent bookmark
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'update_path',
      bookmarkId: 'nonexistent',
      newPath: '/test/new.mp4',
    });

    // Verify no FILE_RECONCILIATION_RESULT (updateBookmarkPath finds no bookmark, returns early)
    const result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result).toBeUndefined();

    // No error should be logged for this case (it's handled gracefully)
    // The method simply returns early if bookmark is not found
  });

  it('treats files as missing when file.exists throws', async () => {
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 10));

    harness.deps.core.status.path = '/test/file2.mp4';
    harness.deps.core.status.currentTime = 120;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 2', timestamp: 120 });
    await new Promise((r) => setTimeout(r, 10));

    const bookmarks = harness.getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    const bookmark1 = bookmarks[0];

    harness.clearMessages();

    // Configure file.exists to throw for bookmark1's filepath
    harness.deps.file.exists = ((path: string) => {
      if (path === bookmark1.filepath) throw new Error('Permission denied');
      return true;
    }) as any;

    harness.send('sidebar', 'RECONCILE_FILES');

    // After Phase 0 fix, the catch block returns true (treats as missing)
    const dialogMsg = harness.getLastMessage('sidebar', 'SHOW_FILE_RECONCILIATION_DIALOG');
    expect(dialogMsg).toBeDefined();
    expect(dialogMsg.movedFiles).toHaveLength(1);
    expect(dialogMsg.movedFiles[0].id).toBe(bookmark1.id);
  });

  it('handles sequential reconciliation actions correctly', async () => {
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 50));

    harness.deps.core.status.path = '/test/file2.mp4';
    harness.deps.core.status.currentTime = 120;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 2', timestamp: 120 });
    await new Promise((r) => setTimeout(r, 50));

    harness.deps.core.status.path = '/test/file3.mp4';
    harness.deps.core.status.currentTime = 180;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 3', timestamp: 180 });
    await new Promise((r) => setTimeout(r, 50));

    // Use getAllBookmarks since bookmarks span multiple files
    const bookmarks = harness.manager.getAllBookmarks();
    const bookmark1 = bookmarks.find((b: any) => b.title === 'Video 1');
    const bookmark2 = bookmarks.find((b: any) => b.title === 'Video 2');
    const bookmark3 = bookmarks.find((b: any) => b.title === 'Video 3');

    harness.clearMessages();

    // Action 1: Update path for bookmark1
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'update_path',
      bookmarkId: bookmark1!.id,
      newPath: '/test/updated1.mp4',
    });

    let result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result.success).toBe(true);
    expect(result.newPath).toBe('/test/updated1.mp4');
    harness.clearMessages();

    // Action 2: Remove bookmark2
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'remove_bookmark',
      bookmarkId: bookmark2!.id,
    });

    result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result.success).toBe(true);
    expect(result.action).toBe('remove_bookmark');
    harness.clearMessages();

    // Action 3: Update path for bookmark3
    harness.send('sidebar', 'FILE_RECONCILIATION_REQUEST', {
      action: 'update_path',
      bookmarkId: bookmark3!.id,
      newPath: '/test/updated3.mp4',
    });

    result = harness.getLastMessage('sidebar', 'FILE_RECONCILIATION_RESULT');
    expect(result.success).toBe(true);
    expect(result.newPath).toBe('/test/updated3.mp4');

    // Verify final state: bookmark1 updated, bookmark2 deleted, bookmark3 updated
    const updated = harness.manager.getAllBookmarks();
    expect(updated).toHaveLength(2);
    expect(updated.find((b: any) => b.id === bookmark1!.id)!.filepath).toBe('/test/updated1.mp4');
    expect(updated.find((b: any) => b.id === bookmark2!.id)).toBeUndefined();
    expect(updated.find((b: any) => b.id === bookmark3!.id)!.filepath).toBe('/test/updated3.mp4');
  });
});
