/**
 * Unit tests for MetadataDetector
 * Tests all requirements from Issue #58: Enhanced Media Title Detection
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetadataDetector, IINACore, MediaMetadata } from '../src/metadata-detector';

describe('MetadataDetector', () => {
  let mockCore: IINACore;
  let mockLogger: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let detector: MetadataDetector;

  beforeEach(() => {
    mockCore = {
      status: {
        path: '/test/video.mp4',
        title: 'Test Movie',
        position: 120,
        duration: 7200
      }
    };

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    };

    detector = new MetadataDetector(mockCore, mockLogger, {
      retryAttempts: 2,
      retryDelay: 50,
      cacheTimeout: 1000,
      enableLogging: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentTitle', () => {
    it('should return title from IINA metadata when available', async () => {
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Test Movie');
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Title detection completed'));
    });

    it('should fall back to filename when no metadata title', async () => {
      mockCore.status.title = undefined;
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Video'); // cleaned filename
    });

    it('should fall back to filename when title is just filename', async () => {
      mockCore.status.title = 'video.mp4';
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Video'); // cleaned filename
    });

    it('should handle "Unknown Media" title', async () => {
      mockCore.status.title = 'Unknown Media';
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Video'); // cleaned filename
    });

    it('should complete within 100ms performance requirement', async () => {
      const start = Date.now();
      await detector.getCurrentTitle();
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should handle errors gracefully', async () => {
      mockCore.status.path = undefined;
      const title = await detector.getCurrentTitle();
      expect(title).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getCurrentFilePath', () => {
    it('should return current file path', async () => {
      const path = await detector.getCurrentFilePath();
      expect(path).toBe('/test/video.mp4');
    });

    it('should return empty string when no path', async () => {
      mockCore.status.path = undefined;
      const path = await detector.getCurrentFilePath();
      expect(path).toBe('');
    });
  });

  describe('getCurrentMetadata', () => {
    it('should return comprehensive metadata', async () => {
      const metadata = await detector.getCurrentMetadata();
      
      expect(metadata).toEqual({
        title: 'Test Movie',
        filename: 'video.mp4',
        filepath: '/test/video.mp4',
        duration: 7200,
        format: 'mp4'
      });
    });

    it('should throw error when no file loaded', async () => {
      mockCore.status.path = undefined;
      await expect(detector.getCurrentMetadata()).rejects.toThrow('No media file currently loaded');
    });

    it('should normalize title properly', async () => {
      mockCore.status.title = '  "Test Movie"  ';
      const metadata = await detector.getCurrentMetadata();
      expect(metadata.title).toBe('Test Movie');
    });

    it('should handle international characters', async () => {
      mockCore.status.title = 'Amélie Poulain';
      const metadata = await detector.getCurrentMetadata();
      expect(metadata.title).toBe('Amélie Poulain');
    });

    it('should limit title length', async () => {
      mockCore.status.title = 'A'.repeat(300);
      const metadata = await detector.getCurrentMetadata();
      expect(metadata.title!.length).toBeLessThanOrEqual(200);
    });
  });

  describe('caching mechanism', () => {
    it('should cache metadata results', async () => {
             // First call
       const metadata1 = await detector.getCurrentMetadata();
       expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Fetched metadata'));
 
       vi.clearAllMocks();

      // Second call should use cache
      const metadata2 = await detector.getCurrentMetadata();
      expect(metadata1).toEqual(metadata2);
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Using cached metadata'));
    });

    it('should expire cache after timeout', async () => {
      detector = new MetadataDetector(mockCore, mockLogger, {
        cacheTimeout: 50 // 50ms
      });

      await detector.getCurrentMetadata();
             await new Promise(resolve => setTimeout(resolve, 60)); // Wait for cache to expire
       
       vi.clearAllMocks();
       await detector.getCurrentMetadata();
      
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Fetched metadata'));
    });

    it('should clear expired cache entries', () => {
      detector.clearExpiredCache();
      expect(mockLogger.log).not.toHaveBeenCalledWith(expect.stringContaining('cache'));
    });
  });

  describe('media change detection', () => {
         it('should notify listeners when media changes', async () => {
       const listener = vi.fn();
       detector.onMediaChange(listener);

      await detector.getCurrentMetadata();
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        filepath: '/test/video.mp4',
        title: 'Test Movie'
      }));
    });

         it('should not notify for same media', async () => {
       const listener = vi.fn();
       detector.onMediaChange(listener);
 
       await detector.getCurrentMetadata();
       vi.clearAllMocks();
      
      await detector.getCurrentMetadata(); // Same file
      expect(listener).not.toHaveBeenCalled();
    });

         it('should remove listeners correctly', async () => {
       const listener = vi.fn();
       detector.onMediaChange(listener);
       detector.removeMediaChangeListener(listener);

      await detector.getCurrentMetadata();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('retry mechanism', () => {
    it('should retry on failure', async () => {
      let callCount = 0;
      const originalMethod = detector['fetchMetadata'];
             detector['fetchMetadata'] = vi.fn().mockImplementation(() => {
         callCount++;
         if (callCount < 2) {
           throw new Error('Temporary failure');
         }
         return originalMethod.call(detector, '/test/video.mp4');
       });

      const metadata = await detector.getCurrentMetadata();
      expect(detector['fetchMetadata']).toHaveBeenCalledTimes(2);
      expect(metadata.title).toBe('Test Movie');
    });

         it('should fail after max retries', async () => {
       detector['fetchMetadata'] = vi.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(detector.getCurrentMetadata()).rejects.toThrow('Permanent failure');
      expect(detector['fetchMetadata']).toHaveBeenCalledTimes(2); // retryAttempts = 2
    });
  });

  describe('refreshMetadata', () => {
         it('should force refresh by clearing cache', async () => {
       await detector.getCurrentMetadata(); // Fill cache
       vi.clearAllMocks();

      const refreshed = await detector.refreshMetadata();
      expect(refreshed).toBeDefined();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Fetched metadata'));
    });

    it('should handle refresh errors', async () => {
      mockCore.status.path = undefined;
      const result = await detector.refreshMetadata();
      expect(result).toBeNull();
      // The error is logged inside getCurrentMetadata which refreshMetadata calls
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Metadata refresh failed'));
    });
  });

  describe('filename title extraction', () => {
    it('should clean up filename properly', async () => {
      mockCore.status.path = '/test/My.Movie.2023.1080p.BluRay.x264.mp4';
      mockCore.status.title = undefined;
      
      const metadata = await detector.getCurrentMetadata();
      expect(metadata.title).toBe('My Movie');
    });

    it('should handle various naming patterns', async () => {
      const testCases = [
        { path: '/test/movie_name_here.mp4', expected: 'Movie Name Here' },
        { path: '/test/TV.Show.S01E01.720p.mp4', expected: 'TV Show S01E01' },
        { path: '/test/Documentary.2020.mp4', expected: 'Documentary' },
        { path: '/test/Concert.Live.Performance.mp4', expected: 'Concert Live Performance' }
      ];

      for (const testCase of testCases) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;
        
        const metadata = await detector.getCurrentMetadata();
        expect(metadata.title).toBe(testCase.expected);
      }
    });

    it('should capitalize words correctly', async () => {
      mockCore.status.path = '/test/the-great-movie.mp4';
      mockCore.status.title = undefined;
      
      const metadata = await detector.getCurrentMetadata();
      expect(metadata.title).toBe('The Great Movie');
    });
  });

  describe('format detection', () => {
    it('should detect file format correctly', async () => {
      const testCases = [
        { path: '/test/video.mp4', format: 'mp4' },
        { path: '/test/video.mkv', format: 'mkv' },
        { path: '/test/audio.mp3', format: 'mp3' },
        { path: '/test/unknown', format: 'unknown' }
      ];

      for (const testCase of testCases) {
        mockCore.status.path = testCase.path;
        const metadata = await detector.getCurrentMetadata();
        expect(metadata.format).toBe(testCase.format);
      }
    });
  });

  describe('error handling', () => {
         it('should handle listener errors gracefully', async () => {
       const badListener = vi.fn().mockImplementation(() => {
         throw new Error('Listener error');
       });
      
      detector.onMediaChange(badListener);
      await detector.getCurrentMetadata();
      
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error in metadata change listener'));
    });

    it('should handle missing core status gracefully', async () => {
      mockCore.status = {} as any;
      // This should throw an error since no path is available
      await expect(detector.getCurrentMetadata()).rejects.toThrow('No media file currently loaded');
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultDetector = new MetadataDetector(mockCore, mockLogger);
      expect(defaultDetector['config'].retryAttempts).toBe(3);
      expect(defaultDetector['config'].retryDelay).toBe(100);
      expect(defaultDetector['config'].cacheTimeout).toBe(30000);
      expect(defaultDetector['config'].enableLogging).toBe(true);
    });

    it('should disable logging when configured', async () => {
      const quietDetector = new MetadataDetector(mockCore, mockLogger, {
        enableLogging: false
      });
      
      await quietDetector.getCurrentTitle();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('fallback behavior', () => {
    it('should use filename when no metadata title available', async () => {
      mockCore.status.title = undefined;
      mockCore.status.path = '/movies/The.Great.Movie.2023.1080p.mp4';
      
      const title = await detector.getCurrentTitle();
      expect(title).toBe('The Great Movie');
    });

    it('should handle various filename patterns correctly', async () => {
      const testCases = [
        { path: '/test/simple_movie.mp4', expected: 'Simple Movie' },
        { path: '/test/TV.Show.S01E01.Episode.Name.720p.mp4', expected: 'TV Show S01E01 Episode Name' },
        { path: '/test/Documentary.About.Nature.2020.4K.mp4', expected: 'Documentary About Nature' },
        { path: '/test/Concert.Live.Performance.BluRay.mp4', expected: 'Concert Live Performance' },
        { path: '/test/movie-with-dashes.mkv', expected: 'Movie With Dashes' },
        { path: '/test/file_with_underscores.avi', expected: 'File With Underscores' }
      ];

      for (const testCase of testCases) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;
        
        const title = await detector.getCurrentTitle();
        expect(title).toBe(testCase.expected);
      }
    });

    it('should prefer metadata title over filename when available', async () => {
      mockCore.status.title = 'Actual Movie Title';
      mockCore.status.path = '/test/some_filename.mp4';
      
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Actual Movie Title');
    });

    it('should fall back to filename when metadata title is just the filename', async () => {
      mockCore.status.title = 'some_filename.mp4';
      mockCore.status.path = '/test/some_filename.mp4';
      
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Some Filename');
    });

    it('should fall back to filename when metadata title is "Unknown Media"', async () => {
      mockCore.status.title = 'Unknown Media';
      mockCore.status.path = '/test/actual_movie_name.mp4';
      
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Actual Movie Name');
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        { path: '/test/.hidden_file.mp4', expected: 'Hidden File' },
        { path: '/test/file_without_extension', expected: 'File Without Extension' },
        { path: '/test/file.with.multiple.dots.mp4', expected: 'File With Multiple Dots' },
        { path: '/test/UPPERCASE_FILE.MP4', expected: 'UPPERCASE FILE' }
      ];

      for (const testCase of edgeCases) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;
        
        const title = await detector.getCurrentTitle();
        expect(title).toBe(testCase.expected);
      }
    });

    it('should return "Unknown Media" as final fallback', async () => {
      mockCore.status.path = '/test/';
      mockCore.status.title = undefined;
      
      const title = await detector.getCurrentTitle();
      expect(title).toBe('Unknown');
    });
  });
}); 