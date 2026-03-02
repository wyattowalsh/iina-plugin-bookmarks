// Bookmark Persistence Layer
// Handles loading, saving, and recovering bookmarks from IINA preferences

import {
  errorMessage,
  type BookmarkData,
  type IINAConsole,
  type IINAFile,
  type IINAPreferences,
} from './types';
import { validateBookmarkArray } from './utils/validation';

export class BookmarkPersistence {
  private readonly STORAGE_KEY = 'bookmarks';
  private backupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private preferences: IINAPreferences,
    private console: IINAConsole,
    private file?: IINAFile,
  ) {}

  load(): BookmarkData[] {
    try {
      const stored = this.preferences.get(this.STORAGE_KEY);
      if (stored) {
        const bookmarks = validateBookmarkArray(JSON.parse(stored), this.console);
        this.console.log(`Loaded ${bookmarks.length} bookmarks`);
        return bookmarks;
      } else {
        this.console.log('No existing bookmarks found');
        return [];
      }
    } catch (error) {
      this.console.error(`Error loading bookmarks: ${errorMessage(error)}`);
      const recovered = this.recover();
      if (recovered) {
        this.console.log('Recovered bookmarks from backup');
        return recovered;
      }
      return [];
    }
  }

  save(bookmarks: BookmarkData[]): void {
    try {
      const currentData = this.preferences.get(this.STORAGE_KEY);
      if (currentData) {
        this.preferences.set(`${this.STORAGE_KEY}_backup`, currentData);
      }
      this.preferences.set(this.STORAGE_KEY, JSON.stringify(bookmarks));
      this.preferences.sync?.();
      this.console.log('Bookmarks saved');
    } catch (error) {
      this.console.error(`Error saving bookmarks: ${errorMessage(error)}`);
    }
  }

  saveAutoBackup(bookmarks: BookmarkData[]): void {
    if (!this.file) return;
    if (this.backupTimer) clearTimeout(this.backupTimer);
    const data = JSON.stringify(bookmarks);
    this.backupTimer = setTimeout(() => {
      try {
        this.file!.write('@data/bookmarks-backup.json', data);
      } catch (error) {
        this.console.warn(`[BookmarkPersistence] Auto-backup write failed: ${errorMessage(error)}`);
      }
      this.backupTimer = null;
    }, 3000);
  }

  recover(): BookmarkData[] | null {
    try {
      const backup = this.preferences.get(`${this.STORAGE_KEY}_backup`);
      if (backup) {
        const bookmarks = validateBookmarkArray(JSON.parse(backup), this.console);
        this.preferences.set(this.STORAGE_KEY, backup);
        return bookmarks;
      }
    } catch (error) {
      this.console.error(`Backup recovery also failed: ${errorMessage(error)}`);
    }
    return null;
  }
}
