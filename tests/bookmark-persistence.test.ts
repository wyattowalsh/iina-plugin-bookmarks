import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookmarkPersistence } from '../src/bookmark-persistence';
import type { BookmarkData, IINAConsole, IINAFile, IINAPreferences } from '../src/types';

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
    preferences = { get: vi.fn().mockReturnValue(null), set: vi.fn() };
    console = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
    file = {
      read: vi.fn().mockReturnValue('[]'),
      write: vi.fn(),
      exists: vi.fn().mockReturnValue(true),
    };
  });

  describe('saveAutoBackup', () => {
    it('writes pretty-printed JSON to @data/bookmarks-backup.json', () => {
      const persistence = new BookmarkPersistence(preferences, console, file);
      persistence.saveAutoBackup(sampleBookmarks);

      expect(file.write).toHaveBeenCalledWith(
        '@data/bookmarks-backup.json',
        JSON.stringify(sampleBookmarks, null, 2),
      );
    });

    it('is a no-op when file dependency is not provided', () => {
      const persistence = new BookmarkPersistence(preferences, console);
      persistence.saveAutoBackup(sampleBookmarks);

      expect(file.write).not.toHaveBeenCalled();
    });

    it('catches write failures and logs a warning with error details', () => {
      const err = new Error('disk full');
      (file.write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw err;
      });

      const persistence = new BookmarkPersistence(preferences, console, file);
      persistence.saveAutoBackup(sampleBookmarks);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Auto-backup write failed'),
      );
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    });
  });
});
