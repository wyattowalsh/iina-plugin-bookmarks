import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BookmarkManager } from '../src/bookmark-manager';

describe('Bookmark Import Functionality', () => {
  let bookmarkManager: BookmarkManager;
  let mockDependencies: any;
  let mockFileContent: string;

  beforeEach(() => {
    mockFileContent = '';
    
    mockDependencies = {
      console: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      },
      preferences: {
        get: vi.fn(),
        set: vi.fn()
      },
      core: {
        status: {
          path: '/test/video.mp4',
          currentTime: 120.5,
          title: 'Test Video',
          duration: 3600
        }
      },
      event: {
        on: vi.fn()
      },
      menu: {
        addItem: vi.fn(),
        item: vi.fn(() => ({}))
      },
      utils: {
        chooseFile: vi.fn(),
        prompt: vi.fn(),
        ask: vi.fn()
      },
      file: {
        write: vi.fn(),
        read: vi.fn(() => mockFileContent),
        exists: vi.fn(() => true)
      },
      sidebar: {
        loadFile: vi.fn(),
        postMessage: vi.fn(),
        onMessage: vi.fn()
      },
      overlay: {
        loadFile: vi.fn(),
        postMessage: vi.fn(),
        onMessage: vi.fn(),
        setClickable: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        isVisible: vi.fn(() => false)
      },
      standaloneWindow: {
        loadFile: vi.fn(),
        postMessage: vi.fn(),
        onMessage: vi.fn(),
        show: vi.fn()
      }
    };

    bookmarkManager = new BookmarkManager(mockDependencies);
  });

  describe('JSON Import', () => {
    it('should import valid JSON array of bookmarks', async () => {
      const testBookmarks = [
        {
          id: 'test-1',
          title: 'Test Bookmark 1',
          timestamp: 120.5,
          filepath: '/test/video1.mp4',
          description: 'Test description',
          createdAt: '2024-01-01T00:00:00.000Z',
          tags: ['tag1', 'tag2']
        },
        {
          id: 'test-2',
          title: 'Test Bookmark 2',
          timestamp: 240.0,
          filepath: '/test/video2.mp4',
          description: '',
          createdAt: '2024-01-02T00:00:00.000Z',
          tags: []
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);
      mockDependencies.utils.chooseFile.mockReturnValue('/test/bookmarks.json');

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('should import wrapped JSON format with bookmarks property', async () => {
      const wrappedData = {
        bookmarks: [
          {
            id: 'test-1',
            title: 'Test Bookmark',
            timestamp: 120.5,
            filepath: '/test/video.mp4',
            description: 'Test description',
            createdAt: '2024-01-01T00:00:00.000Z',
            tags: ['tag1']
          }
        ],
        metadata: {
          exportDate: '2024-01-01T00:00:00.000Z',
          version: '1.0'
        }
      };

      mockFileContent = JSON.stringify(wrappedData);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('should handle invalid JSON format', async () => {
      mockFileContent = 'invalid json content';

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors?.[0]).toContain('Failed to parse JSON file');
    });

    it('should handle JSON with wrong structure', async () => {
      mockFileContent = JSON.stringify({ notBookmarks: [] });

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors?.[0]).toContain('must contain an array of bookmarks');
    });
  });

  describe('CSV Import', () => {
    it('should import valid CSV file with all fields', async () => {
      mockFileContent = `id,title,timestamp,filepath,description,createdAt,tags
test-1,"Test Bookmark 1",120.5,"/test/video1.mp4","Test description","2024-01-01T00:00:00.000Z","[""tag1"",""tag2""]"
test-2,"Test Bookmark 2",240.0,"/test/video2.mp4","","2024-01-02T00:00:00.000Z","[]"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('should import CSV with comma-separated tags', async () => {
      mockFileContent = `id,title,timestamp,filepath,tags
test-1,"Test Bookmark",120.5,"/test/video.mp4","tag1,tag2,tag3"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('should import CSV with minimum required fields', async () => {
      mockFileContent = `id,title,timestamp,filepath
test-1,"Test Bookmark",120.5,"/test/video.mp4"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('should handle CSV with quoted fields containing commas', async () => {
      mockFileContent = `id,title,timestamp,filepath,description
test-1,"Test, with comma",120.5,"/test/video.mp4","Description, with comma"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('should handle CSV with escaped quotes', async () => {
      mockFileContent = `id,title,timestamp,filepath,description
test-1,"Title with ""quotes""",120.5,"/test/video.mp4","Description with ""quotes"""`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('should fail on CSV missing required headers', async () => {
      mockFileContent = `title,timestamp
"Test Bookmark",120.5`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors?.[0]).toContain('missing required headers');
    });

    it('should skip empty lines in CSV', async () => {
      mockFileContent = `id,title,timestamp,filepath
test-1,"Test Bookmark 1",120.5,"/test/video1.mp4"

test-2,"Test Bookmark 2",240.0,"/test/video2.mp4"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
    });

    it('should handle malformed CSV lines gracefully', async () => {
      mockFileContent = `id,title,timestamp,filepath
test-1,"Test Bookmark 1",120.5,"/test/video1.mp4"
test-2,"Missing field",240.0
test-3,"Test Bookmark 3",360.0,"/test/video3.mp4"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2); // Should skip the malformed line
      expect(mockDependencies.console.warn).toHaveBeenCalledWith(
        expect.stringContaining('CSV line 3 has 3 values but expected 4')
      );
    });
  });

  describe('File Format Detection', () => {
    it('should detect JSON format by extension', () => {
      const format = bookmarkManager['detectFileFormat']('/test/bookmarks.json', '[]');
      expect(format).toBe('json');
    });

    it('should detect CSV format by extension', () => {
      const format = bookmarkManager['detectFileFormat']('/test/bookmarks.csv', 'id,title');
      expect(format).toBe('csv');
    });

    it('should detect JSON format by content when no extension', () => {
      const format = bookmarkManager['detectFileFormat']('/test/bookmarks', '[]');
      expect(format).toBe('json');
    });

    it('should default to CSV format when content is not JSON', () => {
      const format = bookmarkManager['detectFileFormat']('/test/bookmarks', 'id,title');
      expect(format).toBe('csv');
    });
  });

  describe('Duplicate Handling', () => {
    beforeEach(async () => {
      // Add existing bookmark
      await bookmarkManager.addBookmark('Existing Bookmark', 120.5, 'Existing description', ['existing']);
    });

    it('should skip duplicates when duplicateHandling is "skip"', async () => {
      const testBookmarks = [
        {
          id: 'different-id',
          title: 'Existing Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4',
          description: 'New description',
          createdAt: '2024-01-01T00:00:00.000Z',
          tags: ['new']
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: false
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.duplicates).toBe(1);
    });

    it('should replace duplicates when duplicateHandling is "replace"', async () => {
      const testBookmarks = [
        {
          id: 'different-id',
          title: 'Existing Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4',
          description: 'New description',
          createdAt: '2024-01-01T00:00:00.000Z',
          tags: ['new']
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'replace',
        validateData: true,
        preserveIds: false
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.duplicates).toBe(1);
    });

    it('should merge duplicates when duplicateHandling is "merge"', async () => {
      const testBookmarks = [
        {
          id: 'different-id',
          title: 'Existing Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4',
          description: 'New description',
          createdAt: '2024-01-01T00:00:00.000Z',
          tags: ['new', 'merged']
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'merge',
        validateData: true,
        preserveIds: false
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.duplicates).toBe(1);
    });
  });

  describe('Data Validation', () => {
    it('should validate required fields when validateData is true', async () => {
      const invalidBookmarks = [
        {
          id: '',
          title: 'Test Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4'
        },
        {
          id: 'test-2',
          title: '',
          timestamp: 120.5,
          filepath: '/test/video.mp4'
        },
        {
          id: 'test-3',
          title: 'Test Bookmark',
          timestamp: -1,
          filepath: '/test/video.mp4'
        },
        {
          id: 'test-4',
          title: 'Test Bookmark',
          timestamp: 120.5,
          filepath: ''
        }
      ];

      mockFileContent = JSON.stringify(invalidBookmarks);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should skip validation when validateData is false', async () => {
      const validBookmarks = [
        {
          id: 'test-1',
          title: 'Test Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4'
        }
      ];

      mockFileContent = JSON.stringify(validBookmarks);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/bookmarks.json', {
        duplicateHandling: 'skip',
        validateData: false,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found error', async () => {
      mockDependencies.file.exists.mockReturnValue(false);

      const result = await bookmarkManager['importBookmarksFromFile']('/test/missing.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors?.[0]).toContain('File does not exist');
    });

    it('should handle empty file error', async () => {
      mockFileContent = '';

      const result = await bookmarkManager['importBookmarksFromFile']('/test/empty.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors?.[0]).toContain('File is empty');
    });

    it('should handle file read error', async () => {
      mockDependencies.file.read.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await bookmarkManager['importBookmarksFromFile']('/test/restricted.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.errors?.[0]).toContain('Permission denied');
    });
  });

  describe('UI Integration', () => {
    it('should handle REQUEST_IMPORT_FILE message and send response', async () => {
      const testBookmarks = [
        {
          id: 'test-1',
          title: 'Test Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4'
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);
      mockDependencies.utils.chooseFile.mockReturnValue('/test/bookmarks.json');

      await bookmarkManager['handleImportFromFile']('sidebar');

      expect(mockDependencies.sidebar.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('"type":"IMPORT_RESULT"')
      );
    });

    it('should handle user cancellation gracefully', async () => {
      mockDependencies.utils.chooseFile.mockReturnValue('');

      await bookmarkManager['handleImportFromFile']('sidebar');

      expect(mockDependencies.sidebar.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('"success":false')
      );
      expect(mockDependencies.sidebar.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('Import cancelled by user')
      );
    });

    it('should refresh UIs after successful import', async () => {
      const testBookmarks = [
        {
          id: 'test-1',
          title: 'Test Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4'
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);
      mockDependencies.utils.chooseFile.mockReturnValue('/test/bookmarks.json');

      const refreshSpy = vi.spyOn(bookmarkManager as any, 'refreshUIs');

      await bookmarkManager['handleImportFromFile']('sidebar');

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('Menu Integration', () => {
    it('should add import menu item during initialization', () => {
      expect(mockDependencies.menu.addItem).toHaveBeenCalledWith(
        expect.objectContaining({})
      );
      expect(mockDependencies.menu.item).toHaveBeenCalledWith(
        'Import Bookmarks',
        expect.any(Function)
      );
    });

    it('should handle import from menu', async () => {
      const testBookmarks = [
        {
          id: 'test-1',
          title: 'Test Bookmark',
          timestamp: 120.5,
          filepath: '/test/video.mp4'
        }
      ];

      mockFileContent = JSON.stringify(testBookmarks);
      mockDependencies.utils.chooseFile.mockReturnValue('/test/bookmarks.json');

      await bookmarkManager['handleImportFromMenu']();

      expect(mockDependencies.console.log).toHaveBeenCalledWith(
        expect.stringContaining('Import successful')
      );
    });
  });

  describe('CSV Line Parsing', () => {
    it('should parse simple CSV line correctly', () => {
      const result = bookmarkManager['parseCSVLine']('a,b,c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted fields with commas', () => {
      const result = bookmarkManager['parseCSVLine']('a,"b,c",d');
      expect(result).toEqual(['a', 'b,c', 'd']);
    });

    it('should handle escaped quotes', () => {
      const result = bookmarkManager['parseCSVLine']('a,"b""c",d');
      expect(result).toEqual(['a', 'b"c', 'd']);
    });

    it('should handle empty fields', () => {
      const result = bookmarkManager['parseCSVLine']('a,,c');
      expect(result).toEqual(['a', '', 'c']);
    });

    it('should handle fields with spaces', () => {
      const result = bookmarkManager['parseCSVLine'](' a , b , c ');
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of bookmarks efficiently', async () => {
      const largeBookmarkSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `test-${i}`,
        title: `Test Bookmark ${i}`,
        timestamp: i * 10,
        filepath: `/test/video${i}.mp4`,
        description: `Description ${i}`,
        createdAt: new Date().toISOString(),
        tags: [`tag${i}`]
      }));

      mockFileContent = JSON.stringify(largeBookmarkSet);

      const startTime = Date.now();
      const result = await bookmarkManager['importBookmarksFromFile']('/test/large.json', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle special characters in CSV fields', async () => {
      mockFileContent = `id,title,timestamp,filepath,description
test-1,"Title with 特殊字符",120.5,"/test/video.mp4","Description with émojis 🎬"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/special.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('should handle very long field values', async () => {
      const longTitle = 'A'.repeat(1000);
      const longDescription = 'B'.repeat(2000);

      mockFileContent = `id,title,timestamp,filepath,description
test-1,"${longTitle}",120.5,"/test/video.mp4","${longDescription}"`;

      const result = await bookmarkManager['importBookmarksFromFile']('/test/long.csv', {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: true
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });
  });
}); 