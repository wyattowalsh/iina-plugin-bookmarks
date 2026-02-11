// IINA Plugin Bookmarks - Modern BookmarkManager Implementation
// ES6 Module implementation following IINA plugin guidelines (Sept 2025)

import type { BookmarkData, UIMessage, IINARuntimeDependencies } from './types';
import { cloudStorageManager } from './cloud-storage';

export class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private readonly STORAGE_KEY = 'bookmarks';
  private readonly SORT_PREFERENCES_KEY = 'sortPreferences';
  private deps: IINARuntimeDependencies;

  constructor(dependencies: IINARuntimeDependencies) {
    this.deps = dependencies;

    // Initialize the plugin
    this.loadBookmarks();
    this.loadSortPreferences();
    this.setupEventListeners();
    this.setupWebUI();
    this.setupUIMessageListeners();

    this.deps.console.log('✅ BookmarkManager initialized successfully');
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
      // Try recovering from backup
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
        // Re-save as primary
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
      // Backup current data before overwriting
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

  private setupWebUI(): void {
    try {
      // Load UI components
      this.deps.sidebar.loadFile('ui/sidebar/index.html');
      this.deps.console.log('🎨 Sidebar UI loaded');

      this.deps.overlay.loadFile('ui/overlay/index.html');
      this.deps.overlay.setClickable(true);
      this.deps.overlay.hide();
      this.deps.console.log('🎭 Overlay UI loaded');

      this.deps.standaloneWindow.loadFile('ui/window/index.html');
      this.deps.console.log('🪟 Window UI loaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`❌ Error loading UI: ${errorMessage}`);
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

    // Set up message listeners
    this.deps.sidebar.onMessage(createHandler('sidebar'));
    this.deps.overlay.onMessage(createHandler('overlay'));
    this.deps.standaloneWindow.onMessage(createHandler('window'));

    this.deps.console.log('🔗 UI Message Listeners set up');
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
    this.deps.console.log(`📤 Sent ${currentBookmarks.length} bookmarks to ${uiSource}`);
  }

  private setupEventListeners(): void {
    // File loaded event
    this.deps.event.on('file-loaded', () => {
      this.deps.console.log('📁 File loaded event');
      this.refreshUI();
    });

    // Menu items
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

    this.deps.console.log('🎛️ Event listeners set up');
  }

  async addBookmark(
    title?: string,
    timestamp?: number,
    description?: string,
    tags?: string[],
  ): Promise<void> {
    try {
      // Enforce maximum bookmarks limit
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

      const filename = currentPath.split('/').pop() || currentPath;
      const cleanFilename = filename.replace(/\.[^/.]+$/, '') || 'Unknown Media';

      const bookmark: BookmarkData = {
        id: this.generateId(),
        title: title || `${cleanFilename} - ${this.formatTime(currentTime)}`,
        timestamp: currentTime,
        filepath: currentPath,
        description: description || `Bookmark at ${this.formatTime(currentTime)}`,
        createdAt: new Date().toISOString(),
        tags: tags || [],
      };

      this.bookmarks.push(bookmark);
      this.saveBookmarks();

      this.deps.console.log(`✅ Bookmark added: ${bookmark.title}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`❌ Error adding bookmark: ${errorMessage}`);
      throw error;
    }
  }

  removeBookmark(id: string): void {
    const initialLength = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);

    if (this.bookmarks.length < initialLength) {
      this.saveBookmarks();
      this.deps.console.log(`🗑️ Bookmark removed: ${id}`);
    } else {
      this.deps.console.warn(`⚠️ Bookmark not found: ${id}`);
    }
  }

  updateBookmark(id: string, data: Partial<BookmarkData>): void {
    const index = this.bookmarks.findIndex((b) => b.id === id);
    if (index !== -1) {
      this.bookmarks[index] = { ...this.bookmarks[index], ...data };
      this.saveBookmarks();
      this.deps.console.log(`✏️ Bookmark updated: ${id}`);
    } else {
      this.deps.console.warn(`⚠️ Bookmark not found for update: ${id}`);
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
        // Fallback to seek if seekTo not available
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

  private refreshUI(): void {
    // Refresh all UIs with current bookmarks
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
        this.deps.console.log(`🔀 Sort preferences loaded: ${stored}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`❌ Error loading sort preferences: ${errorMessage}`);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
      this.deps.console.log(`☁️ Handling cloud sync: ${payload.action}`);

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
          this.deps.console.warn(`⚠️ Unknown cloud sync action: ${payload.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`❌ Error handling cloud sync: ${errorMessage}`);

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
      this.deps.console.log(`📁 Handling file reconciliation: ${payload.action}`);

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
          await this.searchForSimilarFiles(payload.bookmarkId, payload.originalPath, target);
          break;
        default:
          this.deps.console.warn(`⚠️ Unknown reconciliation action: ${payload.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`❌ Error handling file reconciliation: ${errorMessage}`);
    }
  }

  // Upload bookmarks to cloud storage
  private async uploadBookmarksToCloud(
    provider: string,
    credentials: any,
    target: any,
  ): Promise<void> {
    try {
      this.deps.console.log(`☁️ Uploading bookmarks to ${provider}...`);

      const success = await cloudStorageManager.setProvider(provider, credentials);
      if (!success) {
        throw new Error('Failed to authenticate with cloud provider');
      }

      const backupId = await cloudStorageManager.uploadBookmarks(this.bookmarks);

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
      this.deps.console.error(`❌ Error uploading to cloud: ${errorMessage}`);
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
      this.deps.console.log(`☁️ Downloading bookmarks from ${provider}...`);

      const success = await cloudStorageManager.setProvider(provider, credentials);
      if (!success) {
        throw new Error('Failed to authenticate with cloud provider');
      }

      const backups = await cloudStorageManager.listBackups();
      if (backups.length === 0) {
        throw new Error('No backups found in cloud storage');
      }

      // Get the most recent backup
      const latestBackup = backups.sort().reverse()[0];
      const backup = await cloudStorageManager.downloadBookmarks(latestBackup);

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
      this.deps.console.error(`❌ Error downloading from cloud: ${errorMessage}`);
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
      this.deps.console.log(`☁️ Syncing bookmarks with ${provider}...`);

      const success = await cloudStorageManager.setProvider(provider, credentials);
      if (!success) {
        throw new Error('Failed to authenticate with cloud provider');
      }

      const result = await cloudStorageManager.syncBookmarks(this.bookmarks);

      // Update local bookmarks with merged result
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
      this.deps.console.error(`❌ Error syncing with cloud: ${errorMessage}`);
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
        this.saveBookmarks();
        this.deps.console.log(`📁 Updated bookmark path: ${oldPath} -> ${newPath}`);

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
      this.deps.console.error(`❌ Error updating bookmark path: ${errorMessage}`);
    }
  }

  // Search for similar files (by name/size)
  private async searchForSimilarFiles(
    bookmarkId: string,
    originalPath: string,
    target: any,
  ): Promise<void> {
    try {
      this.deps.console.log(`🔍 Searching for files similar to: ${originalPath}`);

      // Extract filename from path
      const fileName = originalPath.split('/').pop() || '';
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

      // Note: This is a simplified implementation
      // In a real scenario, you would need to integrate with file system APIs or spotlight search
      const similarFiles = [
        // Mock similar files - in reality these would come from file system search
        `/Users/user/Movies/${fileNameWithoutExt}_moved.mp4`,
        `/Users/user/Downloads/${fileName}`,
        `/Users/user/Desktop/${fileNameWithoutExt}.mov`,
      ].filter((path) => path !== originalPath); // Remove original path if it exists

      target.postMessage(
        JSON.stringify({
          type: 'FILE_RECONCILIATION_RESULT',
          data: {
            success: true,
            action: 'search_similar',
            bookmarkId: bookmarkId,
            originalPath: originalPath,
            similarFiles: similarFiles,
          },
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deps.console.error(`❌ Error searching for similar files: ${errorMessage}`);
    }
  }

  // Public API methods for debugging
  getAllBookmarks(): BookmarkData[] {
    return [...this.bookmarks];
  }

  getBookmarkCount(): number {
    return this.bookmarks.length;
  }
}
