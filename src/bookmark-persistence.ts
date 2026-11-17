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
  private readonly SAVE_DELAY_MS = 250;
  private readonly BACKUP_DELAY_MS = 3000;
  private backupTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBookmarks: BookmarkData[] | null = null;
  private pendingBackup: string | null = null;

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

  save(bookmarks: BookmarkData[], options?: { immediate?: boolean }): void {
    this.pendingBookmarks = bookmarks;
    if (options?.immediate) {
      this.clearSaveTimer();
      this.writePendingBookmarks();
      return;
    }
    this.clearSaveTimer();
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.writePendingBookmarks();
    }, this.SAVE_DELAY_MS);
  }

  flush(): void {
    this.clearSaveTimer();
    this.writePendingBookmarks();
    this.writePendingBackup();
  }

  private clearSaveTimer(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private writePendingBookmarks(): void {
    if (!this.pendingBookmarks) return;
    const pending = this.pendingBookmarks;
    this.pendingBookmarks = null;
    this.writeBookmarks(pending);
  }

  private writePendingBackup(): void {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
    }
    if (this.pendingBackup === null || !this.file) return;
    const data = this.pendingBackup;
    this.pendingBackup = null;
    try {
      this.file.write('@data/bookmarks-backup.json', data);
    } catch (error) {
      this.console.warn(`[BookmarkPersistence] Auto-backup write failed: ${errorMessage(error)}`);
    }
  }

  private writeBookmarks(bookmarks: BookmarkData[]): void {
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
    this.pendingBackup = JSON.stringify(bookmarks);
    this.backupTimer = setTimeout(() => {
      this.backupTimer = null;
      this.writePendingBackup();
    }, this.BACKUP_DELAY_MS);
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
