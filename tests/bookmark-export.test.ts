import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Bookmark Export Functionality', () => {
  let mockDeps: any;
  let BookmarkManager: any;

  beforeEach(async () => {
    // Reset modules to ensure clean state
    vi.resetModules();
    
    // Mock IINA dependencies
    mockDeps = {
      console: { 
        log: vi.fn(), 
        error: vi.fn(), 
        warn: vi.fn() 
      },
      preferences: { 
        get: vi.fn(() => null), 
        set: vi.fn() 
      },
      core: { 
        status: { 
          path: '/test/video/sample.mp4', 
          currentTime: 1800,
          title: 'Sample Video'
        } 
      },
      event: { on: vi.fn() },
      menu: { addItem: vi.fn(), item: vi.fn(() => ({})) },
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

    // Import BookmarkManager after mocking
    const module = await import('../src/bookmark-manager');
    BookmarkManager = module.BookmarkManager;
  });

  describe('JSON Export', () => {
    it('should export bookmarks to JSON with metadata', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      // Add test bookmarks
      await manager.addBookmark('Test Bookmark 1', 1200, 'First test bookmark', ['test', 'sample']);
      await manager.addBookmark('Test Bookmark 2', 2400, 'Second test bookmark', ['test', 'demo']);
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: true
      };
      
      const result = await manager.exportBookmarks(manager.getBookmarks(), exportOptions);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);
      expect(result.filePath).toMatch(/bookmarks-export-.*\.json/);
      
      // Parse the exported JSON data
      const exportData = JSON.parse((result as any).data);
      expect(exportData.metadata).toBeDefined();
      expect(exportData.metadata.totalRecords).toBe(2);
      expect(exportData.metadata.version).toBe('1.0.0');
      expect(exportData.bookmarks).toHaveLength(2);
      
      // Verify bookmark data integrity
      const bookmark1 = exportData.bookmarks.find((b: any) => b.title === 'Test Bookmark 1');
      expect(bookmark1).toBeDefined();
      expect(bookmark1.timestamp).toBe(1200);
      expect(bookmark1.description).toBe('First test bookmark');
      expect(bookmark1.tags).toEqual(['test', 'sample']);
    });

    it('should export bookmarks to JSON without metadata', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('Test Bookmark', 1500, 'Test description');
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: false
      };
      
      const result = await manager.exportBookmarks(manager.getBookmarks(), exportOptions);
      
      expect(result.success).toBe(true);
      const exportData = JSON.parse((result as any).data);
      expect(exportData.metadata).toBeUndefined();
      expect(exportData.bookmarks).toHaveLength(1);
    });
  });

  describe('CSV Export', () => {
    it('should export bookmarks to CSV with all fields and headers', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('CSV Test', 3600, 'CSV description', ['csv', 'test']);
      
      const csvOptions = {
        format: 'csv' as const,
        includeMetadata: true,
        selectedFields: ['id', 'title', 'timestamp', 'description', 'tags'],
        delimiter: ',' as const,
        includeHeaders: true
      };
      
      const result = await manager.exportBookmarksToCSV(manager.getBookmarks(), csvOptions);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(1);
      
      const csvData = (result as any).data;
      const lines = csvData.split('\n').filter((line: string) => line.trim());
      
      // Check headers
      expect(lines[0]).toContain('id,title,timestamp,description,tags');
      
      // Check data row
      const dataRow = lines[1];
      expect(dataRow).toContain('CSV Test');
      expect(dataRow).toContain('3600 (1:00:00)'); // timestamp with formatted time
      expect(dataRow).toContain('CSV description');
      expect(dataRow).toContain('csv;test'); // tags separated by semicolon
    });

    it('should export CSV with custom delimiter and selected fields', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('Delimiter Test', 7200, 'Test with semicolon');
      
      const csvOptions = {
        format: 'csv' as const,
        includeMetadata: false,
        selectedFields: ['title', 'timestamp'],
        delimiter: ';' as const,
        includeHeaders: false
      };
      
      const result = await manager.exportBookmarksToCSV(manager.getBookmarks(), csvOptions);
      
      expect(result.success).toBe(true);
      
      const csvData = (result as any).data;
      const lines = csvData.split('\n').filter((line: string) => line.trim());
      
      // Should only have data row (no headers)
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('Delimiter Test;7200 (2:00:00)');
    });

    it('should handle CSV special characters and escaping', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('Title with, comma', 1000, 'Description with "quotes" and, comma');
      
      const csvOptions = {
        format: 'csv' as const,
        includeMetadata: false,
        selectedFields: ['title', 'description'],
        delimiter: ',' as const,
        includeHeaders: true
      };
      
      const result = await manager.exportBookmarksToCSV(manager.getBookmarks(), csvOptions);
      
      expect(result.success).toBe(true);
      
      const csvData = (result as any).data;
      expect(csvData).toContain('"Title with, comma"');
      expect(csvData).toContain('"Description with ""quotes"" and, comma"');
    });
  });

  describe('Export Filtering', () => {
    it('should filter exports by tags', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('Tag Test 1', 1000, 'First', ['important', 'work']);
      await manager.addBookmark('Tag Test 2', 2000, 'Second', ['personal', 'fun']);
      await manager.addBookmark('Tag Test 3', 3000, 'Third', ['important', 'review']);
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: true,
        filter: {
          tags: ['important']
        }
      };
      
      const filteredBookmarks = manager.getFilteredBookmarksForExport(exportOptions);
      expect(filteredBookmarks).toHaveLength(2);
      expect(filteredBookmarks.every((b: any) => b.tags.includes('important'))).toBe(true);
    });

    it('should filter exports by date range', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      // Mock different creation dates
      const oldDate = '2023-01-01T00:00:00Z';
      const newDate = new Date().toISOString();
      
      await manager.addBookmark('Old Bookmark', 1000, 'Old');
      await manager.addBookmark('New Bookmark', 2000, 'New');
      
      // Manually set creation dates for testing
      const bookmarks = manager.getBookmarks();
      bookmarks[0].createdAt = oldDate;
      bookmarks[1].createdAt = newDate;
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: true,
        filter: {
          dateRange: {
            start: '2023-12-01T00:00:00Z',
            end: new Date().toISOString()
          }
        }
      };
      
      const filteredBookmarks = manager.getFilteredBookmarksForExport(exportOptions);
      expect(filteredBookmarks).toHaveLength(1);
      expect(filteredBookmarks[0].title).toBe('New Bookmark');
    });

    it('should filter exports by media type', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      // Create bookmarks with different file types
      mockDeps.core.status.path = '/test/video.mp4';
      await manager.addBookmark('Video Bookmark', 1000, 'Video content');
      
      mockDeps.core.status.path = '/test/audio.mp3';
      await manager.addBookmark('Audio Bookmark', 2000, 'Audio content');
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: true,
        filter: {
          mediaType: 'video'
        }
      };
      
      const filteredBookmarks = manager.getFilteredBookmarksForExport(exportOptions);
      expect(filteredBookmarks).toHaveLength(1);
      expect(filteredBookmarks[0].title).toBe('Video Bookmark');
    });
  });

  describe('Export Validation', () => {
    it('should validate export data and return no errors for valid bookmarks', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('Valid Bookmark', 1500, 'Valid description', ['valid']);
      
      const bookmarks = manager.getBookmarks();
      const validation = manager.validateExportData(bookmarks);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid bookmark data', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      const invalidBookmarks = [
        {
          id: '',
          title: 'Missing ID',
          timestamp: 1000,
          filepath: '/test/path.mp4',
          createdAt: new Date().toISOString()
        },
        {
          id: 'valid-id',
          title: '',
          timestamp: 'invalid' as any,
          filepath: '',
          createdAt: new Date().toISOString()
        }
      ];
      
      const validation = manager.validateExportData(invalidBookmarks);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some((error: string) => error.includes('missing required field: id'))).toBe(true);
      expect(validation.errors.some((error: string) => error.includes('missing required field: title'))).toBe(true);
      expect(validation.errors.some((error: string) => error.includes('invalid timestamp'))).toBe(true);
    });
  });

  describe('Export Error Handling', () => {
    it('should handle unsupported export format', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      const invalidOptions = {
        format: 'xml' as any,
        includeMetadata: true
      };
      
      await expect(manager.exportBookmarks([], invalidOptions)).rejects.toThrow('Unsupported export format: xml');
    });

    it('should handle empty bookmark list', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: true
      };
      
      const result = await manager.exportBookmarks([], exportOptions);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0);
      
      const exportData = JSON.parse((result as any).data);
      expect(exportData.bookmarks).toHaveLength(0);
      expect(exportData.metadata.totalRecords).toBe(0);
    });
  });

  describe('Message Handling', () => {
    it('should handle export message and send result back to UI', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      await manager.addBookmark('Message Test', 1000, 'Test for message handling');
      
      const exportOptions = {
        format: 'json' as const,
        includeMetadata: true
      };
      
      // Test the message handler
      await manager.handleExportBookmarks(exportOptions, 'window');
      
      // Verify that postMessage was called with export result
      expect(mockDeps.standaloneWindow.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('EXPORT_RESULT')
      );
      
      const messageCall = mockDeps.standaloneWindow.postMessage.mock.calls[0][0];
      const messageData = JSON.parse(messageCall);
      
      expect(messageData.type).toBe('EXPORT_RESULT');
      expect(messageData.data.success).toBe(true);
      expect(messageData.data.recordCount).toBe(1);
    });

    it('should handle export errors and send error message back to UI', async () => {
      const manager = new BookmarkManager(mockDeps);
      
      // Create a scenario that would cause an error (invalid format)
      const invalidOptions = {
        format: 'invalid' as any,
        includeMetadata: true
      };
      
      await manager.handleExportBookmarks(invalidOptions, 'sidebar');
      
      // Verify error was sent to UI
      expect(mockDeps.sidebar.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('EXPORT_RESULT')
      );
      
      const messageCall = mockDeps.sidebar.postMessage.mock.calls[0][0];
      const messageData = JSON.parse(messageCall);
      
      expect(messageData.type).toBe('EXPORT_RESULT');
      expect(messageData.data.success).toBe(false);
      expect(messageData.data.error).toBeDefined();
    });
  });
}); 