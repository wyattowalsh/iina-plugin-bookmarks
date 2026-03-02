import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookmarkPersistence } from '../src/bookmark-persistence';
import {
  MAX_TIMESTAMP,
  type BookmarkData,
  type IINAConsole,
  type IINAFile,
  type IINAPreferences,
} from '../src/types';

describe('BookmarkPersistence', () => {
  let preferences: IINAPreferences;
  let console: IINAConsole;
  let file: IINAFile;

  const sampleBookmarks: BookmarkData[] = [
    {
      id: '1',
      title: 'Test',
      timestamp: 60,
      filepath: '/video.mp4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    preferences = { get: vi.fn().mockReturnValue(null), set: vi.fn(), sync: vi.fn() };
    console = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
    file = {
      read: vi.fn().mockReturnValue('[]'),
      write: vi.fn(),
      exists: vi.fn().mockReturnValue(true),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('saveAutoBackup', () => {
    it('writes compact JSON to @data/bookmarks-backup.json after debounce', () => {
      const persistence = new BookmarkPersistence(preferences, console, file);
      persistence.saveAutoBackup(sampleBookmarks);

      expect(file.write).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3000);

      expect(file.write).toHaveBeenCalledWith(
        '@data/bookmarks-backup.json',
        JSON.stringify(sampleBookmarks),
      );
    });

    it('is a no-op when file dependency is not provided', () => {
      const persistence = new BookmarkPersistence(preferences, console);
      persistence.saveAutoBackup(sampleBookmarks);

      vi.advanceTimersByTime(3000);
      expect(file.write).not.toHaveBeenCalled();
    });

    it('catches write failures and logs a warning with error details', () => {
      const err = new Error('disk full');
      (file.write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw err;
      });

      const persistence = new BookmarkPersistence(preferences, console, file);
      persistence.saveAutoBackup(sampleBookmarks);

      vi.advanceTimersByTime(3000);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Auto-backup write failed'),
      );
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    });
  });

  describe('load', () => {
    it('should drop bookmarks with timestamps beyond MAX_TIMESTAMP', () => {
      const stored = JSON.stringify([
        {
          id: 'ok',
          title: 'Valid',
          timestamp: 10,
          filepath: '/video.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
        {
          id: 'over',
          title: 'Over',
          timestamp: MAX_TIMESTAMP + 1,
          filepath: '/video.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ]);
      (preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'bookmarks' ? stored : null,
      );

      const persistence = new BookmarkPersistence(preferences, console, file);
      const loaded = persistence.load();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('ok');
    });

    it('should drop invalid endTimestamp values during load', () => {
      const stored = JSON.stringify([
        {
          id: 'range-valid',
          title: 'Range Valid',
          timestamp: 10,
          endTimestamp: 20,
          filepath: '/video.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
        {
          id: 'range-over',
          title: 'Range Over',
          timestamp: 10,
          endTimestamp: MAX_TIMESTAMP + 1,
          filepath: '/video.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
        {
          id: 'range-before',
          title: 'Range Before',
          timestamp: 30,
          endTimestamp: 20,
          filepath: '/video.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ]);
      (preferences.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'bookmarks' ? stored : null,
      );

      const persistence = new BookmarkPersistence(preferences, console, file);
      const loaded = persistence.load();

      expect(loaded.find((b) => b.id === 'range-valid')?.endTimestamp).toBe(20);
      expect(loaded.find((b) => b.id === 'range-over')?.endTimestamp).toBeUndefined();
      expect(loaded.find((b) => b.id === 'range-before')?.endTimestamp).toBeUndefined();
    });
  });
});
