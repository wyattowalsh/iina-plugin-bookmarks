// Integration tests for cloud sync workflow end-to-end
// Tests upload, download, sync, timeout, concurrency, and error handling

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers';
import { getCloudStorageManager } from '../../src/cloud-storage';

// Get the shared mock instance (same singleton BookmarkManager's CloudSyncHandler uses)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cloudMock = (getCloudStorageManager as any)();

describe('Cloud sync E2E', () => {
  let harness: TestHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cloud mock method implementations so tests don't leak
    cloudMock.setProvider.mockReset();
    cloudMock.uploadBookmarks.mockReset();
    cloudMock.downloadBookmarks.mockReset();
    cloudMock.listBackups.mockReset();
    cloudMock.syncBookmarks.mockReset();
    harness = createTestHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uploads bookmarks successfully', async () => {
    // Setup: Add bookmarks
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 10));

    harness.deps.core.status.path = '/test/file2.mp4';
    harness.deps.core.status.currentTime = 120;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 2', timestamp: 120 });
    await new Promise((r) => setTimeout(r, 10));

    harness.clearMessages();

    // Configure cloud storage mock to succeed
    cloudMock.setProvider.mockResolvedValue(true);
    cloudMock.uploadBookmarks.mockResolvedValue('backup-12345');

    // Send CLOUD_SYNC_REQUEST with upload action
    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'upload',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Wait for async operation to complete
    await new Promise((r) => setTimeout(r, 50));

    // Verify CLOUD_SYNC_RESULT
    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.action).toBe('upload');
    expect(result.message).toContain('2 bookmarks');
  });

  it('downloads bookmarks successfully', async () => {
    // Configure cloud mock to return bookmarks on download
    const downloadedBookmarks = [
      {
        id: 'remote-1',
        title: 'Remote Video 1',
        timestamp: 60,
        filepath: '/remote/file1.mp4',
        description: 'Remote desc',
        createdAt: '2026-02-16T12:00:00Z',
        updatedAt: '2026-02-16T12:00:00Z',
        tags: [],
      },
      {
        id: 'remote-2',
        title: 'Remote Video 2',
        timestamp: 120,
        filepath: '/remote/file2.mp4',
        description: 'Remote desc',
        createdAt: '2026-02-16T12:00:00Z',
        updatedAt: '2026-02-16T12:00:00Z',
        tags: [],
      },
    ];

    const backupData = {
      bookmarks: downloadedBookmarks,
      metadata: {
        version: '1.0.0',
        createdAt: '2026-02-16T12:00:00Z',
        totalBookmarks: 2,
        device: 'MacBook',
        userAgent: 'IINA',
      },
    };

    // Configure cloud storage mock
    cloudMock.setProvider.mockResolvedValue(true);
    cloudMock.listBackups.mockResolvedValue(['backup-2026-02-16', 'backup-2026-02-15']);
    cloudMock.downloadBookmarks.mockResolvedValue(backupData);

    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'download',
      provider: 'dropbox',
      credentials: { accessToken: 'test-token' },
    });

    // Wait for async operation
    await new Promise((r) => setTimeout(r, 50));

    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.action).toBe('download');
    expect(result.bookmarks).toHaveLength(2);
    expect(result.bookmarks[0].id).toBe('remote-1');
  });

  it('syncs/merges bookmarks successfully', async () => {
    // Setup local bookmark
    harness.deps.core.status.path = '/test/file1.mp4';
    harness.deps.core.status.currentTime = 60;
    harness.send('sidebar', 'ADD_BOOKMARK', { title: 'Video 1', timestamp: 60 });
    await new Promise((r) => setTimeout(r, 10));

    harness.clearMessages();

    // Mock sync response with merged bookmarks
    const mergedBookmarks = [
      {
        id: '1',
        title: 'Video 1 (updated)',
        timestamp: 60,
        filepath: '/test/file1.mp4',
        description: 'Updated',
        createdAt: '2026-02-16T12:00:00Z',
        updatedAt: '2026-02-16T12:30:00Z',
        tags: [],
      },
      {
        id: '2',
        title: 'Video 2 (new)',
        timestamp: 120,
        filepath: '/test/file2.mp4',
        description: 'New',
        createdAt: '2026-02-16T12:00:00Z',
        updatedAt: '2026-02-16T12:00:00Z',
        tags: [],
      },
    ];

    // Configure cloud storage mock for sync
    cloudMock.setProvider.mockResolvedValue(true);
    cloudMock.syncBookmarks.mockResolvedValue({
      merged: mergedBookmarks,
      added: 1,
      updated: 1,
      conflicts: [],
    });

    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'sync',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Wait for async operation
    await new Promise((r) => setTimeout(r, 50));

    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.action).toBe('sync');
    expect(result.syncStats).toBeDefined();
    expect(result.syncStats.total).toBeGreaterThan(0);

    // Verify BOOKMARKS_UPDATED was sent
    const updated = harness.getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(updated).toBeDefined();
  });

  it('rejects concurrent sync requests', async () => {
    // Configure cloud mock with never-resolving setProvider to keep first sync in-progress
    cloudMock.setProvider.mockReturnValue(new Promise(() => {}));

    // Start first sync
    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'upload',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Wait a bit for the sync to start
    await new Promise((r) => setTimeout(r, 10));
    harness.clearMessages();

    // Try to start second sync
    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'upload',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Wait for response
    await new Promise((r) => setTimeout(r, 10));

    // Verify second request gets rejected
    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in progress');
  });

  it('handles authentication failure', async () => {
    // Configure cloud mock to fail auth (setProvider returns false)
    cloudMock.setProvider.mockResolvedValue(false);

    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'upload',
      provider: 'gdrive',
      credentials: { accessToken: 'invalid-token' },
    });

    // Wait for response
    await new Promise((r) => setTimeout(r, 50));

    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles sync timeout after 60s', async () => {
    vi.useFakeTimers();

    // setProvider resolves so handleSync progresses, but uploadBookmarks never resolves
    cloudMock.setProvider.mockResolvedValue(true);
    cloudMock.uploadBookmarks.mockReturnValue(new Promise(() => {}));

    // Start sync
    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'upload',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Flush microtasks so handleSync advances past setProvider to uploadBookmarks (stuck)
    await vi.advanceTimersByTimeAsync(0);
    harness.clearMessages();

    // Advance time by 60s + 1ms to trigger timeout
    await vi.advanceTimersByTimeAsync(60001);

    // Verify timeout result
    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out after 60 seconds');

    // Store message count
    const messageCount = harness.getMessages('sidebar', 'CLOUD_SYNC_RESULT').length;

    // Verify no additional results are sent
    await vi.runAllTimersAsync();

    // No additional CLOUD_SYNC_RESULT should be sent
    const newMessageCount = harness.getMessages('sidebar', 'CLOUD_SYNC_RESULT').length;
    expect(newMessageCount).toBe(messageCount);

    // Verify lock was released: a retry sync should succeed (not be rejected as "already in progress")
    cloudMock.setProvider.mockResolvedValue(true);
    cloudMock.uploadBookmarks.mockResolvedValue('backup-retry');

    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'upload',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Flush microtasks for the retry sync to complete
    await vi.advanceTimersByTimeAsync(0);

    const retryResult = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(retryResult).toBeDefined();
    expect(retryResult.success).toBe(true);
    expect(retryResult.action).toBe('upload');
  });

  it('handles download when no backups exist', async () => {
    // Configure cloud mock: auth succeeds but no backups
    cloudMock.setProvider.mockResolvedValue(true);
    cloudMock.listBackups.mockResolvedValue([]);

    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'download',
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Wait for response
    await new Promise((r) => setTimeout(r, 50));

    const result = harness.getLastMessage('sidebar', 'CLOUD_SYNC_RESULT');
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No backups found');
  });

  it('handles unknown action gracefully', async () => {
    const initialMessageCount = harness.getMessages('sidebar', 'CLOUD_SYNC_RESULT').length;

    // Send unknown action
    harness.send('sidebar', 'CLOUD_SYNC_REQUEST', {
      action: 'unknown-action' as any,
      provider: 'gdrive',
      credentials: { accessToken: 'test-token' },
    });

    // Wait a bit
    await new Promise((r) => setTimeout(r, 50));

    // Unknown actions return null from handleSync, which means no bookmarks update
    // but also no error result. The finally block clears the lock.
    // Verify warning was logged
    expect(harness.deps.console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown cloud sync action'),
    );

    // No CLOUD_SYNC_RESULT should be sent for unknown actions (returns null)
    const finalMessageCount = harness.getMessages('sidebar', 'CLOUD_SYNC_RESULT').length;
    expect(finalMessageCount).toBe(initialMessageCount);
  });
});
