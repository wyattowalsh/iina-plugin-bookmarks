import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps as _createMockDeps } from './helpers/mock-deps';

/** Wrapper that accepts path/time overrides for metadata tests */
function createMockDeps(
  pathOverride?: string,
  currentTimeOverride?: number,
): IINARuntimeDependencies {
  const deps = _createMockDeps();
  if (pathOverride !== undefined) {
    (deps.core.status as any).path = pathOverride;
  }
  if (currentTimeOverride !== undefined) {
    (deps.core.status as any).currentTime = currentTimeOverride;
  }
  return deps;
}

describe('Metadata Auto-Population', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  describe('Smart Title Generation', () => {
    it('should generate title from filename and timestamp when no title is provided', async () => {
      await manager.addBookmark(undefined, 100);
      const bookmarks = manager.getAllBookmarks();

      // Title should contain cleaned filename ("video") and formatted time ("1:40")
      expect(bookmarks[0].title).toContain('video');
      expect(bookmarks[0].title).toContain('1:40');
    });

    it('should handle TV show episode naming patterns', async () => {
      const tvDeps = createMockDeps('/tv/shows/Breaking.Bad.S01E01.720p.mkv', 300);
      const tvManager = new BookmarkManager(tvDeps);

      await tvManager.addBookmark(undefined, 300);
      const bookmarks = tvManager.getAllBookmarks();

      // Title should be derived from filename
      expect(bookmarks[0].title).toContain('Breaking.Bad.S01E01.720p');
      expect(bookmarks[0].title).toContain('5:00');
    });

    it('should include timestamp information for context', async () => {
      await manager.addBookmark(undefined, 3661); // 1:01:01
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].title).toContain('1:01:01');
    });

    it('should handle international characters in filenames', async () => {
      const intlDeps = createMockDeps('/movies/\u4e03\u6b66\u58eb.1954.Criterion.1080p.mkv', 100);
      const intlManager = new BookmarkManager(intlDeps);

      await intlManager.addBookmark(undefined, 100);
      const bookmarks = intlManager.getAllBookmarks();

      expect(bookmarks[0].title).toContain('\u4e03\u6b66\u58eb.1954.Criterion.1080p');
    });
  });

  describe('Description Generation', () => {
    it('should generate default description when none provided', async () => {
      await manager.addBookmark(undefined, 100);
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].description).toContain('Bookmark at');
      expect(bookmarks[0].description).toContain('1:40');
    });

    it('should include time marker in auto-generated description', async () => {
      await manager.addBookmark(undefined, 1800); // 30 minutes
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].description).toContain('30:00');
    });
  });

  describe('Tag Handling', () => {
    it('should use empty tags array when no tags are provided', async () => {
      await manager.addBookmark(undefined, 100);
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].tags).toEqual([]);
    });

    it('should preserve user-provided tags exactly', async () => {
      await manager.addBookmark(undefined, 100, undefined, ['custom-tag', 'user-defined']);
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].tags).toEqual(['custom-tag', 'user-defined']);
    });
  });

  describe('User Override Capabilities', () => {
    it('should allow user to override auto-generated title', async () => {
      await manager.addBookmark('Custom Title', 100);
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].title).toBe('Custom Title');
    });

    it('should allow user to override auto-generated description', async () => {
      await manager.addBookmark(undefined, 100, 'Custom description');
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].description).toBe('Custom description');
    });

    it('should use provided tags as-is', async () => {
      await manager.addBookmark(undefined, 100, undefined, ['custom-tag', 'user-defined']);
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].tags).toEqual(['custom-tag', 'user-defined']);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle files with no extension gracefully', async () => {
      const noExtDeps = createMockDeps('/content/unknown_file', 100);
      const noExtManager = new BookmarkManager(noExtDeps);

      await noExtManager.addBookmark(undefined, 100);
      const bookmarks = noExtManager.getAllBookmarks();

      expect(bookmarks[0].title).toContain('unknown_file');
    });

    it('should handle very long file paths', async () => {
      const longPath = '/very/long/path/with/many/nested/directories/Movie.Title.2023.1080p.mkv';
      const longDeps = createMockDeps(longPath, 100);
      const longManager = new BookmarkManager(longDeps);

      await longManager.addBookmark(undefined, 100);
      const bookmarks = longManager.getAllBookmarks();

      expect(bookmarks[0].title).toContain('Movie.Title.2023.1080p');
    });

    it('should generate metadata efficiently for multiple bookmarks', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        await manager.addBookmark(undefined, i * 60);
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(50);

      // All bookmarks should have auto-generated titles and descriptions
      bookmarks.forEach((bookmark) => {
        expect(bookmark.title).toBeDefined();
        expect(bookmark.title.length).toBeGreaterThan(0);
        expect(bookmark.description).toBeDefined();
      });
    });
  });
});
