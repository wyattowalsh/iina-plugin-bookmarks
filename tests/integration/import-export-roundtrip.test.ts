import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestHarness, makeBookmark } from './helpers';
import type { ImportOptions } from '../../src/types';

describe('Import/Export Round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should round-trip JSON export and import with full fidelity', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 100;

    // Add 5 bookmarks
    const bookmarks = [
      { title: 'First', timestamp: 10, tags: ['tag1'] },
      { title: 'Second', timestamp: 20, tags: ['tag2', 'tag3'] },
      { title: 'Third', timestamp: 30, tags: [] },
      { title: 'Fourth', timestamp: 40, tags: ['tag4'] },
      { title: 'Fifth', timestamp: 50, tags: ['tag5', 'tag6'] },
    ];

    for (const bm of bookmarks) {
      send('sidebar', 'ADD_BOOKMARK', bm);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Export as JSON
    send('sidebar', 'EXPORT_BOOKMARKS', { format: 'json' });

    const exportResult = getLastMessage('sidebar', 'EXPORT_RESULT');
    expect(exportResult).toBeDefined();
    expect(exportResult.format).toBe('json');
    expect(exportResult.content).toBeDefined();

    const exported = JSON.parse(exportResult.content);
    expect(exported.length).toBe(5);

    // Test fidelity: verify all expected fields are present in export
    for (let i = 0; i < 5; i++) {
      const original = bookmarks[i];
      const found = exported.find((b: any) => b.title === original.title);
      expect(found).toBeDefined();
      expect(found.timestamp).toBe(original.timestamp);
      expect(found.tags).toEqual(original.tags);
      expect(found.id).toBeDefined();
      expect(found.filepath).toBe('/test/video.mp4');
      expect(found.createdAt).toBeDefined();
      expect(found.updatedAt).toBeDefined();
    }

    // Create a NEW harness (simulating a fresh session) and import
    const { send: send2, getLastMessage: getLastMessage2 } = createTestHarness();

    send2('sidebar', 'IMPORT_BOOKMARKS', { bookmarks: exported, options: { preserveIds: true } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const importResult = getLastMessage2('sidebar', 'IMPORT_RESULT');
    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBe(5);

    // Verify reimported bookmarks match original
    const reimported = getLastMessage2('sidebar', 'BOOKMARKS_UPDATED');
    expect(reimported.length).toBe(5);

    for (let i = 0; i < 5; i++) {
      const original = bookmarks[i];
      const found = reimported.find((b: any) => b.title === original.title);
      expect(found).toBeDefined();
      expect(found.timestamp).toBe(original.timestamp);
      expect(found.tags).toEqual(original.tags);
    }
  });

  it('should export bookmarks as CSV with headers', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';
    deps.core.status.currentTime = 100;

    send('sidebar', 'ADD_BOOKMARK', {
      title: 'CSV Test',
      timestamp: 123,
      tags: ['csv', 'export'],
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    send('sidebar', 'EXPORT_BOOKMARKS', { format: 'csv' });

    const exportResult = getLastMessage('sidebar', 'EXPORT_RESULT');
    expect(exportResult).toBeDefined();
    expect(exportResult.format).toBe('csv');
    expect(exportResult.content).toContain('id,title,timestamp,filepath');
    expect(exportResult.content).toContain('CSV Test');
    expect(exportResult.content).toContain('123');
    expect(exportResult.content).toContain('csv;export');
  });

  it('should merge bookmarks with merge option', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';

    // Add initial bookmark
    send('sidebar', 'ADD_BOOKMARK', { title: 'Original', timestamp: 100, tags: ['tag1'] });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const originalId = getLastMessage('sidebar', 'BOOKMARKS_UPDATED')[0].id;

    // Import overlapping bookmark with same ID but different tags
    const overlapping = [
      {
        id: originalId,
        title: 'Original',
        timestamp: 100,
        filepath: '/test/video.mp4',
        tags: ['tag2', 'tag3'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const options: ImportOptions = { duplicateHandling: 'merge', preserveIds: true };
    send('sidebar', 'IMPORT_BOOKMARKS', { bookmarks: overlapping, options });

    const importResult = getLastMessage('sidebar', 'IMPORT_RESULT');
    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBe(1);

    const merged = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(merged.length).toBe(1);
    // Tags should be merged
    expect(merged[0].tags).toContain('tag1');
    expect(merged[0].tags).toContain('tag2');
    expect(merged[0].tags).toContain('tag3');
  });

  it('should replace bookmarks with replace option', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';

    // Add initial bookmarks
    send('sidebar', 'ADD_BOOKMARK', { title: 'Set A - 1', timestamp: 10 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    send('sidebar', 'ADD_BOOKMARK', { title: 'Set A - 2', timestamp: 20 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const setA = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(setA.length).toBe(2);

    // Import new set with replace option
    const setB = [makeBookmark('b1', 'Set B - 1', 100), makeBookmark('b2', 'Set B - 2', 200)];

    const options: ImportOptions = { duplicateHandling: 'replace', preserveIds: true };
    send('sidebar', 'IMPORT_BOOKMARKS', { bookmarks: setB, options });

    const importResult = getLastMessage('sidebar', 'IMPORT_RESULT');
    expect(importResult.success).toBe(true);

    const final = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    // Should have original 2 + new 2 = 4 total (replace only affects duplicates)
    expect(final.length).toBe(4);
  });

  it('should report correct counts for mixed valid/invalid import data', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';

    // Mixed array: some valid, some invalid
    const mixed = [
      makeBookmark('1', 'Valid 1', 100),
      { invalid: 'data' }, // Missing required fields - will be filtered by validateBookmarkArray
      makeBookmark('2', 'Valid 2', 200),
      { title: 'Invalid Timestamp', timestamp: -999, filepath: '/test/file.mp4' }, // Will be skipped due to invalid timestamp
      makeBookmark('3', 'Valid 3', 300),
    ];

    send('sidebar', 'IMPORT_BOOKMARKS', { bookmarks: mixed });

    const importResult = getLastMessage('sidebar', 'IMPORT_RESULT');
    expect(importResult.success).toBe(true);
    // Should import 3 valid bookmarks
    expect(importResult.importedCount).toBe(3);
    // Invalid entries are filtered before processing, so skippedCount is 0
    expect(importResult.skippedCount).toBe(0);

    // Verify the 3 valid bookmarks were added
    const bookmarks = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(bookmarks.length).toBe(3);
    expect(bookmarks.find((b: any) => b.title === 'Valid 1')).toBeDefined();
    expect(bookmarks.find((b: any) => b.title === 'Valid 2')).toBeDefined();
    expect(bookmarks.find((b: any) => b.title === 'Valid 3')).toBeDefined();
  });

  it('should export empty JSON array when no bookmarks exist', () => {
    const { send, getLastMessage } = createTestHarness();

    send('sidebar', 'EXPORT_BOOKMARKS', { format: 'json' });

    const exportResult = getLastMessage('sidebar', 'EXPORT_RESULT');
    expect(exportResult).toBeDefined();
    expect(exportResult.format).toBe('json');

    const parsed = JSON.parse(exportResult.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(0);
  });

  it('should skip duplicates when re-importing the same bookmarks', async () => {
    const { send, getLastMessage, deps } = createTestHarness();

    deps.core.status.path = '/test/video.mp4';

    // Add 3 bookmarks
    const bookmarks = [
      { title: 'Bookmark 1', timestamp: 10 },
      { title: 'Bookmark 2', timestamp: 20 },
      { title: 'Bookmark 3', timestamp: 30 },
    ];

    for (const bm of bookmarks) {
      send('sidebar', 'ADD_BOOKMARK', bm);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Export
    send('sidebar', 'EXPORT_BOOKMARKS', { format: 'json' });
    const exportResult = getLastMessage('sidebar', 'EXPORT_RESULT');
    const exported = JSON.parse(exportResult.content);

    // Re-import with skip (default behavior)
    const options: ImportOptions = { duplicateHandling: 'skip', preserveIds: true };
    send('sidebar', 'IMPORT_BOOKMARKS', { bookmarks: exported, options });

    const importResult = getLastMessage('sidebar', 'IMPORT_RESULT');
    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBe(0); // All should be skipped
    expect(importResult.skippedCount).toBe(3);

    // Total should still be 3
    const final = getLastMessage('sidebar', 'BOOKMARKS_UPDATED');
    expect(final.length).toBe(3);
  });
});
