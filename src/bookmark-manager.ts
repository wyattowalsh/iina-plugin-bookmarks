// IINA Plugin Bookmarks - BookmarkManager (Orchestrator)
// ES6 Module implementation following IINA plugin guidelines (Sept 2025)

import {
  MAX_TIMESTAMP,
  errorMessage,
  type BookmarkData,
  type BookmarkUpdatableFields,
  type BookmarkCollection,
  type SmartCollection,
  type SmartCollectionFilters,
  type BookmarkColor,
  type ImportOptions,
  type ExportFormat,
  type ExportResult,
  type SortPreferences,
  type UIMessage,
  type UISource,
  type ChapterInfo,
  type IINARuntimeDependencies,
  type IINAUIAPI,
} from './types';
import { BookmarkPersistence } from './bookmark-persistence';
import { BookmarkImportExport } from './bookmark-import-export';
import { ThumbnailGenerator } from './thumbnail-generator';
import { isSafeBookmarkId, isValidEndTimestamp, stripHtmlTags } from './utils/validation';
import { formatTime } from './utils/formatTime';

export class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private collections: BookmarkCollection[] = [];
  private smartCollections: SmartCollection[] = [];
  private readonly SORT_PREFERENCES_KEY = 'sortPreferences';
  private readonly COLLECTIONS_KEY = 'bookmark_collections';
  private readonly SMART_COLLECTIONS_KEY = 'smart_collections';
  private readonly RESUME_POSITIONS_KEY = 'resumePositions';
  private deps: IINARuntimeDependencies;
  private persistence: BookmarkPersistence;
  private importExport: BookmarkImportExport;
  private thumbnailGenerator: ThumbnailGenerator;
  private eventIds: Array<{ event: string; id: string }> = [];
  private uiInitialized = false;
  private idCounter = 0;
  private pendingSeek: { cancel: () => void } | null = null;
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private cachedChapters: ChapterInfo[] = [];
  private resumePositions: Record<string, number> = {};
  private pendingInPoint: number | null = null;
  private readonly MAX_COLLECTION_IMPORT = 200;
  private readonly MAX_SMART_COLLECTION_IMPORT = 200;

  constructor(dependencies: IINARuntimeDependencies) {
    this.deps = dependencies;

    this.persistence = new BookmarkPersistence(
      dependencies.preferences,
      dependencies.console,
      dependencies.file,
    );
    this.importExport = new BookmarkImportExport(dependencies.console);
    this.thumbnailGenerator = new ThumbnailGenerator(dependencies);

    // Non-UI initialization (safe before window loads)
    this.bookmarks = this.persistence.load();
    this.loadCollections();
    this.loadResumePositions();
    this.setupEventListeners();

    // UI setup requires the window — defer until iina.window-loaded
    if (this.deps.core.window?.loaded) {
      this.initializeUI();
    } else {
      const id = this.deps.event.on('iina.window-loaded', () => {
        this.initializeUI();
      });
      this.eventIds.push({ event: 'iina.window-loaded', id });
    }

    this.deps.console.log('BookmarkManager initialized successfully');
  }

  // IINA requires window to be loaded before loadFile/onMessage/postMessage.
  // Order matters: loadFile() clears message listeners, so onMessage must come after.
  private initializeUI(): void {
    if (this.uiInitialized) return;
    this.uiInitialized = true;

    this.setupWebUI();
    this.setupUIMessageListeners();
    this.loadSortPreferences();
    this.deps.console.log('UI initialized after window loaded');
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
      'FILE_RECONCILIATION_REQUEST',
      'RECONCILE_FILES',
      'REQUEST_BOOKMARK_DEFAULTS',
      'SAVE_SORT_PREFERENCES',
      // Collections
      'CREATE_COLLECTION',
      'UPDATE_COLLECTION',
      'DELETE_COLLECTION',
      'CREATE_SMART_COLLECTION',
      'UPDATE_SMART_COLLECTION',
      'DELETE_SMART_COLLECTION',
      'ADD_TO_COLLECTION',
      'REMOVE_FROM_COLLECTION',
      // Batch operations
      'BATCH_DELETE',
      'BATCH_TAG',
      'BATCH_ASSIGN_COLLECTION',
      'BATCH_PIN',
      'BATCH_COLOR',
      // A-B Loop
      'SET_AB_LOOP',
      'CLEAR_AB_LOOP',
      // Navigation
      'NEXT_BOOKMARK',
      'PREV_BOOKMARK',
      // Thumbnails
      'REQUEST_THUMBNAIL',
      // Range I/O marking
      'SET_IN_POINT',
      'SET_OUT_POINT',
      // Direct seek
      'SEEK_TO_TIMESTAMP',
      // Scratchpad
      'PROMOTE_SCRATCHPAD',
      'DISCARD_SCRATCHPAD',
      // Duplicate resolution
      'CONFIRM_BOOKMARK',
      'MERGE_BOOKMARK',
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

      case 'SEEK_TO_TIMESTAMP':
        if (typeof p?.timestamp === 'number') {
          this.deps.core.seekTo?.(p.timestamp);
        }
        break;

      case 'HIDE_OVERLAY':
        this.deps.overlay.hide();
        break;

      case 'ADD_BOOKMARK': {
        const addOptions: {
          skipDuplicateCheck?: boolean;
          color?: BookmarkColor;
          endTimestamp?: number;
        } = {};
        if (typeof p?.color === 'string') addOptions.color = p.color as BookmarkColor;
        if (typeof p?.endTimestamp === 'number') addOptions.endTimestamp = p.endTimestamp;
        this.addBookmark(
          typeof p?.title === 'string' ? p.title : undefined,
          typeof p?.timestamp === 'number' ? p.timestamp : undefined,
          typeof p?.description === 'string' ? p.description : undefined,
          Array.isArray(p?.tags) ? (p.tags as string[]) : undefined,
          Object.keys(addOptions).length > 0 ? addOptions : undefined,
        )
          .then(() => {
            this.getUITarget(uiSource).postMessage('BOOKMARK_ADDED', {});
          })
          .catch((error) => {
            this.deps.console.error(`Failed to add bookmark: ${errorMessage(error)}`);
            this.getUITarget(uiSource).postMessage('ERROR', { message: errorMessage(error) });
          });
        break;
      }

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
          if (Array.isArray(raw.tags)) {
            updates.tags = raw.tags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => stripHtmlTags(t.trim()))
              .filter((t) => t.length > 0);
          }
          if (typeof raw.color === 'string') updates.color = raw.color as BookmarkColor;
          if (typeof raw.endTimestamp === 'number') {
            if (
              Number.isFinite(raw.endTimestamp) &&
              raw.endTimestamp >= 0 &&
              raw.endTimestamp <= MAX_TIMESTAMP
            ) {
              updates.endTimestamp = raw.endTimestamp;
            } else {
              this.deps.console.warn(`Ignored invalid endTimestamp update for ${p.id}`);
            }
          }
          if (typeof raw.pinned === 'boolean') updates.pinned = raw.pinned;
          if (typeof raw.scratchpad === 'boolean') updates.scratchpad = raw.scratchpad;
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
          // Merge collections from v2 import format
          if (Array.isArray(p.collections)) {
            this.mergeImportedCollections(p.collections as BookmarkCollection[]);
          }
          if (Array.isArray(p.smartCollections)) {
            this.mergeImportedSmartCollections(p.smartCollections as SmartCollection[]);
          }
        }
        break;

      case 'EXPORT_BOOKMARKS':
        this.exportBookmarks(typeof p?.format === 'string' ? p.format : 'json', uiSource);
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
        this.getUITarget(uiSource).postMessage('COLLECTIONS_UPDATED', this.collections);
        this.getUITarget(uiSource).postMessage(
          'SMART_COLLECTIONS_UPDATED',
          this.smartCollections.map((sc) => this.resolveSmartCollectionDates(sc)),
        );
        break;

      // Collections
      case 'CREATE_COLLECTION':
        if (typeof p?.name === 'string') {
          this.createCollection(
            p.name,
            typeof p.description === 'string' ? p.description : undefined,
            typeof p.color === 'string' ? (p.color as BookmarkColor) : undefined,
            typeof p.icon === 'string' ? p.icon : undefined,
          );
        }
        break;

      case 'UPDATE_COLLECTION':
        if (typeof p?.id === 'string' && p?.data) {
          this.updateCollection(
            p.id,
            p.data as Partial<Omit<BookmarkCollection, 'id' | 'createdAt'>>,
          );
        }
        break;

      case 'DELETE_COLLECTION':
        if (typeof p?.id === 'string') {
          this.deleteCollection(p.id);
        }
        break;

      case 'CREATE_SMART_COLLECTION':
        if (typeof p?.name === 'string') {
          this.createSmartCollection(
            p.name,
            typeof p.description === 'string' ? p.description : undefined,
            p.filters as SmartCollectionFilters | undefined,
            typeof p.color === 'string' ? (p.color as BookmarkColor) : undefined,
            typeof p.icon === 'string' ? p.icon : undefined,
          );
        }
        break;

      case 'UPDATE_SMART_COLLECTION':
        if (typeof p?.id === 'string' && p?.data) {
          this.updateSmartCollection(
            p.id,
            p.data as Partial<Omit<SmartCollection, 'id' | 'createdAt' | 'builtin'>>,
          );
        }
        break;

      case 'DELETE_SMART_COLLECTION':
        if (typeof p?.id === 'string') {
          this.deleteSmartCollection(p.id);
        }
        break;

      case 'ADD_TO_COLLECTION':
        if (Array.isArray(p?.bookmarkIds) && typeof p?.collectionId === 'string') {
          this.addToCollection(p.bookmarkIds as string[], p.collectionId);
        }
        break;

      case 'REMOVE_FROM_COLLECTION':
        if (Array.isArray(p?.bookmarkIds) && typeof p?.collectionId === 'string') {
          this.removeFromCollection(p.bookmarkIds as string[], p.collectionId);
        }
        break;

      // Batch operations
      case 'BATCH_DELETE':
        if (Array.isArray(p?.ids)) {
          this.batchDelete(p.ids as string[]);
        }
        break;

      case 'BATCH_TAG':
        if (Array.isArray(p?.ids) && Array.isArray(p?.tags) && typeof p?.action === 'string') {
          this.batchTag(p.ids as string[], p.tags as string[], p.action as 'add' | 'remove');
        }
        break;

      case 'BATCH_ASSIGN_COLLECTION':
        if (
          Array.isArray(p?.ids) &&
          typeof p?.collectionId === 'string' &&
          typeof p?.action === 'string'
        ) {
          this.batchAssignCollection(
            p.ids as string[],
            p.collectionId,
            p.action as 'add' | 'remove',
          );
        }
        break;

      case 'BATCH_PIN':
        if (Array.isArray(p?.ids) && typeof p?.pinned === 'boolean') {
          this.batchPin(p.ids as string[], p.pinned);
        }
        break;

      case 'BATCH_COLOR':
        if (Array.isArray(p?.ids) && typeof p?.color === 'string') {
          this.batchColor(p.ids as string[], p.color as BookmarkColor);
        }
        break;

      // A-B Loop
      case 'SET_AB_LOOP':
        if (typeof p?.bookmarkId === 'string') {
          this.setABLoop(p.bookmarkId);
        }
        break;

      case 'CLEAR_AB_LOOP':
        this.clearABLoop();
        break;

      // Navigation
      case 'NEXT_BOOKMARK':
        if (typeof p?.currentId === 'string') {
          const scope = (typeof p?.scope === 'string' ? p.scope : 'file') as 'file' | 'all';
          this.navigateBookmark(p.currentId, 'next', scope);
        }
        break;

      case 'PREV_BOOKMARK':
        if (typeof p?.currentId === 'string') {
          const scope = (typeof p?.scope === 'string' ? p.scope : 'file') as 'file' | 'all';
          this.navigateBookmark(p.currentId, 'prev', scope);
        }
        break;

      // Thumbnails
      case 'REQUEST_THUMBNAIL':
        if (typeof p?.bookmarkId === 'string' && isSafeBookmarkId(p.bookmarkId)) {
          const bookmark = this.bookmarks.find((b) => b.id === p.bookmarkId);
          if (bookmark) {
            const thumbnailPath = this.thumbnailGenerator.generate(bookmark);
            if (thumbnailPath) {
              bookmark.thumbnailPath = thumbnailPath;
              this.saveBookmarks();
              this.getUITarget(uiSource).postMessage('THUMBNAIL_READY', {
                bookmarkId: bookmark.id,
                path: thumbnailPath,
              });
            }
          }
        }
        break;

      // Range I/O marking
      case 'SET_IN_POINT': {
        const inTime = this.deps.core.status.currentTime || 0;
        this.pendingInPoint = inTime;
        this.deps.core.osd?.(`In: ${formatTime(inTime)}`);
        break;
      }

      case 'SET_OUT_POINT': {
        const outTime = this.deps.core.status.currentTime || 0;
        if (this.pendingInPoint !== null) {
          const startTime = Math.min(this.pendingInPoint, outTime);
          const endTime = Math.max(this.pendingInPoint, outTime);
          this.addBookmark(undefined, startTime, undefined, undefined, {
            skipDuplicateCheck: true,
          })
            .then((bookmarkId) => {
              if (bookmarkId) {
                const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
                if (bookmark) {
                  bookmark.endTimestamp = endTime;
                  this.saveBookmarks();
                  this.deps.core.osd?.(
                    `Range bookmark: ${formatTime(startTime)} → ${formatTime(endTime)}`,
                  );
                }
              }
            })
            .catch((error) => {
              this.deps.console.error(`Failed to create range bookmark: ${errorMessage(error)}`);
            });
          this.pendingInPoint = null;
        } else {
          this.deps.core.osd?.('Set In point first (press I)');
        }
        break;
      }

      // Scratchpad
      case 'PROMOTE_SCRATCHPAD':
        if (Array.isArray(p?.ids)) {
          this.promoteScratchpad(p.ids as string[]);
        }
        break;

      case 'DISCARD_SCRATCHPAD':
        if (Array.isArray(p?.ids)) {
          this.discardScratchpad(p.ids as string[]);
        }
        break;

      // Duplicate resolution
      case 'CONFIRM_BOOKMARK':
        this.addBookmark(
          typeof p?.title === 'string' ? p.title : undefined,
          typeof p?.timestamp === 'number' ? p.timestamp : undefined,
          typeof p?.description === 'string' ? p.description : undefined,
          Array.isArray(p?.tags) ? (p.tags as string[]) : undefined,
          { skipDuplicateCheck: true },
        )
          .then(() => {
            this.getUITarget(uiSource).postMessage('BOOKMARK_ADDED', {});
          })
          .catch((error) => {
            this.deps.console.error(`Failed to confirm bookmark: ${errorMessage(error)}`);
          });
        break;

      case 'MERGE_BOOKMARK':
        if (typeof p?.existingId === 'string' && p?.mergeData) {
          this.updateBookmark(p.existingId, p.mergeData as BookmarkUpdatableFields);
          this.getUITarget(uiSource).postMessage('BOOKMARK_ADDED', {});
        }
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
    if (!this.uiInitialized) return;
    if (uiSource === 'overlay') {
      // Overlay: server-filtered for performance during playback
      const currentPath = this.deps.core.status.path;
      const currentBookmarks = this.getBookmarksForFile(currentPath);
      this.getUITarget('overlay').postMessage('BOOKMARKS_UPDATED', currentBookmarks);
      this.deps.console.log(`Sent ${currentBookmarks.length} bookmarks to overlay`);
    } else {
      // Window + sidebar: all bookmarks, client-side filtering
      const target = this.getUITarget(uiSource);
      target.postMessage('BOOKMARKS_UPDATED', this.bookmarks);
      this.deps.console.log(`Sent ${this.bookmarks.length} bookmarks to ${uiSource}`);
    }
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
      this.startPlaybackBroadcast();
      this.checkResumePosition();
    });
    this.eventIds.push({ event: 'iina.file-loaded', id: fileLoadedId });

    this.deps.menu.addItem(
      this.deps.menu.item('Add Bookmark at Current Time', () => {
        this.addBookmark().catch((error) => {
          this.deps.console.error(`Failed to add bookmark from menu: ${errorMessage(error)}`);
        });
      }),
    );

    this.deps.menu.addItem(
      this.deps.menu.item('Manage Bookmarks', () => {
        this.sendBookmarksToUI('window');
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

    // Global hotkeys
    this.deps.menu.addItem(
      this.deps.menu.item(
        'Quick Bookmark',
        () => {
          this.quickBookmark();
        },
        { keyBinding: 'Ctrl+b' },
      ),
    );

    this.deps.menu.addItem(
      this.deps.menu.item(
        'Next Bookmark',
        () => {
          this.navigateToAdjacentFromCurrent('next');
        },
        { keyBinding: 'Ctrl+]' },
      ),
    );

    this.deps.menu.addItem(
      this.deps.menu.item(
        'Previous Bookmark',
        () => {
          this.navigateToAdjacentFromCurrent('prev');
        },
        { keyBinding: 'Ctrl+[' },
      ),
    );

    this.deps.console.log('Event listeners set up');
  }

  async addBookmark(
    title?: string,
    timestamp?: number,
    description?: string,
    tags?: string[],
    options?: {
      skipDuplicateCheck?: boolean;
      color?: BookmarkColor;
      endTimestamp?: number;
      scratchpad?: boolean;
    },
  ): Promise<string | undefined> {
    const maxBookmarks = parseInt(this.deps.preferences.get('maxBookmarks') || '1000', 10) || 1000;
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
      throw new Error(
        `Invalid timestamp: ${currentTime}. Must be finite, >= 0, and <= ${MAX_TIMESTAMP}`,
      );
    }

    // Duplicate detection
    const thresholdStr = this.deps.preferences.get('duplicateDetectionThreshold');
    const threshold = thresholdStr ? parseInt(thresholdStr, 10) : 5;
    if (threshold > 0 && !options?.skipDuplicateCheck) {
      const nearDuplicate = this.bookmarks.find(
        (b) => b.filepath === currentPath && Math.abs(b.timestamp - currentTime) <= threshold,
      );
      if (nearDuplicate) {
        for (const ui of ['sidebar', 'overlay', 'window'] as const) {
          this.getUITarget(ui).postMessage('BOOKMARK_NEAR_DUPLICATE', {
            existingBookmark: nearDuplicate,
            proposedTimestamp: currentTime,
            distance: Math.abs(nearDuplicate.timestamp - currentTime),
          });
        }
        this.deps.console.log(
          `Near-duplicate detected: "${nearDuplicate.title}" is ${Math.abs(nearDuplicate.timestamp - currentTime)}s away`,
        );
        return undefined;
      }
    }

    const filename = currentPath.split('/').pop() || currentPath;
    const cleanFilename = filename.replace(/\.[^/.]+$/, '') || 'Unknown Media';

    const safeTitle = title
      ? stripHtmlTags(title)
      : this.generateAutoTitle(cleanFilename, currentTime);
    const safeDescription = description
      ? stripHtmlTags(description)
      : `Bookmark at ${formatTime(currentTime)}`;

    // Extract #hashtags from description and merge into tags
    const hashtagRegex = /#(\w[\w/-]*)/g;
    const extractedTags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(safeDescription)) !== null) {
      extractedTags.push(match[1]);
    }
    const mergedTags = [
      ...new Set([...(tags ? tags.map((t) => stripHtmlTags(t)) : []), ...extractedTags]),
    ];

    const now = new Date().toISOString();
    const safeEndTimestamp = isValidEndTimestamp(options?.endTimestamp, currentTime)
      ? options.endTimestamp
      : undefined;
    if (options?.endTimestamp !== undefined && safeEndTimestamp === undefined) {
      this.deps.console.warn('Ignored invalid endTimestamp on addBookmark');
    }
    const bookmark: BookmarkData = {
      id: this.generateId(),
      title: safeTitle,
      timestamp: currentTime,
      filepath: currentPath,
      description: safeDescription,
      createdAt: now,
      updatedAt: now,
      tags: mergedTags,
      ...(options?.color ? { color: options.color } : {}),
      ...(safeEndTimestamp !== undefined ? { endTimestamp: safeEndTimestamp } : {}),
      ...(options?.scratchpad ? { scratchpad: true } : {}),
    };

    // Chapter enrichment
    const chapters = this.deps.core.getChapters?.() || [];
    const activeChapter = chapters
      .filter((ch) => ch.time <= bookmark.timestamp)
      .sort((a, b) => b.time - a.time)[0];
    if (activeChapter) bookmark.chapterTitle = activeChapter.title;

    // Subtitle capture
    const subtitleText = this.deps.mpv?.getString?.('sub-text');
    if (subtitleText?.trim()) bookmark.subtitleText = subtitleText.trim();

    this.bookmarks.push(bookmark);
    this.saveBookmarks();

    this.deps.console.log(`Bookmark added: ${bookmark.title}`);
    return bookmark.id;
  }

  removeBookmark(id: string): void {
    const initialLength = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);

    if (this.bookmarks.length < initialLength) {
      // Clean from collections
      for (const collection of this.collections) {
        const idx = collection.bookmarkIds.indexOf(id);
        if (idx !== -1) {
          collection.bookmarkIds.splice(idx, 1);
        }
      }
      this.saveCollections();
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
      if (Array.isArray(sanitized.tags)) {
        sanitized.tags = sanitized.tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => stripHtmlTags(t.trim()))
          .filter((t) => t.length > 0);
      }
      if (sanitized.endTimestamp !== undefined) {
        if (!isValidEndTimestamp(sanitized.endTimestamp, this.bookmarks[index].timestamp)) {
          this.deps.console.warn(`Ignored invalid endTimestamp update for ${id}`);
          delete sanitized.endTimestamp;
        }
      }

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

    const currentPath = this.deps.core.status.path;
    if (bookmark.filepath === currentPath) {
      try {
        if (this.deps.core.seekTo) {
          this.deps.core.seekTo(bookmark.timestamp);
          this.deps.core.osd?.(`Jumped to "${bookmark.title}"`);
        } else {
          this.deps.console.warn('seekTo() unavailable');
          this.deps.core.osd?.('seekTo() unavailable — cannot jump');
        }
      } catch (error) {
        this.deps.console.warn(`Could not seek: ${errorMessage(error)}`);
      }
      return;
    }

    // Cross-file jump
    if (!this.deps.core.open) {
      this.deps.console.warn('core.open() unavailable — cannot open different file');
      this.deps.core.osd?.('Cannot open different file');
      return;
    }

    // Cancel any previous pending seek
    this.pendingSeek?.cancel();

    let cancelled = false;
    const timeout = setTimeout(() => {
      cancelled = true;
      this.deps.event.off('iina.file-started', listenerId);
      this.deps.core.osd?.('Jump timed out — file did not load');
      this.pendingSeek = null;
    }, 10000);

    const listenerId = this.deps.event.on('iina.file-started', () => {
      this.deps.event.off('iina.file-started', listenerId);
      clearTimeout(timeout);
      if (!cancelled) {
        this.deps.core.seekTo?.(bookmark.timestamp);
        this.deps.core.osd?.(`Jumped to "${bookmark.title}"`);
      }
      this.pendingSeek = null;
    });

    this.pendingSeek = {
      cancel: () => {
        cancelled = true;
        clearTimeout(timeout);
        this.deps.event.off('iina.file-started', listenerId);
        this.pendingSeek = null;
      },
    };

    this.deps.core.open(bookmark.filepath);
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
        // Fail-safe: flag for reconciliation when we can't check file existence
        return true;
      }
    });

    target.postMessage('SHOW_FILE_RECONCILIATION_DIALOG', { movedFiles });
  }

  private async handleFileReconciliation(
    payload: { action: string; bookmarkId: string; newPath?: string; originalPath?: string },
    uiSource: UISource,
  ): Promise<void> {
    const target = this.getUITarget(uiSource);
    try {
      this.deps.console.log(`Handling file reconciliation: ${payload.action}`);

      switch (payload.action) {
        case 'update_path':
          if (payload.newPath) {
            this.updateBookmarkPath(payload.bookmarkId, payload.newPath, target);
          } else {
            const message = 'Missing new path for update_path action';
            this.deps.console.error(message);
            target.postMessage('FILE_RECONCILIATION_RESULT', {
              success: false,
              action: 'update_path',
              bookmarkId: payload.bookmarkId,
              newPath: payload.newPath,
              message,
            });
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
          } else {
            const message = 'Missing original path for search_similar action';
            this.deps.console.error(message);
            target.postMessage('FILE_RECONCILIATION_RESULT', {
              success: false,
              action: 'search_similar',
              bookmarkId: payload.bookmarkId,
              originalPath: payload.originalPath,
              message,
            });
          }
          break;
        default: {
          const message = `Unknown reconciliation action: ${payload.action}`;
          this.deps.console.warn(message);
          target.postMessage('FILE_RECONCILIATION_RESULT', {
            success: false,
            action: payload.action,
            bookmarkId: payload.bookmarkId,
            newPath: payload.newPath,
            originalPath: payload.originalPath,
            message,
          });
        }
      }
    } catch (error) {
      const message = `Error handling file reconciliation: ${errorMessage(error)}`;
      this.deps.console.error(message);
      target.postMessage('FILE_RECONCILIATION_RESULT', {
        success: false,
        action: payload.action,
        bookmarkId: payload.bookmarkId,
        newPath: payload.newPath,
        originalPath: payload.originalPath,
        message,
      });
    }
  }

  private updateBookmarkPath(bookmarkId: string, newPath: string, target: IINAUIAPI): void {
    try {
      if (!newPath || !newPath.startsWith('/')) {
        const message = `Invalid new path: must be non-empty and start with /`;
        this.deps.console.error(message);
        target.postMessage('FILE_RECONCILIATION_RESULT', {
          success: false,
          action: 'update_path',
          bookmarkId,
          newPath,
          message,
        });
        return;
      }

      const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
      if (!bookmark) {
        const message = `Bookmark not found for path update: ${bookmarkId}`;
        this.deps.console.warn(message);
        target.postMessage('FILE_RECONCILIATION_RESULT', {
          success: false,
          action: 'update_path',
          bookmarkId,
          newPath,
          message,
        });
        return;
      }

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
    } catch (error) {
      const message = `Error updating bookmark path: ${errorMessage(error)}`;
      this.deps.console.error(message);
      target.postMessage('FILE_RECONCILIATION_RESULT', {
        success: false,
        action: 'update_path',
        bookmarkId,
        newPath,
        message,
      });
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

  /** Merge imported collections (skip duplicates by ID) */
  private mergeImportedCollections(imported: BookmarkCollection[]): void {
    const sanitized = this.sanitizeCollections(
      imported,
      this.MAX_COLLECTION_IMPORT,
      'imported collections',
    );
    const existingIds = new Set(this.collections.map((c) => c.id));
    let added = 0;
    for (const col of sanitized) {
      if (col.id && col.name && !existingIds.has(col.id)) {
        this.collections.push(col);
        existingIds.add(col.id);
        added++;
      }
    }
    if (added > 0) {
      this.saveCollections();
    }
  }

  /** Merge imported smart collections (skip duplicates and builtins) */
  private mergeImportedSmartCollections(imported: SmartCollection[]): void {
    const sanitized = this.sanitizeSmartCollections(
      imported,
      this.MAX_SMART_COLLECTION_IMPORT,
      'imported smart collections',
    );
    const existingIds = new Set(this.smartCollections.map((sc) => sc.id));
    let added = 0;
    for (const sc of sanitized) {
      if (sc.id && sc.name && !existingIds.has(sc.id) && !sc.builtin) {
        this.smartCollections.push(sc);
        existingIds.add(sc.id);
        added++;
      }
    }
    if (added > 0) {
      this.saveSmartCollections();
    }
  }

  /** Delegate export to BookmarkImportExport module */
  private exportBookmarks(format: string, uiSource: UISource): void {
    const target = this.getUITarget(uiSource);
    const exportFormat: ExportFormat = format === 'csv' ? 'csv' : 'json';

    try {
      const content =
        exportFormat === 'csv'
          ? this.importExport.exportCSV(this.bookmarks)
          : this.importExport.exportJSONv2(this.bookmarks, this.collections, this.smartCollections);
      const result: ExportResult = {
        success: true,
        format: exportFormat,
        content,
      };
      target.postMessage('EXPORT_RESULT', result);
    } catch (error) {
      const result: ExportResult = {
        success: false,
        format: exportFormat,
        error: errorMessage(error),
      };
      target.postMessage('EXPORT_RESULT', result);
      this.deps.console.error(`Export failed: ${errorMessage(error)}`);
    }
  }

  private saveBookmarks(): void {
    this.persistence.save(this.bookmarks);
    this.persistence.saveAutoBackup(this.bookmarks);
    this.refreshUI();
  }

  private refreshUI(): void {
    if (!this.uiInitialized) return;
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

  // ---------------------------------------------------------------------------
  // Scratchpad lifecycle
  // ---------------------------------------------------------------------------

  promoteScratchpad(ids: string[]): void {
    let changed = false;
    for (const id of ids) {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (bookmark?.scratchpad) {
        bookmark.scratchpad = false;
        bookmark.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      this.saveBookmarks();
      this.deps.console.log(`Promoted ${ids.length} scratchpad bookmark(s)`);
    }
  }

  discardScratchpad(ids: string[]): void {
    const idSet = new Set(ids);
    const discardedIdSet = new Set(
      this.bookmarks.filter((b) => idSet.has(b.id) && b.scratchpad).map((b) => b.id),
    );
    if (discardedIdSet.size > 0) {
      this.bookmarks = this.bookmarks.filter((b) => !discardedIdSet.has(b.id));
      for (const collection of this.collections) {
        collection.bookmarkIds = collection.bookmarkIds.filter((id) => !discardedIdSet.has(id));
      }
      this.saveBookmarks();
      this.saveCollections();
      this.deps.console.log(`Discarded ${discardedIdSet.size} scratchpad bookmark(s)`);
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-resume (last position per file)
  // ---------------------------------------------------------------------------

  private loadResumePositions(): void {
    try {
      const stored = this.deps.preferences.get(this.RESUME_POSITIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          this.deps.console.warn('Could not load resume positions: expected object map');
          this.resumePositions = {};
          return;
        }
        const safePositions: Record<string, number> = {};
        for (const [path, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (
            typeof path === 'string' &&
            typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= 0 &&
            value <= MAX_TIMESTAMP
          ) {
            safePositions[path] = value;
          }
        }
        this.resumePositions = safePositions;
      }
    } catch (error) {
      this.deps.console.warn(`Could not load resume positions: ${errorMessage(error)}`);
      this.resumePositions = {};
    }
  }

  saveResumePosition(): void {
    const path = this.deps.core.status.path;
    const position = this.deps.core.status.position || this.deps.core.status.currentTime || 0;
    const duration = this.deps.core.status.duration || 0;

    // Only save if > 5 seconds in and not near the end
    if (path && position > 5 && (duration === 0 || position < duration - 5)) {
      this.resumePositions[path] = position;
      try {
        this.deps.preferences.set(this.RESUME_POSITIONS_KEY, JSON.stringify(this.resumePositions));
      } catch (error) {
        this.deps.console.warn(`Could not save resume position: ${errorMessage(error)}`);
      }
    }
  }

  private checkResumePosition(): void {
    const path = this.deps.core.status.path;
    if (!path) return;

    const autoResume = this.deps.preferences.get('autoResume');
    if (autoResume === 'false') return;

    const position = this.resumePositions[path];
    if (typeof position === 'number' && Number.isFinite(position) && position > 5) {
      this.deps.sidebar.postMessage('RESUME_POSITION', {
        filepath: path,
        timestamp: position,
      });
      this.deps.console.log(`Resume position available for ${path}: ${formatTime(position)}`);
    }
  }

  private generateAutoTitle(cleanFilename: string, timestamp: number): string {
    const chapters = this.deps.core.getChapters?.() || [];
    const activeChapter = chapters
      .filter((ch) => ch.time <= timestamp)
      .sort((a, b) => b.time - a.time)[0];

    if (activeChapter) {
      return `Ch: ${activeChapter.title} — ${formatTime(timestamp)}`;
    }

    const subtitleText = this.deps.mpv?.getString?.('sub-text');
    if (subtitleText?.trim()) {
      const excerpt = subtitleText.trim().substring(0, 60);
      return `${excerpt}${subtitleText.trim().length > 60 ? '...' : ''} — ${formatTime(timestamp)}`;
    }

    return `${cleanFilename} - ${formatTime(timestamp)}`;
  }

  // ---------------------------------------------------------------------------
  // Collections CRUD
  // ---------------------------------------------------------------------------

  private loadCollections(): void {
    try {
      const stored = this.deps.preferences.get(this.COLLECTIONS_KEY);
      if (stored) {
        this.collections = this.sanitizeCollections(
          JSON.parse(stored),
          this.MAX_COLLECTION_IMPORT,
          'stored collections',
        );
      }
    } catch (error) {
      this.deps.console.warn(`Could not load collections: ${errorMessage(error)}`);
    }
    try {
      const stored = this.deps.preferences.get(this.SMART_COLLECTIONS_KEY);
      if (stored) {
        this.smartCollections = this.sanitizeSmartCollections(
          JSON.parse(stored),
          this.MAX_SMART_COLLECTION_IMPORT,
          'stored smart collections',
        );
      }
    } catch (error) {
      this.deps.console.warn(`Could not load smart collections: ${errorMessage(error)}`);
    }
    this.ensureBuiltinSmartCollections();
  }

  private sanitizeCollections(
    input: unknown,
    cap: number,
    sourceLabel: string,
  ): BookmarkCollection[] {
    if (!Array.isArray(input)) return [];

    const now = new Date().toISOString();
    const sanitized: BookmarkCollection[] = [];
    const total = input.length;

    for (const entry of input) {
      if (sanitized.length >= cap) break;
      if (!entry || typeof entry !== 'object') continue;

      const raw = entry as Record<string, unknown>;
      if (typeof raw.id !== 'string' || !isSafeBookmarkId(raw.id)) continue;
      if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue;

      const bookmarkIds = Array.isArray(raw.bookmarkIds)
        ? raw.bookmarkIds.filter(
            (id): id is string => typeof id === 'string' && isSafeBookmarkId(id),
          )
        : [];

      sanitized.push({
        id: raw.id,
        name: stripHtmlTags(raw.name).trim(),
        description:
          typeof raw.description === 'string' ? stripHtmlTags(raw.description) : undefined,
        bookmarkIds,
        color: typeof raw.color === 'string' ? (raw.color as BookmarkColor) : undefined,
        icon: typeof raw.icon === 'string' ? raw.icon : undefined,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
      });
    }

    if (total > cap) {
      this.deps.console.warn(
        `Collection import capped at ${cap}; ignored ${total - cap} entries from ${sourceLabel}`,
      );
    }
    return sanitized;
  }

  private sanitizeSmartCollectionFilters(raw: unknown): SmartCollectionFilters {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const filtersRaw = raw as Record<string, unknown>;
    const filters: SmartCollectionFilters = {};

    if (typeof filtersRaw.searchTerm === 'string') filters.searchTerm = filtersRaw.searchTerm;
    if (typeof filtersRaw.fileFilter === 'string') filters.fileFilter = filtersRaw.fileFilter;
    if (Array.isArray(filtersRaw.tags)) {
      filters.tags = filtersRaw.tags.filter((t): t is string => typeof t === 'string');
    }
    if (typeof filtersRaw.showOnlyUntagged === 'boolean') {
      filters.showOnlyUntagged = filtersRaw.showOnlyUntagged;
    }
    if (typeof filtersRaw.showOnlyPinned === 'boolean') {
      filters.showOnlyPinned = filtersRaw.showOnlyPinned;
    }
    if (typeof filtersRaw.showOnlyRangeBookmarks === 'boolean') {
      filters.showOnlyRangeBookmarks = filtersRaw.showOnlyRangeBookmarks;
    }
    if (typeof filtersRaw.showOnlyScratchpad === 'boolean') {
      filters.showOnlyScratchpad = filtersRaw.showOnlyScratchpad;
    }
    if (
      filtersRaw.dateRange &&
      typeof filtersRaw.dateRange === 'object' &&
      !Array.isArray(filtersRaw.dateRange)
    ) {
      const range = filtersRaw.dateRange as Record<string, unknown>;
      if (typeof range.start === 'string' && typeof range.end === 'string') {
        filters.dateRange = { start: range.start, end: range.end };
      }
    }

    return filters;
  }

  private sanitizeSmartCollections(
    input: unknown,
    cap: number,
    sourceLabel: string,
  ): SmartCollection[] {
    if (!Array.isArray(input)) return [];

    const now = new Date().toISOString();
    const sanitized: SmartCollection[] = [];
    const total = input.length;

    for (const entry of input) {
      if (sanitized.length >= cap) break;
      if (!entry || typeof entry !== 'object') continue;

      const raw = entry as Record<string, unknown>;
      if (typeof raw.id !== 'string' || !isSafeBookmarkId(raw.id)) continue;
      if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue;

      const usageCount =
        typeof raw.usageCount === 'number' && Number.isFinite(raw.usageCount) && raw.usageCount > 0
          ? raw.usageCount
          : 0;

      sanitized.push({
        id: raw.id,
        name: stripHtmlTags(raw.name).trim(),
        description:
          typeof raw.description === 'string' ? stripHtmlTags(raw.description) : undefined,
        filters: this.sanitizeSmartCollectionFilters(raw.filters),
        color: typeof raw.color === 'string' ? (raw.color as BookmarkColor) : undefined,
        icon: typeof raw.icon === 'string' ? raw.icon : undefined,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
        usageCount,
        builtin: raw.builtin === true,
      });
    }

    if (total > cap) {
      this.deps.console.warn(
        `Smart collection import capped at ${cap}; ignored ${total - cap} entries from ${sourceLabel}`,
      );
    }
    return sanitized;
  }

  private ensureBuiltinSmartCollections(): void {
    const builtins: Array<{ id: string; name: string; filters: SmartCollectionFilters }> = [
      {
        id: 'sc-recent',
        name: 'Recent',
        filters: {
          dateRange: { start: '__DYNAMIC_TODAY__', end: '' },
        },
      },
      {
        id: 'sc-this-week',
        name: 'This Week',
        filters: {
          dateRange: { start: '__DYNAMIC_WEEK__', end: '' },
        },
      },
      { id: 'sc-untagged', name: 'Untagged', filters: { showOnlyUntagged: true } },
      { id: 'sc-pinned', name: 'Pinned', filters: { showOnlyPinned: true } },
      { id: 'sc-ranges', name: 'Range Bookmarks', filters: { showOnlyRangeBookmarks: true } },
      { id: 'sc-scratchpad', name: 'Scratchpad', filters: { showOnlyScratchpad: true } },
    ];

    let added = 0;
    for (const builtin of builtins) {
      if (!this.smartCollections.find((sc) => sc.id === builtin.id)) {
        this.smartCollections.push({
          id: builtin.id,
          name: builtin.name,
          filters: builtin.filters,
          createdAt: new Date().toISOString(),
          usageCount: 0,
          builtin: true,
        });
        added++;
      }
    }
    if (added > 0) this.saveSmartCollections();
  }

  private saveCollections(): void {
    try {
      this.deps.preferences.set(this.COLLECTIONS_KEY, JSON.stringify(this.collections));
      this.broadcastCollections();
    } catch (error) {
      this.deps.console.error(`Error saving collections: ${errorMessage(error)}`);
    }
  }

  private saveSmartCollections(): void {
    try {
      this.deps.preferences.set(this.SMART_COLLECTIONS_KEY, JSON.stringify(this.smartCollections));
      this.broadcastSmartCollections();
    } catch (error) {
      this.deps.console.error(`Error saving smart collections: ${errorMessage(error)}`);
    }
  }

  private broadcastCollections(): void {
    if (!this.uiInitialized) return;
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      this.getUITarget(ui).postMessage('COLLECTIONS_UPDATED', this.collections);
    }
  }

  private broadcastSmartCollections(): void {
    if (!this.uiInitialized) return;
    const resolved = this.smartCollections.map((sc) => this.resolveSmartCollectionDates(sc));
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      this.getUITarget(ui).postMessage('SMART_COLLECTIONS_UPDATED', resolved);
    }
  }

  private resolveSmartCollectionDates(sc: SmartCollection): SmartCollection {
    const dateRange = sc.filters.dateRange;
    if (!dateRange) return sc;

    const start = dateRange.start;
    if (start !== '__DYNAMIC_TODAY__' && start !== '__DYNAMIC_WEEK__') return sc;

    const now = Date.now();
    const resolvedStart =
      start === '__DYNAMIC_TODAY__'
        ? new Date(now - 86400000).toISOString()
        : new Date(now - 7 * 86400000).toISOString();

    return {
      ...sc,
      filters: {
        ...sc.filters,
        dateRange: { start: resolvedStart, end: dateRange.end },
      },
    };
  }

  createCollection(name: string, description?: string, color?: BookmarkColor, icon?: string): void {
    const now = new Date().toISOString();
    this.collections.push({
      id: this.generateId(),
      name,
      description,
      bookmarkIds: [],
      color,
      icon,
      createdAt: now,
      updatedAt: now,
    });
    this.saveCollections();
  }

  updateCollection(id: string, data: Partial<Omit<BookmarkCollection, 'id' | 'createdAt'>>): void {
    const collection = this.collections.find((c) => c.id === id);
    if (collection) {
      const { name, description, bookmarkIds, color, icon } = data;
      if (name !== undefined) collection.name = name;
      if (description !== undefined) collection.description = description;
      if (bookmarkIds !== undefined) collection.bookmarkIds = bookmarkIds;
      if (color !== undefined) collection.color = color;
      if (icon !== undefined) collection.icon = icon;
      collection.updatedAt = new Date().toISOString();
      this.saveCollections();
    }
  }

  deleteCollection(id: string): void {
    this.collections = this.collections.filter((c) => c.id !== id);
    this.saveCollections();
  }

  addToCollection(bookmarkIds: string[], collectionId: string): void {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (collection) {
      const existing = new Set(collection.bookmarkIds);
      for (const id of bookmarkIds) {
        existing.add(id);
      }
      collection.bookmarkIds = [...existing];
      collection.updatedAt = new Date().toISOString();
      this.saveCollections();
    }
  }

  removeFromCollection(bookmarkIds: string[], collectionId: string): void {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (collection) {
      const removeSet = new Set(bookmarkIds);
      collection.bookmarkIds = collection.bookmarkIds.filter((id) => !removeSet.has(id));
      collection.updatedAt = new Date().toISOString();
      this.saveCollections();
    }
  }

  createSmartCollection(
    name: string,
    description?: string,
    filters?: SmartCollectionFilters,
    color?: BookmarkColor,
    icon?: string,
  ): void {
    this.smartCollections.push({
      id: this.generateId(),
      name,
      description,
      filters: filters || {},
      color,
      icon,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    });
    this.saveSmartCollections();
  }

  updateSmartCollection(
    id: string,
    data: Partial<Omit<SmartCollection, 'id' | 'createdAt' | 'builtin'>>,
  ): void {
    const collection = this.smartCollections.find((sc) => sc.id === id);
    if (collection && !collection.builtin) {
      const { name, description, filters, color, icon, usageCount } = data;
      if (name !== undefined) collection.name = name;
      if (description !== undefined) collection.description = description;
      if (filters !== undefined) collection.filters = filters;
      if (color !== undefined) collection.color = color;
      if (icon !== undefined) collection.icon = icon;
      if (usageCount !== undefined) collection.usageCount = usageCount;
      this.saveSmartCollections();
    }
  }

  deleteSmartCollection(id: string): void {
    this.smartCollections = this.smartCollections.filter((sc) => sc.id !== id || sc.builtin);
    this.saveSmartCollections();
  }

  // ---------------------------------------------------------------------------
  // Batch operations
  // ---------------------------------------------------------------------------

  batchDelete(ids: string[]): void {
    const idSet = new Set(ids);
    this.bookmarks = this.bookmarks.filter((b) => !idSet.has(b.id));
    for (const collection of this.collections) {
      collection.bookmarkIds = collection.bookmarkIds.filter((id) => !idSet.has(id));
    }
    this.saveBookmarks();
    this.saveCollections();
    this.deps.console.log(`Batch deleted ${ids.length} bookmarks`);
  }

  batchTag(ids: string[], tags: string[], action: 'add' | 'remove'): void {
    const safeTags = tags.map((t) => stripHtmlTags(t));
    for (const id of ids) {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (!bookmark) continue;
      if (action === 'add') {
        bookmark.tags = [...new Set([...bookmark.tags, ...safeTags])];
      } else {
        const removeSet = new Set(safeTags);
        bookmark.tags = bookmark.tags.filter((t) => !removeSet.has(t));
      }
      bookmark.updatedAt = new Date().toISOString();
    }
    this.saveBookmarks();
    this.deps.console.log(`Batch ${action} tags on ${ids.length} bookmarks`);
  }

  batchAssignCollection(ids: string[], collectionId: string, action: 'add' | 'remove'): void {
    if (action === 'add') {
      this.addToCollection(ids, collectionId);
    } else {
      this.removeFromCollection(ids, collectionId);
    }
  }

  batchPin(ids: string[], pinned: boolean): void {
    for (const id of ids) {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (bookmark) {
        bookmark.pinned = pinned;
        bookmark.updatedAt = new Date().toISOString();
      }
    }
    this.saveBookmarks();
    this.deps.console.log(`Batch ${pinned ? 'pinned' : 'unpinned'} ${ids.length} bookmarks`);
  }

  batchColor(ids: string[], color: BookmarkColor): void {
    for (const id of ids) {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (bookmark) {
        bookmark.color = color;
        bookmark.updatedAt = new Date().toISOString();
      }
    }
    this.saveBookmarks();
    this.deps.console.log(`Batch colored ${ids.length} bookmarks`);
  }

  // ---------------------------------------------------------------------------
  // A-B Loop
  // ---------------------------------------------------------------------------

  setABLoop(bookmarkId: string): void {
    const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark?.endTimestamp) {
      this.deps.console.warn('Bookmark has no end timestamp for A-B loop');
      return;
    }
    this.deps.mpv?.set?.('ab-loop-a', bookmark.timestamp);
    this.deps.mpv?.set?.('ab-loop-b', bookmark.endTimestamp);
    this.deps.core.osd?.(
      `Loop: ${formatTime(bookmark.timestamp)} → ${formatTime(bookmark.endTimestamp)}`,
    );
    this.deps.console.log(`A-B loop set: ${bookmark.timestamp} → ${bookmark.endTimestamp}`);
  }

  clearABLoop(): void {
    this.deps.mpv?.set?.('ab-loop-a', 'no');
    this.deps.mpv?.set?.('ab-loop-b', 'no');
    this.deps.core.osd?.('Loop cleared');
    this.deps.console.log('A-B loop cleared');
  }

  // ---------------------------------------------------------------------------
  // Bookmark chaining (next/prev navigation)
  // ---------------------------------------------------------------------------

  getAdjacentBookmark(
    currentId: string,
    direction: 'next' | 'prev',
    scope: 'file' | 'all',
  ): BookmarkData | null {
    const current = this.bookmarks.find((b) => b.id === currentId);
    if (!current) return null;

    let candidates: BookmarkData[];
    if (scope === 'file') {
      candidates = this.bookmarks
        .filter((b) => b.filepath === current.filepath)
        .sort((a, b) => a.timestamp - b.timestamp);
    } else {
      candidates = [...this.bookmarks].sort((a, b) => {
        const pathCmp = a.filepath.localeCompare(b.filepath);
        return pathCmp !== 0 ? pathCmp : a.timestamp - b.timestamp;
      });
    }

    const currentIndex = candidates.findIndex((b) => b.id === currentId);
    if (currentIndex === -1) return null;

    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    return candidates[targetIndex] || null;
  }

  navigateBookmark(currentId: string, direction: 'next' | 'prev', scope: 'file' | 'all'): void {
    const target = this.getAdjacentBookmark(currentId, direction, scope);
    if (target) {
      this.jumpToBookmark(target.id);
      this.deps.core.osd?.(
        `${direction === 'next' ? '\u2192' : '\u2190'} ${target.title} (${formatTime(target.timestamp)})`,
      );
    } else {
      this.deps.core.osd?.('End of bookmarks');
      this.deps.console.log(`No ${direction} bookmark available`);
    }
  }

  // ---------------------------------------------------------------------------
  // Quick bookmark & adjacent navigation from current playback position
  // ---------------------------------------------------------------------------

  private async quickBookmark(): Promise<void> {
    const currentTime = this.deps.core.status.currentTime || 0;
    const scratchpadMode = this.deps.preferences.get('scratchpadMode') !== 'false';

    const bookmarkId = await this.addBookmark(undefined, undefined, undefined, undefined, {
      skipDuplicateCheck: false,
      ...(scratchpadMode ? { scratchpad: true } : {}),
    });

    if (!bookmarkId) {
      // Duplicate detected or other issue — addBookmark already notified the UI
      return;
    }

    this.deps.core.osd?.(`Bookmarked at ${formatTime(currentTime)}`);

    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      this.getUITarget(ui).postMessage('QUICK_BOOKMARK_CREATED', {
        bookmarkId,
        timestamp: currentTime,
      });
    }
  }

  private navigateToAdjacentFromCurrent(direction: 'next' | 'prev'): void {
    const currentPath = this.deps.core.status.path;
    const currentTime = this.deps.core.status.currentTime || 0;

    const currentFileBookmarks = this.bookmarks
      .filter((b) => b.filepath === currentPath)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (currentFileBookmarks.length === 0) {
      this.deps.core.osd?.('No bookmarks in current file');
      return;
    }

    let nearest = currentFileBookmarks[0];
    let minDist = Math.abs(nearest.timestamp - currentTime);
    for (const b of currentFileBookmarks) {
      const dist = Math.abs(b.timestamp - currentTime);
      if (dist < minDist) {
        nearest = b;
        minDist = dist;
      }
    }

    this.navigateBookmark(nearest.id, direction, 'file');
  }

  // ---------------------------------------------------------------------------
  // Playback status broadcast
  // ---------------------------------------------------------------------------

  private broadcastPlaybackStatus(includeChapters = false): void {
    if (!this.uiInitialized) return;
    const duration = this.deps.core.status.duration || 0;
    const position = this.deps.core.status.position || this.deps.core.status.currentTime || 0;
    const status: Record<string, unknown> = { duration, position };
    if (includeChapters) {
      status.chapters = this.cachedChapters;
    }
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      this.getUITarget(ui).postMessage('PLAYBACK_STATUS', status);
    }
  }

  private startPlaybackBroadcast(): void {
    this.stopPlaybackBroadcast();
    this.cachedChapters = this.deps.core.getChapters?.() || [];
    this.broadcastPlaybackStatus(true);
    this.playbackInterval = setInterval(() => this.broadcastPlaybackStatus(false), 5000);
  }

  private stopPlaybackBroadcast(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  /** Clean up event listeners registered by this instance */
  destroy(): void {
    for (const { event, id } of this.eventIds) {
      this.deps.event.off(event, id);
    }
    this.eventIds = [];
    this.stopPlaybackBroadcast();
    this.pendingSeek?.cancel();
  }

  getAllBookmarks(): BookmarkData[] {
    return [...this.bookmarks];
  }

  getBookmarkCount(): number {
    return this.bookmarks.length;
  }
}
