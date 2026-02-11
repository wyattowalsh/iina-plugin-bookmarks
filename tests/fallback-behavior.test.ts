/**
 * Tests for Issue #59: Define fallback behavior (e.g. use filename if no title)
 * Validates that the fallback hierarchy works correctly when metadata is unavailable
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MetadataDetector, IINACore } from '../src/metadata-detector';

describe('Issue #59: Fallback Behavior', () => {
  let mockCore: IINACore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLogger: any;
  let detector: MetadataDetector;

  beforeEach(() => {
    mockCore = {
      status: {
        path: '/test/video.mp4',
        title: undefined, // No metadata title available
        position: 120,
        duration: 7200,
      },
    };

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    detector = new MetadataDetector(mockCore, mockLogger, {
      retryAttempts: 1,
      retryDelay: 10,
      cacheTimeout: 1000,
      enableLogging: false, // Reduce noise in tests
    });
  });

  describe('Fallback Hierarchy', () => {
    it('should use metadata title when available (highest priority)', async () => {
      mockCore.status.title = 'Actual Movie Title';
      mockCore.status.path = '/test/some_filename.mp4';

      const title = await detector.getCurrentTitle();
      expect(title).toBe('Actual Movie Title');
    });

    it('should fall back to cleaned filename when no metadata title', async () => {
      mockCore.status.title = undefined;
      mockCore.status.path = '/movies/The.Great.Movie.2023.1080p.BluRay.x264.mp4';

      const title = await detector.getCurrentTitle();
      expect(title).toBe('The Great Movie');
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
  });

  describe('Filename Cleaning', () => {
    it('should clean various filename patterns correctly', async () => {
      const testCases = [
        { path: '/test/simple_movie.mp4', expected: 'Simple Movie' },
        { path: '/test/Movie.With.Dots.mp4', expected: 'Movie With Dots' },
        { path: '/test/movie-with-dashes.mkv', expected: 'Movie With Dashes' },
        {
          path: '/test/TV.Show.S01E01.Episode.Name.720p.mp4',
          expected: 'TV Show S01E01 Episode Name',
        },
        {
          path: '/test/Documentary.About.Nature.2020.4K.mp4',
          expected: 'Documentary About Nature',
        },
        {
          path: '/test/Concert.Live.Performance.BluRay.x264.mp4',
          expected: 'Concert Live Performance',
        },
      ];

      for (const testCase of testCases) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;

        const title = await detector.getCurrentTitle();
        expect(title).toBe(testCase.expected);
      }
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        { path: '/test/.hidden_file.mp4', expected: 'Hidden File' },
        { path: '/test/file_without_extension', expected: 'File Without Extension' },
        { path: '/test/file.with.multiple.dots.mp4', expected: 'File With Multiple Dots' },
        { path: '/test/UPPERCASE_FILE.MP4', expected: 'UPPERCASE FILE' },
        { path: '/test/', expected: 'Unknown' }, // Empty filename
        { path: '/test/just_extension.', expected: 'Just Extension' },
      ];

      for (const testCase of edgeCases) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;

        const title = await detector.getCurrentTitle();
        expect(title).toBe(testCase.expected);
      }
    });
  });

  describe('Quality and Format Removal', () => {
    it('should remove quality indicators from filenames', async () => {
      const qualityTests = [
        { path: '/test/Movie.2023.1080p.mp4', expected: 'Movie' },
        { path: '/test/Show.720p.HDTV.mp4', expected: 'Show HDTV' },
        { path: '/test/Film.4K.UHD.mp4', expected: 'Film UHD' },
        { path: '/test/Video.2160p.HDR.mp4', expected: 'Video HDR' },
      ];

      for (const testCase of qualityTests) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;

        const title = await detector.getCurrentTitle();
        expect(title).toBe(testCase.expected);
      }
    });

    it('should remove codec and source information', async () => {
      const codecTests = [
        { path: '/test/Movie.BluRay.x264.mp4', expected: 'Movie' },
        { path: '/test/Show.WEB-DL.H265.mp4', expected: 'Show WEB DL H265' },
        { path: '/test/Film.DVDRip.XviD.mp4', expected: 'Film DVDRip XviD' },
      ];

      for (const testCase of codecTests) {
        mockCore.status.path = testCase.path;
        mockCore.status.title = undefined;

        const title = await detector.getCurrentTitle();
        expect(title).toBe(testCase.expected);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return null when no file path is available', async () => {
      mockCore.status.path = undefined;

      const title = await detector.getCurrentTitle();
      expect(title).toBeNull();
    });

    it('should handle empty file paths gracefully', async () => {
      mockCore.status.path = '';

      const title = await detector.getCurrentTitle();
      expect(title).toBeNull();
    });
  });
});
