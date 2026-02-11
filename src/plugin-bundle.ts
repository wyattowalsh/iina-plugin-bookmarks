/// IINA Plugin Bookmarks - Self-contained bundle for IINA environment

// Global declarations for IINA environment
declare const iina: any;

// Plugin interfaces (mirrors src/types.ts - kept inline for self-contained bundle)
interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  tags?: string[];
}

interface UIMessage {
  type: string;
  payload?: any;
  sourceUI?: 'sidebar' | 'overlay' | 'window';
}

// Performance utilities class
class PerformanceUtils {
  static debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: any;
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
  }

  static memoize<T extends (...args: any[]) => any>(func: T, maxAge: number = 300000): T {
    const cache = new Map();
    return ((...args: any[]) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < maxAge) {
        return cached.value;
      }
      const result = func.apply(this, args);
      cache.set(key, { value: result, timestamp: Date.now() });
      return result;
    }) as T;
  }

  static measure<T>(name: string, fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static async batchProcess<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    batchSize: number = 10,
    delayMs: number = 0,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map((item, batchIndex) => processor(item, i + batchIndex));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (delayMs > 0 && i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return results;
  }
}

// Bookmark cache class
class BookmarkCache {
  private idToIndexMap: Map<string, number> = new Map();
  private filepathToIndexesMap: Map<string, number[]> = new Map();
  private timestampToIndexesMap: Map<number, number[]> = new Map();

  buildIndexes(bookmarks: BookmarkData[]): void {
    this.idToIndexMap.clear();
    this.filepathToIndexesMap.clear();
    this.timestampToIndexesMap.clear();

    bookmarks.forEach((bookmark, index) => {
      // ID index
      this.idToIndexMap.set(bookmark.id, index);

      // Filepath index
      if (!this.filepathToIndexesMap.has(bookmark.filepath)) {
        this.filepathToIndexesMap.set(bookmark.filepath, []);
      }
      this.filepathToIndexesMap.get(bookmark.filepath)!.push(index);

      // Timestamp index (rounded to nearest second for grouping)
      const roundedTimestamp = Math.round(bookmark.timestamp);
      if (!this.timestampToIndexesMap.has(roundedTimestamp)) {
        this.timestampToIndexesMap.set(roundedTimestamp, []);
      }
      this.timestampToIndexesMap.get(roundedTimestamp)!.push(index);
    });
  }

  findByIdIndex(id: string): number | null {
    return this.idToIndexMap.get(id) ?? null;
  }

  findByFilePathIndex(filepath: string): number[] {
    return this.filepathToIndexesMap.get(filepath) ?? [];
  }

  findByTimestampIndex(timestamp: number, tolerance: number = 0): number[] {
    if (tolerance === 0) {
      return this.timestampToIndexesMap.get(Math.round(timestamp)) ?? [];
    }

    const results: number[] = [];
    const min = Math.round(timestamp - tolerance);
    const max = Math.round(timestamp + tolerance);

    for (let t = min; t <= max; t++) {
      const indexes = this.timestampToIndexesMap.get(t);
      if (indexes) {
        results.push(...indexes);
      }
    }

    return [...new Set(results)]; // Remove duplicates
  }
}

// Metadata detector class
class MetadataDetector {
  private core: any;
  private console: any;
  private options: any;
  private titleCache: Map<string, { title: string; timestamp: number }> = new Map();
  private changeCallbacks: ((metadata: any) => void)[] = [];

  constructor(core: any, console: any, options: any = {}) {
    this.core = core;
    this.console = console;
    this.options = {
      retryAttempts: 3,
      retryDelay: 100,
      cacheTimeout: 30000,
      enableLogging: true,
      ...options,
    };
  }

  async getCurrentTitle(): Promise<string> {
    const currentPath = this.core.status.path;
    if (!currentPath) {
      throw new Error('No media file is currently loaded');
    }

    // Check cache first
    const cached = this.titleCache.get(currentPath);
    if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
      return cached.title;
    }

    let detectedTitle = this.extractTitleFromFilename(currentPath);

    // Try to get metadata from IINA core
    try {
      const metadata = this.core.status.metadata;
      if (metadata && metadata.title) {
        detectedTitle = this.cleanMetadataTitle(metadata.title);
      }
    } catch (error) {
      this.console.warn(`Failed to get metadata: ${error.message}`);
    }

    // Cache the result
    this.titleCache.set(currentPath, {
      title: detectedTitle,
      timestamp: Date.now(),
    });

    return detectedTitle;
  }

  private extractTitleFromFilename(filepath: string): string {
    const filename = filepath.split('/').pop() || filepath;
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    return this.cleanTitle(nameWithoutExt);
  }

  private cleanTitle(title: string): string {
    // Remove common quality indicators and separators
    const cleaned = title
      .replace(/\b(1080p?|720p?|480p?|4k|2160p)\b/gi, '')
      .replace(/\b(x264|x265|h264|h265|hevc|avc)\b/gi, '')
      .replace(/\b(bluray|bdrip|dvdrip|webrip|hdtv)\b/gi, '')
      .replace(/\b(ac3|aac|mp3|dts|flac)\b/gi, '')
      .replace(/[[\](){}]/g, ' ')
      .replace(/[._-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter of each word
    return cleaned.replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private cleanMetadataTitle(title: string): string {
    return this.cleanTitle(title);
  }

  async refreshMetadata(): Promise<void> {
    const currentPath = this.core.status.path;
    if (currentPath) {
      this.titleCache.delete(currentPath); // Clear cache to force refresh
      const newTitle = await this.getCurrentTitle();

      // Notify change callbacks
      this.changeCallbacks.forEach((callback) => {
        try {
          callback({
            title: newTitle,
            filepath: currentPath,
          });
        } catch (error) {
          this.console.error(`Error in metadata change callback: ${error.message}`);
        }
      });
    }
  }

  onMediaChange(callback: (metadata: any) => void): void {
    this.changeCallbacks.push(callback);
  }
}

// Main BookmarkManager class
class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private readonly STORAGE_KEY = 'bookmarks';
  private readonly SORT_PREFERENCES_KEY = 'sortPreferences';
  private deps: any;
  private cache: BookmarkCache;
  private debouncedSave: () => void;
  private debouncedRefreshUIs: (specificUI?: string) => void;
  private memoizedGetBookmarks: (filePath?: string) => BookmarkData[];
  private metadataDetector: MetadataDetector;

  constructor(dependencies?: any) {
    // Set up dependencies with fallbacks for development
    this.deps = dependencies || {
      console: { log: () => {}, error: () => {}, warn: () => {} },
      preferences: { get: () => null, set: () => {} },
      core: { status: {} },
      event: { on: () => {} },
      menu: { addItem: () => {}, item: () => ({}) },
      utils: { chooseFile: () => '', prompt: () => '', ask: () => false },
      file: { write: () => {}, read: () => '', exists: () => false },
      sidebar: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {} },
      overlay: {
        loadFile: () => {},
        postMessage: () => {},
        onMessage: () => {},
        setClickable: () => {},
        show: () => {},
        hide: () => {},
        isVisible: () => false,
      },
      standaloneWindow: {
        loadFile: () => {},
        postMessage: () => {},
        onMessage: () => {},
        show: () => {},
      },
    };

    // Initialize components
    this.cache = new BookmarkCache();
    this.debouncedSave = PerformanceUtils.debounce(() => this.saveBookmarks(), 500);
    this.debouncedRefreshUIs = PerformanceUtils.debounce(
      (specificUI?: string) => this.refreshUIs(specificUI),
      200,
    );
    this.memoizedGetBookmarks = PerformanceUtils.memoize(
      (filePath?: string) => this.getBookmarksInternal(filePath),
      50,
    );

    this.metadataDetector = new MetadataDetector(this.deps.core, this.deps.console, {
      retryAttempts: 3,
      retryDelay: 100,
      cacheTimeout: 30000,
      enableLogging: true,
    });

    // Load initial data
    this.loadBookmarks();
    this.loadSortPreferences();

    // Setup IINA integration if available
    if (dependencies) {
      this.setupEventListeners();
      this.setupWebUI();
      this.setupUIMessageListeners();
      this.setupMetadataChangeListener();
      this.deps.console.log(
        'IINA Bookmarks Plugin with enhanced metadata detection initialized. Message passing enabled.',
      );
    }
  }

  private setupWebUI(): void {
    try {
      this.deps.sidebar.loadFile('ui/sidebar/index.html');
      this.deps.overlay.loadFile('ui/overlay/index.html');
      this.deps.overlay.setClickable(true);
      this.deps.overlay.hide();
      this.deps.standaloneWindow.loadFile('ui/window/index.html');
      this.deps.console.log('Web UIs loaded successfully.');
    } catch (e: any) {
      this.deps.console.error(`Error loading Web UIs: ${e.message}`);
    }
  }

  private setupUIMessageListeners(): void {
    const createHandler = (uiSource: string) => {
      return (messageContent: any) => {
        let message: UIMessage;

        if (typeof messageContent === 'string') {
          try {
            message = JSON.parse(messageContent);
          } catch (e) {
            this.deps.console.error(
              `[${uiSource}] Error parsing JSON message: ${messageContent} - Error: ${e}`,
            );
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

        this.deps.console.log(`[${uiSource}] Received message: ${JSON.stringify(message)}`);
        this.handleUIMessage(message, uiSource);
      };
    };

    this.deps.sidebar.onMessage(createHandler('sidebar'));
    this.deps.overlay.onMessage(createHandler('overlay'));
    this.deps.standaloneWindow.onMessage(createHandler('window'));
    this.deps.console.log('UI Message Listeners are set up.');
  }

  private handleUIMessage(message: UIMessage, uiSource: string): void {
    switch (message.type) {
      case 'REQUEST_FILE_PATH': {
        const currentPath = this.deps.core.status.path;
        const responseTarget = this.getUITarget(uiSource);
        responseTarget.postMessage(
          JSON.stringify({
            type: 'CURRENT_FILE_PATH',
            data: currentPath,
          }),
        );
        break;
      }

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
        ).catch((error) =>
          this.deps.console.error(
            `Failed to add bookmark: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
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

      case 'UI_READY': {
        const targetUI = this.getUITarget(uiSource);
        const bookmarksForUI = this.getBookmarks(this.deps.core.status.path || undefined);
        targetUI.postMessage(
          JSON.stringify({
            type: 'BOOKMARKS_UPDATED',
            data: bookmarksForUI,
          }),
        );
        this.deps.console.log(
          `Sent initial bookmarks to ${uiSource} for path: ${this.deps.core.status.path}`,
        );
        break;
      }

      default:
        this.deps.console.warn(`[${uiSource}] Unknown message type: ${message.type}`);
    }
  }

  private getUITarget(uiSource: string): any {
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

  private setupMetadataChangeListener(): void {
    this.metadataDetector.onMediaChange((metadata) => {
      this.deps.console.log(`Media changed: ${metadata.title} (${metadata.filepath})`);
      this.refreshUIs();
    });
  }

  private setupEventListeners(): void {
    this.deps.event.on('file-loaded', () => {
      this.deps.console.log('File loaded event triggered.');
      this.metadataDetector
        .refreshMetadata()
        .then(() => this.refreshUIs())
        .catch((error) =>
          this.deps.console.error(
            `Failed to refresh metadata on file load: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    });

    // Add menu items
    this.deps.menu.addItem(
      this.deps.menu.item('Add Bookmark at Current Time', () => {
        this.addBookmark().catch((error) =>
          this.deps.console.error(
            `Failed to add bookmark from menu: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
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
          this.refreshUIs('overlay');
          this.deps.overlay.show();
        }
      }),
    );
  }

  private loadBookmarks(): void {
    try {
      const { result: stored, duration } = PerformanceUtils.measure('loadBookmarks', () =>
        this.deps.preferences.get(this.STORAGE_KEY),
      );

      if (stored) {
        const parsedBookmarks = JSON.parse(stored);
        this.bookmarks = parsedBookmarks.map((b: any) => ({
          ...b,
          createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
        }));
        this.cache.buildIndexes(this.bookmarks);
      }
      this.deps.console.log(
        `Bookmarks loaded: ${this.bookmarks.length} (${duration.toFixed(2)}ms)`,
      );
    } catch (error: any) {
      this.deps.console.error(
        `Error loading bookmarks: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.bookmarks = [];
    }
  }

  private saveBookmarks(): void {
    try {
      this.deps.preferences.set(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
      this.deps.console.log('Bookmarks saved.');
      this.cache.buildIndexes(this.bookmarks);
      this.memoizedGetBookmarks = PerformanceUtils.memoize(
        (filePath?: string) => this.getBookmarksInternal(filePath),
        50,
      );
      this.debouncedRefreshUIs();
    } catch (error: any) {
      this.deps.console.error(
        `Error saving bookmarks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private refreshUIs(specificUI?: string): void {
    const currentPath = this.deps.core.status.path;
    const bookmarksToSend = this.getBookmarks(currentPath || undefined);
    const message = { type: 'BOOKMARKS_UPDATED', data: bookmarksToSend };
    const messageString = JSON.stringify(message);

    this.deps.console.log(
      `Refreshing UIs. Specific: ${specificUI || 'all'}. Path: ${currentPath}. Count: ${bookmarksToSend.length}`,
    );

    try {
      if (!specificUI || specificUI === 'sidebar') this.deps.sidebar.postMessage(messageString);
      if (!specificUI || specificUI === 'overlay') this.deps.overlay.postMessage(messageString);
      if (!specificUI || specificUI === 'window')
        this.deps.standaloneWindow.postMessage(messageString);
    } catch (e: any) {
      this.deps.console.warn(
        `Could not refresh one or more UIs. They might not be loaded yet. ${e.message}`,
      );
    }
  }

  private loadSortPreferences(): void {
    try {
      const stored = this.deps.preferences.get(this.SORT_PREFERENCES_KEY);
      if (stored) {
        this.deps.console.log(`Sort preferences loaded: ${stored}`);
      }
    } catch (error: any) {
      this.deps.console.error(`Error loading sort preferences: ${error.message}`);
    }
  }

  async addBookmark(
    title?: string,
    timestamp?: number,
    description?: string,
    tags?: string[],
  ): Promise<void> {
    try {
      // Enforce maximum bookmarks limit
      const maxBookmarks = this.deps.preferences.get('maxBookmarks') || 1000;
      const limit =
        typeof maxBookmarks === 'number' ? maxBookmarks : parseInt(maxBookmarks, 10) || 1000;
      if (this.bookmarks.length >= limit) {
        this.deps.console.warn(`Maximum bookmark limit (${limit}) reached`);
        return;
      }

      const currentPath = this.deps.core.status.path || '/test/video.mp4';
      const currentTime =
        timestamp !== undefined ? timestamp : this.deps.core.status.currentTime || 0;

      const filename = currentPath.split('/').pop() || currentPath;
      const rawBaseTitle = filename.replace(/\.[^/.]+$/, '') || 'Unknown Media';

      const id = this.generateUniqueId();
      const initialBookmark: BookmarkData = {
        id,
        title: title || `${rawBaseTitle} - ${this.formatTime(currentTime)}`,
        timestamp: currentTime,
        filepath: currentPath,
        description: description || `Bookmark at ${this.formatTime(currentTime)}`,
        createdAt: new Date().toISOString(),
        tags: tags || [],
      };

      this.bookmarks.push(initialBookmark);
      this.debouncedSave();
      this.deps.console.log(`Bookmark added: ${initialBookmark.title}`);

      // Try to enhance with metadata detection
      if (!title) {
        try {
          const detected = await this.metadataDetector.getCurrentTitle();
          if (detected && detected !== rawBaseTitle) {
            const idx = this.bookmarks.findIndex((b) => b.id === id);
            if (idx !== -1) {
              this.bookmarks[idx].title = `${detected} - ${this.formatTime(currentTime)}`;
              this.debouncedSave();
              this.deps.console.log(`Bookmark metadata enriched: ${this.bookmarks[idx].title}`);
            }
          }
        } catch (e: any) {
          this.deps.console.warn(`Metadata detection failed: ${e.message}`);
        }
      }
    } catch (error: any) {
      this.deps.console.error(`Error adding bookmark: ${error.message}`);
      throw error;
    }
  }

  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  removeBookmark(id: string): void {
    const index = this.cache.findByIdIndex(id);
    if (index !== null && this.bookmarks[index]) {
      this.bookmarks.splice(index, 1);
    } else {
      this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    }
    this.debouncedSave();
    this.deps.console.log(`Bookmark removed: ${id}`);
  }

  updateBookmark(id: string, data: Partial<BookmarkData>): void {
    let index = this.cache.findByIdIndex(id);
    if (index === null) {
      index = this.bookmarks.findIndex((b) => b.id === id);
    }
    if (index !== -1 && this.bookmarks[index]) {
      this.bookmarks[index] = { ...this.bookmarks[index], ...data };
      this.debouncedSave();
      this.deps.console.log(`Bookmark updated: ${id}`);
    }
  }

  jumpToBookmark(id: string): void {
    const bookmark = this.bookmarks.find((b) => b.id === id);
    if (!bookmark) {
      this.deps.console.error(`Bookmark not found: ${id}`);
      return;
    }

    this.deps.console.log(
      `Jumping to bookmark: ${bookmark.title} at ${this.formatTime(bookmark.timestamp)} in ${bookmark.filepath}`,
    );

    // Use seekTo() for absolute seek to specific timestamp (not seek() which is relative)
    try {
      if (this.deps.core.seekTo) {
        this.deps.core.seekTo(bookmark.timestamp);
      } else if (this.deps.core.seek) {
        this.deps.console.warn('seekTo() not available, falling back to seek()');
        this.deps.core.seek(bookmark.timestamp);
      }
    } catch (e: any) {
      this.deps.console.warn(`Could not seek to bookmark: ${e.message}`);
    }
  }

  private getBookmarksInternal(filePath?: string): BookmarkData[] {
    if (filePath) {
      const cachedIndexes = this.cache.findByFilePathIndex(filePath);
      if (cachedIndexes.length > 0) {
        return cachedIndexes.map((index) => this.bookmarks[index]).filter(Boolean);
      }
      return this.bookmarks.filter((bookmark) => bookmark.filepath === filePath);
    }
    return [...this.bookmarks];
  }

  getBookmarks(filePath?: string): BookmarkData[] {
    return this.memoizedGetBookmarks(filePath);
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  }
}

// Main plugin entry point - only runs in IINA environment
(function () {
  if (typeof iina !== 'undefined') {
    const {
      standaloneWindow,
      overlay,
      sidebar,
      event,
      console,
      menu,
      core,
      preferences,
      utils,
      file,
    } = iina;

    // Create dependencies object for BookmarkManager
    const iinaRuntimeDeps = {
      console,
      preferences,
      core,
      event,
      menu,
      utils,
      file,
      sidebar,
      overlay,
      standaloneWindow,
    };

    // Initialize the bookmark manager with IINA runtime dependencies
    new BookmarkManager(iinaRuntimeDeps);

    console.log(
      'IINA Bookmarks Plugin with Multi-Criteria Sorting and Comprehensive Filtering initialized successfully!',
    );
  } else {
    // Build-time or non-IINA environment
    console.log('IINA Bookmarks Plugin: Not running in IINA environment');
  }
})();
