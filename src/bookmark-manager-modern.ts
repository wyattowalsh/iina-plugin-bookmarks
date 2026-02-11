// IINA Plugin Bookmarks - Modern BookmarkManager Implementation
// ES6 Module implementation following IINA plugin guidelines (Sept 2025)

import type { BookmarkData, UIMessage, IINARuntimeDependencies } from './types';
import { getCloudStorageManager, CloudStorageManager } from './cloud-storage';

/** Max reasonable timestamp: 365 days in seconds */
const MAX_TIMESTAMP = 86400 * 365;

/** Strip HTML tags from a string to prevent XSS on import */
function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/** Prefix CSV-dangerous leading characters with a single quote to prevent formula injection */
function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

export class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private readonly STORAGE_KEY = 'bookmarks';
  private readonly SORT_PREFERENCES_KEY = 'sortPreferences';
  private deps: IINARuntimeDependencies;
  private cloudStorage: CloudStorageManager;

  constructor(dependencies: IINARuntimeDependencies) {
    this.deps = dependencies;
    this.cloudStorage = getCloudStorageManager(dependencies.http, dependencies.console);

    // Initialize the plugin
    this.loadBookmarks();
    this.loadSortPreferences();
    this.setupEventListeners();
    this.setupWebUI();
    this.setupUIMessageListeners();

    this.deps.console.log('BookmarkManager initialized successfully');
  }

  private loadBookmarks(): void {
    try {
      const stored = this.deps.preferences.get(this.STORAGE_KEY);
      if (stored) {
        this.bookmarks = JSON.parse(stored);
        this.deps.console.log(`Loaded ${this.bookmarks.length} bookmarks`);
      } else {
        this.deps.console.log('No existing bookmarks found');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error loading bookmarks: ${errorMessage}`);
      if (this.recoverFromBackup()) {
        this.deps.console.log('Recovered bookmarks from backup');
      } else {
        this.bookmarks = [];
      }
    }
  }

  recoverFromBackup(): boolean {
    try {
      const backup = this.deps.preferences.get(`${this.STORAGE_KEY}_backup`);
      if (backup) {
        this.bookmarks = JSON.parse(backup);
        this.deps.preferences.set(this.STORAGE_KEY, backup);
        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Backup recovery also failed: ${errorMessage}`);
    }
    return false;
  }

  private saveBookmarks(): void {
    try {
      const currentData = this.deps.preferences.get(this.STORAGE_KEY);
      if (currentData) {
        this.deps.preferences.set(`${this.STORAGE_KEY}_backup`, currentData);
      }

      this.deps.preferences.set(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
      this.deps.console.log('Bookmarks saved');
      this.refreshUI();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error saving bookmarks: ${errorMessage}`);
    }
  }

  /** Immediate (non-debounced) save for import operations */
  private saveBookmarksImmediate(): void {
    this.saveBookmarks();
  }

  private setupWebUI(): void {
    try {
      this.deps.sidebar.loadFile('ui/sidebar/index.html');
      this.deps.console.log('Sidebar UI loaded');

      this.deps.overlay.loadFile('ui/overlay/index.html');
      this.deps.overlay.setClickable(true);
      this.deps.overlay.hide();
      this.deps.console.log('Overlay UI loaded');

      this.deps.standaloneWindow.loadFile('ui/window/index.html');
      this.deps.console.log('Window UI loaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error loading UI: ${errorMessage}`);
    }
  }

  private setupUIMessageListeners(): void {
    const createHandler = (uiSource: string) => {
      return (messageContent: any) => {
        let message: UIMessage;

        if (typeof messageContent === 'string') {
          try {
            message = JSON.parse(messageContent);
          } catch (_e) {
            this.deps.console.error(`[${uiSource}] Error parsing JSON message: ${messageContent}`);
            return;
          }
        } else if (
          typeof messageContent === 'object' &&
          messageContent !== null &&
          'type' in messageContent
        ) {
          message = messageContent as UIMessage;
        } else {
          this.deps.console.warn(
            `[${uiSource}] Received non-standard message: ${JSON.stringify(messageContent)}`,
          );
          return;
        }

        this.deps.console.log(`[${uiSource}] Received message: ${message.type}`);
        this.handleUIMessage(message, uiSource);
      };
    };

    this.deps.sidebar.onMessage(createHandler('sidebar'));
    this.deps.overlay.onMessage(createHandler('overlay'));
    this.deps.standaloneWindow.onMessage(createHandler('window'));

    this.deps.console.log('UI Message Listeners set up');
  }

  private handleUIMessage(message: UIMessage, uiSource: string): void {
    switch (message.type) {
      case 'REQUEST_FILE_PATH':
        this.sendCurrentFilePath(uiSource);
        break;

      case 'JUMP_TO_BOOKMARK':
        if (message.payload?.id) {
          this.jumpToBookmark(message.payload.id);
        }
        break;

      case 'HIDE_OVERLAY':
        this.deps.overlay.hide();
        break;

      case 'ADD_BOOKMARK':
        this.addBookmark(
          message.payload?.title,
          message.payload?.timestamp,
          message.payload?.description,
          message.payload?.tags,
        ).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.deps.console.error(`Failed to add bookmark: ${errorMessage}`);
        });
        break;

      case 'DELETE_BOOKMARK':
        if (message.payload?.id) {
          this.removeBookmark(message.payload.id);
        }
        break;

      case 'UPDATE_BOOKMARK':
        if (message.payload?.id && message.payload?.data) {
          this.updateBookmark(message.payload.id, message.payload.data);
        }
        break;

      case 'IMPORT_BOOKMARKS':
        if (message.payload?.bookmarks && Array.isArray(message.payload.bookmarks)) {
          this.importBookmarks(message.payload.bookmarks, uiSource);
        }
        break;

      case 'EXPORT_BOOKMARKS':
        this.exportBookmarks(message.payload?.format || 'json', uiSource);
        break;

      case 'CLOUD_SYNC_REQUEST':
        if (message.payload) {
          this.handleCloudSync(message.payload, uiSource);
        }
        break;

      case 'FILE_RECONCILIATION_REQUEST':
        if (message.payload) {
          this.handleFileReconciliation(message.payload, uiSource);
        }
        break;

      case 'UI_READY':
        this.sendBookmarksToUI(uiSource);
        break;

      default:
        this.deps.console.warn(`[${uiSource}] Unknown message type: ${message.type}`);
    }
  }

  private getUITarget(uiSource: string) {
    switch (uiSource) {
      case 'overlay':
        return this.deps.overlay;
      case 'sidebar':
        return this.deps.sidebar;
      case 'window':
        return this.deps.standaloneWindow;
      default:
        return this.deps.sidebar;
    }
  }

  private sendCurrentFilePath(uiSource: string): void {
    const currentPath = this.deps.core.status.path;
    const target = this.getUITarget(uiSource);

    target.postMessage(
      JSON.stringify({
        type: 'CURRENT_FILE_PATH',
        data: currentPath,
      }),
    );
  }

  private sendBookmarksToUI(uiSource: string): void {
    const currentPath = this.deps.core.status.path;
    const currentBookmarks = this.getBookmarksForFile(currentPath);

    const target = this.getUITarget(uiSource);
    const message = JSON.stringify({
      type: 'BOOKMARKS_UPDATED',
      data: currentBookmarks,
    });

    target.postMessage(message);
    this.deps.console.log(`Sent ${currentBookmarks.length} bookmarks to ${uiSource}`);
  }

  private setupEventListeners(): void {
    this.deps.event.on('iina.file-loaded', () => {
      this.deps.console.log('File loaded event');
      this.refreshUI();
    });

    this.deps.menu.addItem(
      this.deps.menu.item('Add Bookmark at Current Time', () => {
        this.addBookmark().catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.deps.console.error(`Failed to add bookmark from menu: ${errorMessage}`);
        });
      }),
    );

    this.deps.menu.addItem(
      this.deps.menu.item('Manage Bookmarks', () => {
        this.deps.standaloneWindow.show();
      }),
    );

    this.deps.menu.addItem(
      this.deps.menu.item('Toggle Bookmarks Overlay', () => {
        if (this.deps.overlay.isVisible()) {
          this.deps.overlay.hide();
        } else {
          this.sendBookmarksToUI('overlay');
          this.deps.overlay.show();
        }
      }),
    );

    this.deps.console.log('Event listeners set up');
  }

  async addBookmark(
    title?: string,
    timestamp?: number,
    description?: string,
    tags?: string[],
  ): Promise<void> {
    try {
      const maxBookmarks =
        parseInt(this.deps.preferences.get('maxBookmarks') || '1000', 10) || 1000;
      if (this.bookmarks.length >= maxBookmarks) {
        this.deps.console.warn(`Maximum bookmark limit (${maxBookmarks}) reached`);
        if (this.deps.core.osd) {
          this.deps.core.osd(`Maximum bookmark limit (${maxBookmarks}) reached`);
        }
        return;
      }

      const currentPath = this.deps.core.status.path || '/unknown/file.mp4';
      const currentTime =
        timestamp !== undefined ? timestamp : this.deps.core.status.currentTime || 0;

      // Validate timestamp
      if (!Number.isFinite(currentTime) || currentTime < 0 || currentTime > MAX_TIMESTAMP) {
        this.deps.console.error(
          `Invalid timestamp: ${currentTime}. Must be finite, >= 0, and <= ${MAX_TIMESTAMP}`,
        );
        return;
      }

      const filename = currentPath.split('/').pop() || currentPath;
      const cleanFilename = filename.replace(/\.[^/.]+$/, '') || 'Unknown Media';

      // Sanitize title and description to strip HTML tags
      const safeTitle = title
        ? stripHtmlTags(title)
        : `${cleanFilename} - ${this.formatTime(currentTime)}`;
      const safeDescription = description
        ? stripHtmlTags(description)
        : `Bookmark at ${this.formatTime(currentTime)}`;

      const now = new Date().toISOString();
      const bookmark: BookmarkData = {
        id: this.generateId(),
        title: safeTitle,
        timestamp: currentTime,
        filepath: currentPath,
        description: safeDescription,
        createdAt: now,
        updatedAt: now,
        tags: tags || [],
      };

      this.bookmarks.push(bookmark);
      this.saveBookmarks();

      this.deps.console.log(`Bookmark added: ${bookmark.title}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error adding bookmark: ${errorMessage}`);
      throw error;
    }
  }

  removeBookmark(id: string): void {
    const initialLength = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);

    if (this.bookmarks.length < initialLength) {
      this.saveBookmarks();
      this.deps.console.log(`Bookmark removed: ${id}`);
    } else {
      this.deps.console.warn(`Bookmark not found: ${id}`);
    }
  }

  updateBookmark(id: string, data: Partial<BookmarkData>): void {
    const index = this.bookmarks.findIndex((b) => b.id === id);
    if (index !== -1) {
      // Sanitize incoming title/description
      const sanitized: Partial<BookmarkData> = { ...data };
      if (sanitized.title) sanitized.title = stripHtmlTags(sanitized.title);
      if (sanitized.description) sanitized.description = stripHtmlTags(sanitized.description);

      this.bookmarks[index] = {
        ...this.bookmarks[index],
        ...sanitized,
        updatedAt: new Date().toISOString(),
      };
      this.saveBookmarks();
      this.deps.console.log(`Bookmark updated: ${id}`);
    } else {
      this.deps.console.warn(`Bookmark not found for update: ${id}`);
    }
  }

  jumpToBookmark(id: string): void {
    const bookmark = this.bookmarks.find((b) => b.id === id);
    if (!bookmark) {
      this.deps.console.error(`Bookmark not found: ${id}`);
      return;
    }

    this.deps.console.log(
      `Jumping to: ${bookmark.title} at ${this.formatTime(bookmark.timestamp)}`,
    );

    // Use seekTo() for absolute seek to specific timestamp (not seek() which is relative)
    try {
      if (this.deps.core.seekTo) {
        this.deps.core.seekTo(bookmark.timestamp);
      } else if (this.deps.core.seek) {
        this.deps.console.warn('seekTo() not available, falling back to seek()');
        this.deps.core.seek(bookmark.timestamp);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.warn(`Could not seek: ${errorMessage}`);
    }
  }

  getBookmarksForFile(filepath?: string): BookmarkData[] {
    if (!filepath) {
      return this.bookmarks;
    }
    return this.bookmarks.filter((bookmark) => bookmark.filepath === filepath);
  }

  /** Import bookmarks from external data, using immediate save */
  private importBookmarks(rawBookmarks: any[], uiSource: string): void {
    const target = this.getUITarget(uiSource);
    let imported = 0;

    for (const raw of rawBookmarks) {
      if (!raw || typeof raw !== 'object') continue;

      const ts = typeof raw.timestamp === 'number' ? raw.timestamp : 0;
      if (!Number.isFinite(ts) || ts < 0 || ts > MAX_TIMESTAMP) continue;

      const now = new Date().toISOString();
      const bookmark: BookmarkData = {
        id: raw.id || this.generateId(),
        title: stripHtmlTags(String(raw.title || 'Imported Bookmark')),
        timestamp: ts,
        filepath: String(raw.filepath || ''),
        description: raw.description ? stripHtmlTags(String(raw.description)) : undefined,
        createdAt: raw.createdAt || now,
        updatedAt: now,
        tags: Array.isArray(raw.tags) ? raw.tags.map((t: any) => String(t)) : [],
      };

      this.bookmarks.push(bookmark);
      imported++;
    }

    // Use immediate save for imports (not debounced)
    this.saveBookmarksImmediate();

    target.postMessage(
      JSON.stringify({
        type: 'IMPORT_RESULT',
        data: { success: true, imported },
      }),
    );
  }

  /** Export bookmarks, sanitizing CSV cells against formula injection */
  private exportBookmarks(format: string, uiSource: string): void {
    const target = this.getUITarget(uiSource);

    if (format === 'csv') {
      const header = 'id,title,timestamp,filepath,description,createdAt,updatedAt,tags';
      const rows = this.bookmarks.map((b) => {
        return [
          sanitizeCsvCell(b.id),
          sanitizeCsvCell(b.title),
          String(b.timestamp),
          sanitizeCsvCell(b.filepath),
          sanitizeCsvCell(b.description || ''),
          sanitizeCsvCell(b.createdAt),
          sanitizeCsvCell(b.updatedAt),
          sanitizeCsvCell((b.tags || []).join(';')),
        ]
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(',');
      });

      target.postMessage(
        JSON.stringify({
          type: 'EXPORT_RESULT',
          data: { format: 'csv', content: [header, ...rows].join('\n') },
        }),
      );
    } else {
      target.postMessage(
        JSON.stringify({
          type: 'EXPORT_RESULT',
          data: { format: 'json', content: JSON.stringify(this.bookmarks, null, 2) },
        }),
      );
    }
  }

  private refreshUI(): void {
    setTimeout(() => {
      this.sendBookmarksToUI('sidebar');
      this.sendBookmarksToUI('overlay');
      this.sendBookmarksToUI('window');
    }, 100);
  }

  private loadSortPreferences(): void {
    try {
      const stored = this.deps.preferences.get(this.SORT_PREFERENCES_KEY);
      if (stored) {
        this.deps.console.log(`Sort preferences loaded: ${stored}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error loading sort preferences: ${errorMessage}`);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Handle cloud sync operations
  private async handleCloudSync(payload: any, uiSource: string): Promise<void> {
    try {
      this.deps.console.log(`Handling cloud sync: ${payload.action}`);

      const target = this.getUITarget(uiSource);

      switch (payload.action) {
        case 'upload':
          await this.uploadBookmarksToCloud(payload.provider, payload.credentials, target);
          break;
        case 'download':
          await this.downloadBookmarksFromCloud(payload.provider, payload.credentials, target);
          break;
        case 'sync':
          await this.syncBookmarksWithCloud(payload.provider, payload.credentials, target);
          break;
        default:
          this.deps.console.warn(`Unknown cloud sync action: ${payload.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error handling cloud sync: ${errorMessage}`);

      const target = this.getUITarget(uiSource);
      target.postMessage(
        JSON.stringify({
          type: 'CLOUD_SYNC_RESULT',
          data: {
            success: false,
            action: payload.action,
            error: errorMessage,
          },
        }),
      );
    }
  }

  // Handle file reconciliation operations
  private async handleFileReconciliation(payload: any, uiSource: string): Promise<void> {
    try {
      this.deps.console.log(`Handling file reconciliation: ${payload.action}`);

      const target = this.getUITarget(uiSource);

      switch (payload.action) {
        case 'update_path':
          this.updateBookmarkPath(payload.bookmarkId, payload.newPath, target);
          break;
        case 'remove_bookmark':
          this.removeBookmark(payload.bookmarkId);
          target.postMessage(
            JSON.stringify({
              type: 'FILE_RECONCILIATION_RESULT',
              data: {
                success: true,
                action: 'remove_bookmark',
                bookmarkId: payload.bookmarkId,
              },
            }),
          );
          break;
        case 'search_similar':
          this.searchForSimilarFiles(payload.bookmarkId, payload.originalPath, target);
          break;
        default:
          this.deps.console.warn(`Unknown reconciliation action: ${payload.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error handling file reconciliation: ${errorMessage}`);
    }
  }

  // Upload bookmarks to cloud storage
  private async uploadBookmarksToCloud(
    provider: string,
    credentials: any,
    target: any,
  ): Promise<void> {
    try {
      this.deps.console.log(`Uploading bookmarks to ${provider}...`);

      const success = await this.cloudStorage.setProvider(provider, credentials);
      if (!success) {
        throw new Error('Failed to authenticate with cloud provider');
      }

      const backupId = await this.cloudStorage.uploadBookmarks(this.bookmarks);

      target.postMessage(
        JSON.stringify({
          type: 'CLOUD_SYNC_RESULT',
          data: {
            success: true,
            action: 'upload',
            message: `Successfully uploaded ${this.bookmarks.length} bookmarks to ${provider}`,
            backupId: backupId,
          },
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error uploading to cloud: ${errorMessage}`);
      throw error;
    }
  }

  // Download bookmarks from cloud storage
  private async downloadBookmarksFromCloud(
    provider: string,
    credentials: any,
    target: any,
  ): Promise<void> {
    try {
      this.deps.console.log(`Downloading bookmarks from ${provider}...`);

      const success = await this.cloudStorage.setProvider(provider, credentials);
      if (!success) {
        throw new Error('Failed to authenticate with cloud provider');
      }

      const backups = await this.cloudStorage.listBackups();
      if (backups.length === 0) {
        throw new Error('No backups found in cloud storage');
      }

      const latestBackup = backups.sort().reverse()[0];
      const backup = await this.cloudStorage.downloadBookmarks(latestBackup);

      target.postMessage(
        JSON.stringify({
          type: 'CLOUD_SYNC_RESULT',
          data: {
            success: true,
            action: 'download',
            bookmarks: backup.bookmarks,
            message: `Downloaded ${backup.bookmarks.length} bookmarks from ${provider}`,
            metadata: backup.metadata,
          },
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error downloading from cloud: ${errorMessage}`);
      throw error;
    }
  }

  // Sync bookmarks with cloud storage (merge)
  private async syncBookmarksWithCloud(
    provider: string,
    credentials: any,
    target: any,
  ): Promise<void> {
    try {
      this.deps.console.log(`Syncing bookmarks with ${provider}...`);

      const success = await this.cloudStorage.setProvider(provider, credentials);
      if (!success) {
        throw new Error('Failed to authenticate with cloud provider');
      }

      const result = await this.cloudStorage.syncBookmarks(this.bookmarks);

      this.bookmarks = result.merged;
      this.saveBookmarks();

      target.postMessage(
        JSON.stringify({
          type: 'CLOUD_SYNC_RESULT',
          data: {
            success: true,
            action: 'sync',
            message: `Sync complete: ${result.added} added, ${result.updated} updated`,
            syncStats: {
              added: result.added,
              updated: result.updated,
              conflicts: result.conflicts.length,
              total: result.merged.length,
            },
          },
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error syncing with cloud: ${errorMessage}`);
      throw error;
    }
  }

  // Update bookmark file path
  private updateBookmarkPath(bookmarkId: string, newPath: string, target: any): void {
    try {
      const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
      if (bookmark) {
        const oldPath = bookmark.filepath;
        bookmark.filepath = newPath;
        bookmark.updatedAt = new Date().toISOString();
        this.saveBookmarks();
        this.deps.console.log(`Updated bookmark path: ${oldPath} -> ${newPath}`);

        target.postMessage(
          JSON.stringify({
            type: 'FILE_RECONCILIATION_RESULT',
            data: {
              success: true,
              action: 'update_path',
              bookmarkId: bookmarkId,
              oldPath: oldPath,
              newPath: newPath,
            },
          }),
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`Error updating bookmark path: ${errorMessage}`);
    }
  }

  // Search for similar files -- not implemented, returns empty result
  private searchForSimilarFiles(bookmarkId: string, originalPath: string, target: any): void {
    this.deps.console.log(`Similar file search not implemented for: ${originalPath}`);

    target.postMessage(
      JSON.stringify({
        type: 'FILE_RECONCILIATION_RESULT',
        data: {
          success: true,
          action: 'search_similar',
          bookmarkId: bookmarkId,
          originalPath: originalPath,
          similarFiles: [],
          message: 'Similar file search is not yet implemented',
        },
      }),
    );
  }

  // Public API methods for debugging
  getAllBookmarks(): BookmarkData[] {
    return [...this.bookmarks];
  }

  getBookmarkCount(): number {
    return this.bookmarks.length;
  }
}
