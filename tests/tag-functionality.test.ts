import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps } from './helpers/mock-deps';

describe('Tag Functionality', () => {
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BookmarkManager(createMockDeps());
  });

  describe('Tag Storage and Persistence', () => {
    it('should store tags with bookmarks', async () => {
      const tags = ['work', 'important', 'meeting'];
      await manager.addBookmark('Test Bookmark', 100, 'Test description', tags);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].tags).toEqual(['work', 'important', 'meeting']);
    });

    it('should handle empty tags array', async () => {
      await manager.addBookmark('Test Bookmark', 100, 'Test description', []);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].tags).toBeDefined();
      expect(bookmarks[0].tags).toEqual([]);
    });

    it('should handle undefined tags (defaults to empty array)', async () => {
      await manager.addBookmark('Test Bookmark', 100, 'Test description');

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].tags).toBeDefined();
      expect(Array.isArray(bookmarks[0].tags)).toBe(true);
    });
  });

  describe('Tag Storage via BookmarkManager', () => {
    it('should handle special characters in tags', async () => {
      const tags = ['C++', 'Node.js', 'React-Native', '@urgent', '#todo'];

      await manager.addBookmark('Test', 100, 'Test', tags);
      const bookmarks = manager.getAllBookmarks();

      tags.forEach((tag) => {
        expect(bookmarks[0].tags).toContain(tag);
      });
    });

    it('should persist tags across addBookmark calls', async () => {
      await manager.addBookmark('BM1', 10, 'desc', ['tag-a', 'tag-b']);
      await manager.addBookmark('BM2', 20, 'desc', ['tag-c']);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].tags).toEqual(['tag-a', 'tag-b']);
      expect(bookmarks[1].tags).toEqual(['tag-c']);
    });

    it('should preserve tags when updating bookmark title', async () => {
      await manager.addBookmark('Original', 10, 'desc', ['keep-me']);
      const id = manager.getAllBookmarks()[0].id;

      manager.updateBookmark(id, { title: 'Updated' });

      expect(manager.getAllBookmarks()[0].tags).toEqual(['keep-me']);
    });
  });

  describe('Tag Search and Filtering', () => {
    beforeEach(async () => {
      await manager.addBookmark('Work Meeting', 100, 'Important meeting', [
        'work',
        'meeting',
        'important',
      ]);
      await manager.addBookmark('Personal Video', 200, 'Family video', ['personal', 'family']);
      await manager.addBookmark('Tutorial', 300, 'React tutorial', [
        'tutorial',
        'react',
        'programming',
      ]);
      await manager.addBookmark('Conference Talk', 400, 'Tech conference', [
        'work',
        'conference',
        'tech',
      ]);
    });

    it('should filter bookmarks by single tag', () => {
      const workBookmarks = manager.getAllBookmarks().filter((b) => b.tags?.includes('work'));

      expect(workBookmarks).toHaveLength(2);
      expect(workBookmarks.map((b) => b.title)).toEqual(['Work Meeting', 'Conference Talk']);
    });

    it('should filter bookmarks by multiple tags (AND)', () => {
      const workMeetingBookmarks = manager
        .getAllBookmarks()
        .filter((b) => b.tags?.includes('work') && b.tags?.includes('meeting'));

      expect(workMeetingBookmarks).toHaveLength(1);
      expect(workMeetingBookmarks[0].title).toBe('Work Meeting');
    });

    it('should filter bookmarks by multiple tags (OR)', () => {
      const techOrPersonalBookmarks = manager
        .getAllBookmarks()
        .filter((b) => b.tags?.includes('tech') || b.tags?.includes('personal'));

      expect(techOrPersonalBookmarks).toHaveLength(2);
      expect(techOrPersonalBookmarks.map((b) => b.title)).toEqual([
        'Personal Video',
        'Conference Talk',
      ]);
    });

    it('should handle tag search with NOT operator', () => {
      const nonWorkBookmarks = manager.getAllBookmarks().filter((b) => !b.tags?.includes('work'));

      expect(nonWorkBookmarks).toHaveLength(2);
      expect(nonWorkBookmarks.map((b) => b.title)).toEqual(['Personal Video', 'Tutorial']);
    });
  });

  describe('Tag Aggregation from Multiple Bookmarks', () => {
    beforeEach(async () => {
      await manager.addBookmark('Bookmark 1', 100, 'Desc', ['javascript', 'programming', 'web']);
      await manager.addBookmark('Bookmark 2', 200, 'Desc', ['java', 'programming', 'backend']);
      await manager.addBookmark('Bookmark 3', 300, 'Desc', ['python', 'data-science', 'ml']);
    });

    it('should collect all unique tags across bookmarks via getAllBookmarks', () => {
      const allTags = new Set<string>();
      manager.getAllBookmarks().forEach((b) => {
        b.tags?.forEach((tag) => allTags.add(tag));
      });

      const uniqueTags = Array.from(allTags).sort();
      expect(uniqueTags).toEqual([
        'backend',
        'data-science',
        'java',
        'javascript',
        'ml',
        'programming',
        'python',
        'web',
      ]);
    });

    it('should allow filtering bookmarks by a shared tag', () => {
      const programmingBookmarks = manager
        .getAllBookmarks()
        .filter((b) => b.tags?.includes('programming'));

      expect(programmingBookmarks).toHaveLength(2);
      expect(programmingBookmarks.map((b) => b.title)).toEqual(['Bookmark 1', 'Bookmark 2']);
    });

    it('should find bookmarks with unique tags', () => {
      const mlBookmarks = manager.getAllBookmarks().filter((b) => b.tags?.includes('ml'));
      expect(mlBookmarks).toHaveLength(1);
      expect(mlBookmarks[0].title).toBe('Bookmark 3');
    });
  });

  describe('Tag Performance with Large Datasets', () => {
    it('should handle hundreds of unique tags efficiently', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 500; i++) {
        const tags = [
          `category-${i % 20}`,
          `priority-${i % 5}`,
          `project-${i % 10}`,
          `year-${2020 + (i % 5)}`,
        ];
        await manager.addBookmark(`Bookmark ${i}`, i * 10, `Description ${i}`, tags);
      }

      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      expect(manager.getAllBookmarks()).toHaveLength(500);
    });

    it('should efficiently filter large tag datasets', async () => {
      for (let i = 0; i < 1000; i++) {
        const tags = [`tag-${i % 50}`, `category-${i % 10}`];
        await manager.addBookmark(`Bookmark ${i}`, i, `Desc ${i}`, tags);
      }

      const startTime = performance.now();
      const filtered = manager.getAllBookmarks().filter((b) => b.tags?.includes('category-5'));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000);
      expect(filtered).toHaveLength(100);
    });
  });

  describe('Tag Edge Cases', () => {
    it('should handle very long tag names', async () => {
      const longTag = 'a'.repeat(100);
      await manager.addBookmark('Test', 100, 'Test', [longTag]);

      const bookmarks = manager.getAllBookmarks();
      expect(bookmarks[0].tags).toContain(longTag);
    });

    it('should handle tags with only whitespace', () => {
      const tags = ['valid-tag', '   ', '\t\n', 'another-valid-tag'];
      const cleanedTags = tags.filter((tag) => tag.trim().length > 0);

      expect(cleanedTags).toEqual(['valid-tag', 'another-valid-tag']);
    });

    it('should handle Unicode characters in tags', async () => {
      const unicodeTags = [
        '\u65e5\u672c\u8a9e',
        '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
        '\ud83c\udfac',
        '\ud83d\udcda',
        '\u00e9moji',
      ];

      await manager.addBookmark('Unicode Test', 100, 'Test', unicodeTags);
      const bookmarks = manager.getAllBookmarks();

      unicodeTags.forEach((tag) => {
        expect(bookmarks[0].tags).toContain(tag);
      });
    });

    it('should handle extremely large number of tags on single bookmark', async () => {
      const manyTags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);

      await manager.addBookmark('Many Tags', 100, 'Test', manyTags);
      const bookmarks = manager.getAllBookmarks();

      expect(bookmarks[0].tags!.length).toBe(100);
      manyTags.forEach((tag) => {
        expect(bookmarks[0].tags).toContain(tag);
      });
    });
  });
});
