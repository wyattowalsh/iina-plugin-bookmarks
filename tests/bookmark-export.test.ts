import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps } from './helpers/mock-deps';

describe('Bookmark Export Functionality', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  describe('Bookmark data retrieval for export', () => {
    it('should retrieve all bookmarks for export via getAllBookmarks', async () => {
      await manager.addBookmark('Export Test 1', 1200, 'First bookmark', ['test', 'sample']);
      await manager.addBookmark('Export Test 2', 2400, 'Second bookmark', ['test', 'demo']);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].title).toBe('Export Test 1');
      expect(bookmarks[0].timestamp).toBe(1200);
      expect(bookmarks[0].description).toBe('First bookmark');
      expect(bookmarks[0].tags).toEqual(['test', 'sample']);
      expect(bookmarks[1].title).toBe('Export Test 2');
    });

    it('should include all required fields for export', async () => {
      await manager.addBookmark('Field Check', 100, 'desc', ['tag']);

      const bookmark = manager.getAllBookmarks()[0];
      expect(bookmark).toHaveProperty('id');
      expect(bookmark).toHaveProperty('title');
      expect(bookmark).toHaveProperty('timestamp');
      expect(bookmark).toHaveProperty('filepath');
      expect(bookmark).toHaveProperty('description');
      expect(bookmark).toHaveProperty('createdAt');
      expect(bookmark).toHaveProperty('tags');
    });

    it('should preserve bookmark data integrity across add and retrieve', async () => {
      await manager.addBookmark('Integrity Test', 3600, 'Full description', ['a', 'b']);

      const bookmark = manager.getAllBookmarks()[0];
      expect(bookmark.title).toBe('Integrity Test');
      expect(bookmark.timestamp).toBe(3600);
      expect(bookmark.description).toBe('Full description');
      expect(bookmark.tags).toEqual(['a', 'b']);
      expect(bookmark.filepath).toBe('/test/video.mp4');
      expect(bookmark.createdAt).toBeTruthy();
    });
  });

  describe('Bookmark filtering for export', () => {
    it('should filter bookmarks by filepath via getBookmarksForFile', async () => {
      await manager.addBookmark('Video 1 BM', 100);
      (deps.core.status as any).path = '/other/movie.mp4';
      await manager.addBookmark('Video 2 BM', 200);

      const filtered = manager.getBookmarksForFile('/test/video.mp4');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Video 1 BM');
    });

    it('should return all bookmarks when no filter path is given', async () => {
      await manager.addBookmark('BM1', 10);
      await manager.addBookmark('BM2', 20);

      expect(manager.getBookmarksForFile()).toHaveLength(2);
    });
  });

  describe('Bookmark serialization for export', () => {
    it('should produce valid JSON when serializing bookmarks', async () => {
      await manager.addBookmark('JSON Test', 1500, 'A description', ['json']);

      const bookmarks = manager.getAllBookmarks();
      const json = JSON.stringify(bookmarks);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('JSON Test');
    });

    it('should handle special characters in bookmark data', async () => {
      await manager.addBookmark(
        'Title with "quotes" & [brackets]',
        1000,
        'Description with\nnewlines',
        ['special/chars'],
      );

      const bookmarks = manager.getAllBookmarks();
      const json = JSON.stringify(bookmarks);
      const parsed = JSON.parse(json);

      expect(parsed[0].title).toBe('Title with "quotes" & [brackets]');
      expect(parsed[0].description).toBe('Description with\nnewlines');
    });

    it('should handle empty bookmark list for export', () => {
      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(0);

      const json = JSON.stringify({ bookmarks, metadata: { totalRecords: 0 } });
      const parsed = JSON.parse(json);
      expect(parsed.bookmarks).toHaveLength(0);
    });
  });

  describe('Bookmark count tracking', () => {
    it('should accurately report bookmark count', async () => {
      expect(manager.getBookmarkCount()).toBe(0);

      await manager.addBookmark('BM1', 10);
      expect(manager.getBookmarkCount()).toBe(1);

      await manager.addBookmark('BM2', 20);
      expect(manager.getBookmarkCount()).toBe(2);
    });
  });
});
