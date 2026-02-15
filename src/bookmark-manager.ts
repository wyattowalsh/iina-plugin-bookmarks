// IINA Plugin Bookmarks - BookmarkManager (Orchestrator)
// ES6 Module implementation following IINA plugin guidelines (Sept 2025)

import {
  MAX_TIMESTAMP,
  errorMessage,
  type BookmarkData,
  type BookmarkUpdatableFields,
  type CloudCredentials,
  type ImportOptions,
  type SortPreferences,
  type UIMessage,
  type UISource,
  type IINARuntimeDependencies,
  type IINAUIAPI,
} from './types';
import { getCloudStorageManager } from './cloud-storage';
import { BookmarkPersistence } from './bookmark-persistence';
import { BookmarkImportExport } from './bookmark-import-export';
import { CloudSyncHandler } from './cloud-sync-handler';
import { stripHtmlTags } from './utils/validation';
import { formatTime } from './utils/formatTime';

export class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private readonly SORT_PREFERENCES_KEY = 'sortPreferences';
  private deps: IINARuntimeDependencies;
  private persistence: BookmarkPersistence;
  private importExport: BookmarkImportExport;
  private cloudSync: CloudSyncHandler;
  private eventIds: string[] = [];
  private idCounter = 0;

  constructor(dependencies: IINARuntimeDependencies) {
    this.deps = dependencies;

    const cloudStorage = getCloudStorageManager(dependencies.http, dependencies.console);
    this.persistence = new BookmarkPersistence(dependencies.preferences, dependencies.console);
    this.importExport = new BookmarkImportExport(dependencies.console);
    this.cloudSync = new CloudSyncHandler(cloudStorage, dependencies.console);

    // Initialize the plugin
    this.bookmarks = this.persistence.load();
    this.loadSortPreferences();
    this.setupEventListeners();
    this.setupWebUI();
    this.setupUIMessageListeners();

    this.deps.console.log('BookmarkManager initialized successfully');
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
      this.deps.console.error(`Error loading UI: ${errorMessage(error)}`);
    }
  }

  private setupUIMessageListeners(): void {
    const messageTypes = [
      'UI_READY',
      'REQUEST_FILE_PATH',
      'ADD_BOOKMARK',
      'DELETE_BOOKMARK',
      'JUMP_TO_BOOKMARK',
      'UPDATE_BOOKMARK',
      'HIDE_OVERLAY',
      'IMPORT_BOOKMARKS',
      'EXPORT_BOOKMARKS',
      'CLOUD_SYNC_REQUEST',
      'FILE_RECONCILIATION_REQUEST',
      'RECONCILE_FILES',
      'REQUEST_BOOKMARK_DEFAULTS',
      'SAVE_SORT_PREFERENCES',
    ];

    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      const target = this.getUITarget(ui);
      for (const msgType of messageTypes) {
        target.onMessage(msgType, (data: Record<string, unknown>) => {
          this.deps.console.log(`[${ui}] Received message: ${msgType}`);
          this.handleUIMessage({ type: msgType, payload: data }, ui);
        });
      }
    }

    this.deps.console.log('UI Message Listeners set up');
  }

  private handleUIMessage(message: UIMessage, uiSource: UISource): void {
    const p = message.payload;
    switch (message.type) {
      case 'REQUEST_FILE_PATH':
        this.sendCurrentFilePath(uiSource);
        break;

      case 'JUMP_TO_BOOKMARK':
        if (p?.id && typeof p.id === 'string') {
          this.jumpToBookmark(p.id);
          this.getUITarget(uiSource).postMessage('BOOKMARK_JUMPED', {});
        }
        break;

      case 'HIDE_OVERLAY':
        this.deps.overlay.hide();
        break;

      case 'ADD_BOOKMARK':
        this.addBookmark(
          typeof p?.title === 'string' ? p.title : undefined,
          typeof p?.timestamp === 'number' ? p.timestamp : undefined,
          typeof p?.description === 'string' ? p.description : undefined,
          Array.isArray(p?.tags) ? (p.tags as string[]) : undefined,
        )
          .then(() => {
            this.getUITarget(uiSource).postMessage('BOOKMARK_ADDED', {});
          })
          .catch((error) => {
            this.deps.console.error(`Failed to add bookmark: ${errorMessage(error)}`);
          });
        break;

      case 'DELETE_BOOKMARK':
        if (p?.id && typeof p.id === 'string') {
          this.removeBookmark(p.id);
          this.getUITarget(uiSource).postMessage('BOOKMARK_DELETED', {});
        }
        break;

      case 'UPDATE_BOOKMARK':
        if (p?.id && typeof p.id === 'string' && p?.data) {
          const raw = p.data as Record<string, unknown>;
          const updates: BookmarkUpdatableFields = {};
          if (typeof raw.title === 'string') updates.title = raw.title;
          if (typeof raw.description === 'string') updates.description = raw.description;
          if (Array.isArray(raw.tags))
            updates.tags = raw.tags.filter((t): t is string => typeof t === 'string');
          this.updateBookmark(p.id, updates);
        }
        break;

      case 'IMPORT_BOOKMARKS':
        if (p?.bookmarks && Array.isArray(p.bookmarks)) {
          this.importBookmarks(
            p.bookmarks as unknown[],
            uiSource,
            p?.options as ImportOptions | undefined,
          );
        }
        break;

      case 'EXPORT_BOOKMARKS':
        this.exportBookmarks(typeof p?.format === 'string' ? p.format : 'json', uiSource);
        break;

      case 'CLOUD_SYNC_REQUEST':
        if (p && typeof p.action === 'string' && typeof p.provider === 'string') {
          this.handleCloudSync(
            {
              action: p.action,
              provider: p.provider,
              credentials: p.credentials as CloudCredentials,
            },
            uiSource,
          ).catch((error) => {
            this.deps.console.error(`Cloud sync failed: ${errorMessage(error)}`);
          });
        }
        break;

      case 'FILE_RECONCILIATION_REQUEST':
        if (p && typeof p.action === 'string' && typeof p.bookmarkId === 'string') {
          this.handleFileReconciliation(
            {
              action: p.action,
              bookmarkId: p.bookmarkId,
              newPath: typeof p.newPath === 'string' ? p.newPath : undefined,
              originalPath: typeof p.originalPath === 'string' ? p.originalPath : undefined,
            },
            uiSource,
          ).catch((error) => {
            this.deps.console.error(`File reconciliation failed: ${errorMessage(error)}`);
          });
        }
        break;

      case 'RECONCILE_FILES':
        this.handleReconcileFiles(uiSource);
        break;

      case 'REQUEST_BOOKMARK_DEFAULTS':
        this.sendBookmarkDefaults(uiSource);
        break;

      case 'SAVE_SORT_PREFERENCES':
        if (p?.preferences) {
          this.saveSortPreferencesFromUI(p.preferences as SortPreferences);
        }
        break;

      case 'UI_READY':
        this.sendBookmarksToUI(uiSource);
        break;

      default:
        this.deps.console.warn(`[${uiSource}] Unknown message type: ${message.type}`);
    }
  }

  private getUITarget(uiSource: UISource): IINAUIAPI {
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

  private sendCurrentFilePath(uiSource: UISource): void {
    const currentPath = this.deps.core.status.path;
    const target = this.getUITarget(uiSource);
    target.postMessage('CURRENT_FILE_PATH', currentPath);
  }

  private sendBookmarksToUI(uiSource: UISource): void {
    const currentPath = this.deps.core.status.path;
    const currentBookmarks = this.getBookmarksForFile(currentPath);

    const target = this.getUITarget(uiSource);
    target.postMessage('BOOKMARKS_UPDATED', currentBookmarks);
    this.deps.console.log(`Sent ${currentBookmarks.length} bookmarks to ${uiSource}`);
  }

  private sendBookmarkDefaults(uiSource: UISource): void {
    const target = this.getUITarget(uiSource);
    const currentPath = this.deps.core.status.path || '';
    const currentTime = this.deps.core.status.currentTime || 0;
    const filename = currentPath.split('/').pop() || currentPath;
    const cleanFilename = filename.replace(/\.[^/.]+$/, '') || 'Unknown Media';

    target.postMessage('BOOKMARK_DEFAULTS', {
      title: `${cleanFilename} - ${formatTime(currentTime)}`,
      description: `Bookmark at ${formatTime(currentTime)}`,
      tags: [],
      timestamp: currentTime,
      filepath: currentPath,
    });
  }

  private saveSortPreferencesFromUI(preferences: SortPreferences): void {
    try {
      this.deps.preferences.set(this.SORT_PREFERENCES_KEY, JSON.stringify(preferences));
      this.deps.console.log('Sort preferences saved');
    } catch (error) {
      this.deps.console.error(`Error saving sort preferences: ${errorMessage(error)}`);
    }
  }

  private setupEventListeners(): void {
    const fileLoadedId = this.deps.event.on('iina.file-loaded', () => {
      this.deps.console.log('File loaded event');
      this.refreshUI();
    });
    this.eventIds.push(fileLoadedId);

    this.deps.menu.addItem(
      this.deps.menu.item('Add Bookmark at Current Time', () => {
        this.addBookmark().catch((error) => {
          this.deps.console.error(`Failed to add bookmark from menu: ${errorMessage(error)}`);
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

      if (!Number.isFinite(currentTime) || currentTime < 0 || currentTime > MAX_TIMESTAMP) {
        this.deps.console.error(
          `Invalid timestamp: ${currentTime}. Must be finite, >= 0, and <= ${MAX_TIMESTAMP}`,
        );
        return;
      }

      const filename = currentPath.split('/').pop() || currentPath;
      const cleanFilename = filename.replace(/\.[^/.]+$/, '') || 'Unknown Media';

      const safeTitle = title
        ? stripHtmlTags(title)
        : `${cleanFilename} - ${formatTime(currentTime)}`;
      const safeDescription = description
        ? stripHtmlTags(description)
        : `Bookmark at ${formatTime(currentTime)}`;

      const now = new Date().toISOString();
      const bookmark: BookmarkData = {
        id: this.generateId(),
        title: safeTitle,
        timestamp: currentTime,
        filepath: currentPath,
        description: safeDescription,
        createdAt: now,
        updatedAt: now,
        tags: tags ? tags.map((t) => stripHtmlTags(t)) : [],
      };

      this.bookmarks.push(bookmark);
      this.saveBookmarks();

      this.deps.console.log(`Bookmark added: ${bookmark.title}`);
    } catch (error) {
      this.deps.console.error(`Error adding bookmark: ${errorMessage(error)}`);
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

  updateBookmark(id: string, data: BookmarkUpdatableFields): void {
    const index = this.bookmarks.findIndex((b) => b.id === id);
    if (index !== -1) {
      const sanitized: BookmarkUpdatableFields = { ...data };
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

    this.deps.console.log(`Jumping to: ${bookmark.title} at ${formatTime(bookmark.timestamp)}`);

    try {
      if (this.deps.core.seekTo) {
        this.deps.core.seekTo(bookmark.timestamp);
      } else {
        this.deps.console.warn('seekTo() unavailable — cannot jump to bookmark');
        if (this.deps.core.osd) {
          this.deps.core.osd('seekTo() unavailable — cannot jump to bookmark');
        }
      }
    } catch (error) {
      this.deps.console.warn(`Could not seek: ${errorMessage(error)}`);
    }
  }

  getBookmarksForFile(filepath?: string): BookmarkData[] {
    if (!filepath) {
      return this.bookmarks;
    }
    return this.bookmarks.filter((bookmark) => bookmark.filepath === filepath);
  }

  private handleReconcileFiles(uiSource: UISource): void {
    const target = this.getUITarget(uiSource);
    const movedFiles = this.bookmarks.filter((b) => {
      try {
        return !this.deps.file.exists(b.filepath);
      } catch {
        return false;
      }
    });

    target.postMessage('SHOW_FILE_RECONCILIATION_DIALOG', { movedFiles });
  }

  private async handleFileReconciliation(
    payload: { action: string; bookmarkId: string; newPath?: string; originalPath?: string },
    uiSource: UISource,
  ): Promise<void> {
    try {
      this.deps.console.log(`Handling file reconciliation: ${payload.action}`);

      const target = this.getUITarget(uiSource);

      switch (payload.action) {
        case 'update_path':
          if (payload.newPath) {
            this.updateBookmarkPath(payload.bookmarkId, payload.newPath, target);
          }
          break;
        case 'remove_bookmark':
          this.removeBookmark(payload.bookmarkId);
          target.postMessage('FILE_RECONCILIATION_RESULT', {
            success: true,
            action: 'remove_bookmark',
            bookmarkId: payload.bookmarkId,
          });
          break;
        case 'search_similar':
          if (payload.originalPath) {
            this.searchForSimilarFiles(payload.bookmarkId, payload.originalPath, target);
          }
          break;
        default:
          this.deps.console.warn(`Unknown reconciliation action: ${payload.action}`);
      }
    } catch (error) {
      this.deps.console.error(`Error handling file reconciliation: ${errorMessage(error)}`);
    }
  }

  private updateBookmarkPath(bookmarkId: string, newPath: string, target: IINAUIAPI): void {
    try {
      if (!newPath || !newPath.startsWith('/')) {
        this.deps.console.error(`Invalid new path: must be non-empty and start with /`);
        return;
      }

      const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
      if (bookmark) {
        const oldPath = bookmark.filepath;
        bookmark.filepath = newPath;
        bookmark.updatedAt = new Date().toISOString();
        this.saveBookmarks();
        this.deps.console.log(`Updated bookmark path: ${oldPath} -> ${newPath}`);

        target.postMessage('FILE_RECONCILIATION_RESULT', {
          success: true,
          action: 'update_path',
          bookmarkId: bookmarkId,
          oldPath: oldPath,
          newPath: newPath,
        });
      }
    } catch (error) {
      this.deps.console.error(`Error updating bookmark path: ${errorMessage(error)}`);
    }
  }

  private searchForSimilarFiles(bookmarkId: string, originalPath: string, target: IINAUIAPI): void {
    this.deps.console.log(`Similar file search not implemented for: ${originalPath}`);

    target.postMessage('FILE_RECONCILIATION_RESULT', {
      success: true,
      action: 'search_similar',
      bookmarkId: bookmarkId,
      originalPath: originalPath,
      similarFiles: [],
      message: 'Similar file search is not yet implemented',
    });
  }

  /** Delegate import to BookmarkImportExport module */
  private importBookmarks(
    rawBookmarks: unknown[],
    uiSource: UISource,
    options?: ImportOptions,
  ): void {
    const target = this.getUITarget(uiSource);
    const { bookmarks, result } = this.importExport.import(
      this.bookmarks,
      rawBookmarks,
      options,
      () => this.generateId(),
    );

    this.bookmarks = bookmarks;
    this.saveBookmarks();

    target.postMessage('IMPORT_RESULT', result);
  }

  /** Delegate export to BookmarkImportExport module */
  private exportBookmarks(format: string, uiSource: UISource): void {
    const target = this.getUITarget(uiSource);

    if (format === 'csv') {
      target.postMessage('EXPORT_RESULT', {
        format: 'csv',
        content: this.importExport.exportCSV(this.bookmarks),
      });
    } else {
      target.postMessage('EXPORT_RESULT', {
        format: 'json',
        content: this.importExport.exportJSON(this.bookmarks),
      });
    }
  }

  /** Delegate cloud sync to CloudSyncHandler (includes concurrency guard) */
  private async handleCloudSync(
    payload: { action: string; provider: string; credentials: CloudCredentials },
    uiSource: UISource,
  ): Promise<void> {
    const target = this.getUITarget(uiSource);
    const updatedBookmarks = await this.cloudSync.handleSync(payload, this.bookmarks, target);

    if (updatedBookmarks) {
      this.bookmarks = updatedBookmarks;
      this.saveBookmarks();
    }
  }

  private saveBookmarks(): void {
    this.persistence.save(this.bookmarks);
    this.refreshUI();
  }

  private refreshUI(): void {
    this.sendBookmarksToUI('sidebar');
    this.sendBookmarksToUI('overlay');
    this.sendBookmarksToUI('window');
  }

  private loadSortPreferences(): void {
    try {
      const stored = this.deps.preferences.get(this.SORT_PREFERENCES_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        this.deps.console.log(`Sort preferences loaded: ${stored}`);
        for (const ui of ['sidebar', 'overlay', 'window'] as const) {
          this.getUITarget(ui).postMessage('SORT_PREFERENCES', preferences);
        }
      }
    } catch (error) {
      this.deps.console.error(`Error loading sort preferences: ${errorMessage(error)}`);
    }
  }

  private generateId(): string {
    return (
      Date.now().toString(36) +
      '-' +
      (this.idCounter++).toString(36) +
      '-' +
      Math.random().toString(36).substring(2)
    );
  }

  /** Clean up event listeners registered by this instance */
  destroy(): void {
    for (const id of this.eventIds) {
      this.deps.event.off('iina.file-loaded', id);
    }
    this.eventIds = [];
  }

  getAllBookmarks(): BookmarkData[] {
    return [...this.bookmarks];
  }

  getBookmarkCount(): number {
    return this.bookmarks.length;
  }
}
