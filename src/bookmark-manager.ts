import { MetadataDetector, MediaMetadata, IINACore } from './metadata-detector';
import { BookmarkCache } from './bookmark-cache';
import { PerformanceUtils } from './performance-utils';

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

interface ExportOptions {
  format: 'json' | 'csv';
  includeMetadata: boolean;
  compressOutput?: boolean;
  filePath?: string;
  filter?: {
    tags?: string[];
    dateRange?: { start: string; end: string };
    mediaType?: string;
  };
}

interface CSVOptions extends ExportOptions {
  selectedFields: string[];
  delimiter: ',' | ';' | '\t';
  includeHeaders: boolean;
}

interface ExportResult {
  success: boolean;
  filePath?: string;
  recordCount: number;
  error?: string;
}

interface ImportOptions {
  duplicateHandling: 'skip' | 'replace' | 'merge';
  validateData: boolean;
  preserveIds: boolean;
}

interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: string[];
  duplicates?: number;
}

interface IINADependencies {
  console: {
    log: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
  };
  preferences: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
  };
  core: {
    status: {
      path?: string;
      currentTime?: number;
      title?: string;
      duration?: number;
    };
  };
  event: {
    on: (event: string, callback: () => void) => void;
  };
  menu: {
    addItem: (item: any) => void;
    item: (label: string, callback: () => void) => any;
  };
  utils: {
    chooseFile: (title: string, options?: { chooseDir?: boolean; allowedFileTypes?: string[] }) => string;
    prompt: (title: string) => string;
    ask: (title: string) => boolean;
  };
  file: {
    write: (path: string, content: string) => void;
    read: (path: string) => string;
    exists: (path: string) => boolean;
  };
  sidebar: {
    loadFile: (path: string) => void;
    postMessage: (message: string) => void;
    onMessage: (callback: (data: any) => void) => void;
  };
  overlay: {
    loadFile: (path: string) => void;
    postMessage: (message: string) => void;
    onMessage: (callback: (data: any) => void) => void;
    setClickable: (clickable: boolean) => void;
    show: () => void;
    hide: () => void;
    isVisible: () => boolean;
  };
  standaloneWindow: {
    loadFile: (path: string) => void;
    postMessage: (message: string) => void;
    onMessage: (callback: (data: any) => void) => void;
    show: () => void;
  };
}

export class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private readonly STORAGE_KEY = "bookmarks";
  private readonly SORT_PREFERENCES_KEY = "sortPreferences";
  private deps: IINADependencies;
  private metadataDetector: MetadataDetector;
  private cache: BookmarkCache;

  // Performance optimizations
  private debouncedSave: (...args: any[]) => void;
  private debouncedRefreshUIs: (...args: any[]) => void;
  private memoizedGetBookmarks: (filePath?: string) => BookmarkData[];

  constructor(dependencies?: IINADependencies) {
    // Default to empty implementations for testing
    this.deps = dependencies || {
      console: { log: () => {}, error: () => {}, warn: () => {} },
      preferences: { get: () => null, set: () => {} },
      core: { status: {} },
      event: { on: () => {} },
      menu: { addItem: () => {}, item: () => ({}) },
      utils: { chooseFile: () => '', prompt: () => '', ask: () => false },
      file: { write: () => {}, read: () => '', exists: () => false },
      sidebar: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {} },
      overlay: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {}, setClickable: () => {}, show: () => {}, hide: () => {}, isVisible: () => false },
      standaloneWindow: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {}, show: () => {} }
    };

    // Initialize cache
    this.cache = new BookmarkCache();

    // Initialize performance-optimized methods
    this.debouncedSave = PerformanceUtils.debounce(() => this.saveBookmarks(), 500);
    this.debouncedRefreshUIs = PerformanceUtils.debounce((specificUI?: 'sidebar' | 'overlay' | 'window') => this.refreshUIs(specificUI), 200);
    this.memoizedGetBookmarks = PerformanceUtils.memoize((filePath?: string) => this.getBookmarksInternal(filePath), 50);

    // Initialize metadata detector
    this.metadataDetector = new MetadataDetector(
      this.deps.core as IINACore,
      this.deps.console,
      {
        retryAttempts: 3,
        retryDelay: 100,
        cacheTimeout: 30000,
        enableLogging: true
      }
    );

    this.loadBookmarks();
    this.loadSortPreferences();
    
    if (dependencies) {
      this.setupEventListeners();
      this.setupWebUI();
      this.setupUIMessageListeners();
      this.setupMetadataChangeListener();
      this.deps.console.log("IINA Bookmarks Plugin with enhanced metadata detection initialized. Message passing enabled.");
    }
  }

  private setupWebUI(): void {
    try {
      this.deps.sidebar.loadFile("ui/sidebar/index.html");
      this.deps.overlay.loadFile("ui/overlay/index.html");
      this.deps.overlay.setClickable(true);
      this.deps.overlay.hide();
      this.deps.standaloneWindow.loadFile("ui/window/index.html");
      this.deps.console.log("Web UIs loaded successfully.");
    } catch (e: any) {
      this.deps.console.error(`Error loading Web UIs: ${e.message}`);
    }
  }

  private setupUIMessageListeners(): void {
    const createHandler = (uiSource: 'sidebar' | 'overlay' | 'window') => {
      return (messageContent: string | object) => {
        let message: UIMessage;
        if (typeof messageContent === 'string') {
          try {
            message = JSON.parse(messageContent) as UIMessage;
          } catch (e) {
            this.deps.console.error(`[${uiSource}] Error parsing JSON message: ${messageContent} - Error: ${e}`);
            return;
          }
        } else if (typeof messageContent === 'object' && messageContent !== null && 'type' in messageContent) {
          message = messageContent as UIMessage;
        } else {
          this.deps.console.warn(`[${uiSource}] Received non-standard message: ${JSON.stringify(messageContent)}`);
          return;
        }
        
        this.deps.console.log(`[${uiSource}] Received message: ${JSON.stringify(message)}`);

        switch (message.type) {
          case "REQUEST_FILE_PATH":
            const currentPath = this.deps.core.status.path;
            const responseTarget = uiSource === 'overlay' ? this.deps.overlay : (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
            responseTarget.postMessage(JSON.stringify({ type: "CURRENT_FILE_PATH", data: currentPath }));
            break;
          case "JUMP_TO_BOOKMARK":
            if (message.payload?.id) {
              this.jumpToBookmark(message.payload.id);
            }
            break;
          case "HIDE_OVERLAY":
            this.deps.overlay.hide();
            break;
          case "ADD_BOOKMARK":
            this.addBookmark(message.payload?.title, message.payload?.timestamp, message.payload?.description, message.payload?.tags)
              .catch(error => this.deps.console.error(`Failed to add bookmark: ${error instanceof Error ? error.message : String(error)}`));
            break;
          case "DELETE_BOOKMARK":
            if (message.payload?.id) {
              this.removeBookmark(message.payload.id);
            }
            break;
          case "UPDATE_BOOKMARK":
            if (message.payload?.id && message.payload?.data) {
              this.updateBookmark(message.payload.id, message.payload.data);
            }
            break;
          case "UI_READY":
            const targetUI = uiSource === 'overlay' ? this.deps.overlay : (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
            const bookmarksForUI = this.getBookmarks(this.deps.core.status.path || undefined);
            targetUI.postMessage(JSON.stringify({ type: "BOOKMARKS_UPDATED", data: bookmarksForUI }));
            this.deps.console.log(`Sent initial bookmarks to ${uiSource} for path: ${this.deps.core.status.path}`);
            break;
          case "SAVE_SORT_PREFERENCES":
            if (message.payload?.preferences) {
              this.saveSortPreferences(message.payload.preferences);
            }
            break;
          case "REQUEST_BOOKMARK_DEFAULTS":
            this.getBookmarkDefaults()
              .then(defaults => {
                const responseTarget = uiSource === 'overlay' ? this.deps.overlay : (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
                responseTarget.postMessage(JSON.stringify({ type: "BOOKMARK_DEFAULTS", data: defaults }));
              })
              .catch(error => this.deps.console.error(`Failed to get bookmark defaults: ${error instanceof Error ? error.message : String(error)}`));
            break;
          case "EXPORT_BOOKMARKS":
            this.handleExportBookmarks(message.payload, uiSource);
            break;
          case "IMPORT_BOOKMARKS":
            this.handleImportBookmarks(message.payload.bookmarks, message.payload.options, uiSource);
            break;
          case "REQUEST_IMPORT_FILE":
            this.handleImportFromFile(uiSource);
            break;
          default:
            this.deps.console.warn(`[${uiSource}] Unknown message type: ${message.type}`);
        }
      };
    };

    this.deps.sidebar.onMessage(createHandler('sidebar'));
    this.deps.overlay.onMessage(createHandler('overlay'));
    this.deps.standaloneWindow.onMessage(createHandler('window'));
    this.deps.console.log("UI Message Listeners are set up.");
  }

  private setupMetadataChangeListener(): void {
    this.metadataDetector.onMediaChange((metadata: MediaMetadata) => {
      this.deps.console.log(`Media changed: ${metadata.title} (${metadata.filepath})`);
      // Refresh UIs when media changes
      this.refreshUIs();
    });
  }

  private loadBookmarks(): void {
    try {
      const { result: stored, duration } = PerformanceUtils.measure('loadBookmarks', () => 
        this.deps.preferences.get(this.STORAGE_KEY) as string
      );
      
      if (stored) {
        const parsedBookmarks = JSON.parse(stored) as BookmarkData[];
        this.bookmarks = parsedBookmarks.map(b => ({
            ...b,
            createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString()
        }));
        
        // Build cache indexes for fast lookups
        this.cache.buildIndexes(this.bookmarks);
      }
      
      this.deps.console.log(`Bookmarks loaded: ${this.bookmarks.length} (${duration.toFixed(2)}ms)`);
    } catch (error: any) {
      this.deps.console.error(`Error loading bookmarks: ${error instanceof Error ? error.message : String(error)}`);
      this.bookmarks = [];
    }
  }

  private saveBookmarks(): void {
    try {
      this.deps.preferences.set(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
      this.deps.console.log("Bookmarks saved.");
      
      // Rebuild cache indexes after saving
      this.cache.buildIndexes(this.bookmarks);
      
      // Clear memoized cache to ensure fresh data
      this.memoizedGetBookmarks = PerformanceUtils.memoize((filePath?: string) => this.getBookmarksInternal(filePath), 50);
      
      this.debouncedRefreshUIs();
    } catch (error: any) {
      this.deps.console.error(`Error saving bookmarks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private refreshUIs(specificUI?: 'sidebar' | 'overlay' | 'window'): void {
    const currentPath = this.deps.core.status.path;
    const bookmarksToSend = this.getBookmarks(currentPath || undefined);
    const message = { type: "BOOKMARKS_UPDATED", data: bookmarksToSend };
    const messageString = JSON.stringify(message);

    this.deps.console.log(`Refreshing UIs. Specific: ${specificUI || 'all'}. Path: ${currentPath}. Count: ${bookmarksToSend.length}`);

    try {
      if (!specificUI || specificUI === 'sidebar') this.deps.sidebar.postMessage(messageString);
      if (!specificUI || specificUI === 'overlay') this.deps.overlay.postMessage(messageString);
      if (!specificUI || specificUI === 'window') this.deps.standaloneWindow.postMessage(messageString);
    } catch (e: any) {
        this.deps.console.warn(`Could not refresh one or more UIs. They might not be loaded yet. ${e.message}`);
    }
  }
  
  private setupEventListeners(): void {
    this.deps.event.on("file-loaded", () => {
      this.deps.console.log("File loaded event triggered.");
      // Refresh metadata cache when file changes
      this.metadataDetector.refreshMetadata()
        .then(() => this.refreshUIs())
        .catch(error => this.deps.console.error(`Failed to refresh metadata on file load: ${error instanceof Error ? error.message : String(error)}`));
    });

    this.deps.menu.addItem(
      this.deps.menu.item("Add Bookmark at Current Time", () => {
        this.addBookmark()
          .catch(error => this.deps.console.error(`Failed to add bookmark from menu: ${error instanceof Error ? error.message : String(error)}`));
      })
    );
    this.deps.menu.addItem(
      this.deps.menu.item("Manage Bookmarks", () => {
        this.deps.standaloneWindow.show();
      })
    );
    this.deps.menu.addItem(
      this.deps.menu.item("Toggle Bookmarks Overlay", () => {
        if (this.deps.overlay.isVisible()) {
          this.deps.overlay.hide();
        } else {
          this.refreshUIs('overlay');
          this.deps.overlay.show();
        }
      })
    );
    this.deps.menu.addItem(
      this.deps.menu.item("Export Bookmarks", () => {
        this.handleExportFromMenu()
          .catch(error => this.deps.console.error(`Failed to export bookmarks from menu: ${error instanceof Error ? error.message : String(error)}`));
      })
    );
    this.deps.menu.addItem(
      this.deps.menu.item("Import Bookmarks", () => {
        this.handleImportFromMenu()
          .catch(error => this.deps.console.error(`Failed to import bookmarks from menu: ${error instanceof Error ? error.message : String(error)}`));
      })
    );
  }

  /**
   * Get default title, description, and tags for bookmark dialog pre-population
   */
  public async getBookmarkDefaults(): Promise<{ title: string; description: string; tags: string[]; timestamp: number; filepath: string }> {
    try {
      const currentPath = this.deps.core.status.path || '/test/video.mp4'; // Default for testing
      const currentTime = this.deps.core.status.currentTime || 0;
      
      // Use enhanced metadata detection with built-in fallback logic
      let detectedTitle: string;
      try {
        const metadataTitle = await this.metadataDetector.getCurrentTitle();
        // MetadataDetector.getCurrentTitle() already handles fallback to filename
        detectedTitle = metadataTitle || 'Unknown Media';
      } catch (error: any) {
        this.deps.console.warn(`Metadata detection failed: ${error.message}`);
        // Final fallback - extract filename without extension
        const filename = currentPath.split('/').pop() || currentPath;
        detectedTitle = filename.replace(/\.[^/.]+$/, "") || 'Unknown Media';
      }
      
      const metadata = this.generateBookmarkMetadata(
        currentPath, 
        detectedTitle, 
        currentTime
      );

      return {
        title: metadata.title,
        description: metadata.description || '',
        tags: metadata.tags || [],
        timestamp: currentTime,
        filepath: currentPath
      };
    } catch (error: any) {
      this.deps.console.error(`Error getting bookmark defaults: ${error.message}`);
      throw error;
    }
  }

  public async addBookmark(title?: string, timestamp?: number, description?: string, tags?: string[]): Promise<void> {
    try {
      const currentPath = this.deps.core.status.path || '/test/video.mp4'; // Default for testing
      const currentTime = timestamp !== undefined ? timestamp : (this.deps.core.status.currentTime || 0);

      // Immediate fallback title from filename (no extension), retain dots to match expectations
      const filename = currentPath.split('/').pop() || currentPath;
      const rawBaseTitle = (filename.replace(/\.[^/.]+$/, "") || 'Unknown Media');

      // Build metadata synchronously with fallback title so bookmark is available immediately
      const initialMetadata = this.generateBookmarkMetadata(
        currentPath,
        rawBaseTitle,
        currentTime,
        title,
        description,
        tags
      );

      const id = this.generateUniqueId();
      const initialBookmark: BookmarkData = {
        id,
        title: initialMetadata.title,
        timestamp: currentTime,
        filepath: currentPath,
        description: initialMetadata.description,
        createdAt: new Date().toISOString(),
        tags: initialMetadata.tags
      };

      // Push immediately so tests that don't await still see the bookmark
      this.bookmarks.push(initialBookmark);
      this.saveBookmarks();
      this.deps.console.log(`Bookmark added (initial metadata): ${initialBookmark.title}`);

      // Asynchronously attempt to enrich title/metadata using detector; keep user overrides intact
      try {
        const detected = await this.metadataDetector.getCurrentTitle();
        if (!title && detected && detected !== rawBaseTitle) {
          const enriched = this.generateBookmarkMetadata(
            currentPath,
            detected,
            currentTime,
            undefined,
            description,
            tags
          );
          // Update the bookmark in-place
          const idx = this.bookmarks.findIndex(b => b.id === id);
          if (idx !== -1) {
            this.bookmarks[idx] = {
              ...this.bookmarks[idx],
              title: enriched.title,
              description: enriched.description,
              tags: enriched.tags
            };
            this.saveBookmarks();
            this.deps.console.log(`Bookmark metadata enriched: ${this.bookmarks[idx].title}`);
          }
        }
      } catch (e: any) {
        this.deps.console.warn(`Metadata detection failed: ${e.message}`);
      }
    } catch (error: any) {
      this.deps.console.error(`Error adding bookmark: ${error.message}`);
      throw error;
    }
  }

  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateBookmarkMetadata(filepath: string, mediaTitle: string, timestamp: number, userTitle?: string, userDescription?: string, userTags?: string[]) {
    const extension = filepath.split('.').pop()?.toLowerCase() || '';
    const mediaType = this.getMediaType(extension);
    
    // Determine final tags based on user input
    let finalTags: string[] | undefined;
    if (userTags !== undefined && userTags.length > 0) {
      // If user provided non-empty tags, use them exclusively (complete override)
      finalTags = userTags;
    } else {
      // If no user tags provided, undefined, or empty array, use auto-generated tags
      const autoTags = this.generateAutoTags(filepath, extension, mediaTitle, timestamp);
      finalTags = autoTags.length > 0 ? autoTags : undefined;
    }
    
    return {
      title: userTitle || `${mediaTitle} - ${this.formatTime(timestamp)}`,
      description: userDescription || `Bookmark at ${this.formatTime(timestamp)} in ${mediaType}`,
      tags: finalTags
    };
  }

  private getMediaType(extension: string): string {
    const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'm4v'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'];
    
    if (videoExtensions.includes(extension)) return 'video';
    if (audioExtensions.includes(extension)) return 'audio';
    return 'media';
  }

  private generateAutoTags(filepath: string, extension: string, mediaTitle: string, timestamp: number): string[] {
    const tags: string[] = [];
    
    // Media type tag
    const mediaType = this.getMediaType(extension);
    tags.push(mediaType);
    
    // Time-based tags
    const minutes = Math.floor(timestamp / 60);
    if (minutes < 5) tags.push('beginning');
    else if (minutes < 60) tags.push('early');
    else if (minutes >= 120) tags.push('late');
    
    // File location tags
    const pathParts = filepath.toLowerCase().split('/');
    const commonFolders = ['movies', 'tv', 'shows', 'series', 'music', 'videos', 'downloads'];
    pathParts.forEach(part => {
      if (commonFolders.includes(part)) {
        tags.push(part.replace('movies', 'movie').replace('shows', 'tv-show'));
      }
    });
    
    // Title-based tags
    const titleLower = mediaTitle.toLowerCase();
    const commonPatterns = [
      { pattern: /season\s*(\d+)/i, tag: 'tv-series' },
      { pattern: /s(\d+)e(\d+)/i, tag: 'tv-episode' },
      { pattern: /episode\s*(\d+)/i, tag: 'episode' },
      { pattern: /(19|20)\d{2}/i, tag: 'dated-content' },
      { pattern: /trailer/i, tag: 'trailer' },
      { pattern: /interview/i, tag: 'interview' },
      { pattern: /behind.the.scenes|behind.scenes|bts/i, tag: 'behind-scenes' },
      { pattern: /documentary|docu/i, tag: 'documentary' },
      { pattern: /concert|live/i, tag: 'live-performance' }
    ];
    
    commonPatterns.forEach(({ pattern, tag }) => {
      if (pattern.test(titleLower)) tags.push(tag);
    });
    
    // Quality/format tags
    const qualityPatterns = [
      { pattern: /\b4k\b|2160p/i, tag: '4k' },
      { pattern: /\b1080p?\b/i, tag: 'hd' },
      { pattern: /\b720p?\b/i, tag: 'hd' },
      { pattern: /\bhdr\b/i, tag: 'hdr' }
    ];
    
    qualityPatterns.forEach(({ pattern, tag }) => {
      if (pattern.test(filepath) || pattern.test(mediaTitle)) tags.push(tag);
    });
    
    return tags.filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
  }

  public removeBookmark(id: string): void {
    // Use cache index for faster lookup
    const index = this.cache.findByIdIndex(id);
    if (index !== null && this.bookmarks[index]) {
      this.bookmarks.splice(index, 1);
    } else {
      // Fallback to linear search
      this.bookmarks = this.bookmarks.filter(b => b.id !== id);
    }
    
    this.debouncedSave();
    this.deps.console.log(`Bookmark removed: ${id}`);
  }

  public updateBookmark(id: string, data: Partial<Omit<BookmarkData, 'id' | 'filepath' | 'createdAt'>>): void {
    // Use cache index for faster lookup
    let index = this.cache.findByIdIndex(id);
    if (index === null) {
      // Fallback to linear search
      index = this.bookmarks.findIndex(b => b.id === id);
    }
    
    if (index !== -1 && this.bookmarks[index]) {
      this.bookmarks[index] = { ...this.bookmarks[index], ...data };
      this.debouncedSave();
      this.deps.console.log(`Bookmark updated: ${id}`);
    }
  }

  public jumpToBookmark(id: string): void {
    const bookmark = this.bookmarks.find(b => b.id === id);
    if (!bookmark) {
      this.deps.console.error(`Bookmark not found: ${id}`);
      return;
    }

    // TODO: Implement actual seek functionality when IINA API is available
    // For now, just log the action
    this.deps.console.log(`Jumping to bookmark: ${bookmark.title} at ${this.formatTime(bookmark.timestamp)} in ${bookmark.filepath}`);
    
    // Example of what the actual implementation might look like:
    // iina.player.seek(bookmark.timestamp);
    // iina.player.loadFile(bookmark.filepath);
  }

  /**
   * Internal method for getting bookmarks (used by memoized version)
   */
  private getBookmarksInternal(filePath?: string): BookmarkData[] {
    if (filePath) {
      // Use cache index for faster lookups
      const cachedIndexes = this.cache.findByFilePathIndex(filePath);
      if (cachedIndexes.length > 0) {
        return cachedIndexes.map(index => this.bookmarks[index]).filter(Boolean);
      }
      // Fallback to linear search
      return this.bookmarks.filter(bookmark => bookmark.filepath === filePath);
    }
    return [...this.bookmarks];
  }

  /**
   * Public method with performance optimizations
   */
  public getBookmarks(filePath?: string): BookmarkData[] {
    return this.memoizedGetBookmarks(filePath);
  }

  /**
   * Handle export from plugin menu with default settings
   */
  private async handleExportFromMenu(): Promise<void> {
    try {
      // Use default export options optimized for quick access from menu
      const defaultExportOptions: ExportOptions = {
        format: 'json',
        includeMetadata: true
      };

      await this.handleExportBookmarks(defaultExportOptions, 'window');
    } catch (error: any) {
      this.deps.console.error(`Error exporting bookmarks from menu: ${error.message}`);
      throw error;
    }
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
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

  private saveSortPreferences(preferences: any): void {
    try {
      this.deps.preferences.set(this.SORT_PREFERENCES_KEY, JSON.stringify(preferences));
      this.deps.console.log(`Sort preferences saved: ${preferences}`);
    } catch (error: any) {
      this.deps.console.error(`Error saving sort preferences: ${error.message}`);
    }
  }

  // Export functionality
  public async handleExportBookmarks(options: ExportOptions, uiSource: 'sidebar' | 'overlay' | 'window'): Promise<void> {
    try {
      this.deps.console.log(`Starting export with options: ${JSON.stringify(options)}`);
      
      // Get bookmarks to export (apply filters if specified)
      let bookmarksToExport = this.getFilteredBookmarksForExport(options);
      
      // Prompt user for file path if not provided
      if (!options.filePath) {
        const selectedPath = this.promptForExportPath(options.format);
        if (!selectedPath) {
          // User cancelled the file selection
          const responseTarget = uiSource === 'overlay' ? this.deps.overlay : 
                               (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
          
          responseTarget.postMessage(JSON.stringify({ 
            type: "EXPORT_RESULT", 
            data: { success: false, recordCount: 0, error: "Export cancelled by user" } 
          }));
          return;
        }
        options.filePath = selectedPath;
      }
      
      // Generate export data
      const exportResult = await this.exportBookmarks(bookmarksToExport, options);
      
      // Send result back to UI
      const responseTarget = uiSource === 'overlay' ? this.deps.overlay : 
                           (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
      
      responseTarget.postMessage(JSON.stringify({ 
        type: "EXPORT_RESULT", 
        data: exportResult 
      }));
      
      this.deps.console.log(`Export completed: ${exportResult.recordCount} records exported`);
    } catch (error: any) {
      this.deps.console.error(`Export failed: ${error.message}`);
      
      const responseTarget = uiSource === 'overlay' ? this.deps.overlay : 
                           (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
      
      responseTarget.postMessage(JSON.stringify({ 
        type: "EXPORT_RESULT", 
        data: { success: false, recordCount: 0, error: error.message } 
      }));
    }
  }

  private promptForExportPath(format: 'json' | 'csv'): string | null {
    try {
      // Step 1: Let user choose directory
      const selectedDir = this.deps.utils.chooseFile(
        "Choose folder to save exported bookmarks", 
        { chooseDir: true }
      );
      
      if (!selectedDir) {
        this.deps.console.log("User cancelled directory selection");
        return null;
      }
      
      // Step 2: Prompt for filename
      const defaultFilename = `bookmarks-export-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      const filename = this.deps.utils.prompt(`Enter filename for export (with .${format} extension):`);
      
      if (!filename) {
        this.deps.console.log("User cancelled filename input");
        return null;
      }
      
      // Step 3: Ensure proper file extension
      let finalFilename = filename;
      if (!finalFilename.toLowerCase().endsWith(`.${format}`)) {
        finalFilename += `.${format}`;
      }
      
      // Step 4: Combine directory and filename
      const fullPath = `${selectedDir}/${finalFilename}`;
      
      // Step 5: Check if file exists and confirm overwrite
      if (this.deps.file.exists(fullPath)) {
        const overwrite = this.deps.utils.ask(
          `File "${finalFilename}" already exists. Do you want to overwrite it?`
        );
        if (!overwrite) {
          this.deps.console.log("User cancelled overwrite");
          return null;
        }
      }
      
      this.deps.console.log(`Export path selected: ${fullPath}`);
      return fullPath;
      
    } catch (error: any) {
      this.deps.console.error(`Error selecting export path: ${error.message}`);
      return null;
    }
  }

  private getFilteredBookmarksForExport(options: ExportOptions): BookmarkData[] {
    let bookmarks = [...this.bookmarks];
    
    if (options.filter) {
      // Filter by tags
      if (options.filter.tags && options.filter.tags.length > 0) {
        bookmarks = bookmarks.filter(bookmark => 
          bookmark.tags && bookmark.tags.some(tag => 
            options.filter!.tags!.includes(tag)
          )
        );
      }
      
      // Filter by date range
      if (options.filter.dateRange) {
        const startDate = new Date(options.filter.dateRange.start);
        const endDate = new Date(options.filter.dateRange.end);
        
        bookmarks = bookmarks.filter(bookmark => {
          const bookmarkDate = new Date(bookmark.createdAt);
          return bookmarkDate >= startDate && bookmarkDate <= endDate;
        });
      }
      
      // Filter by media type
      if (options.filter.mediaType) {
        bookmarks = bookmarks.filter(bookmark => {
          const extension = bookmark.filepath.split('.').pop()?.toLowerCase() || '';
          const mediaType = this.getMediaType(extension);
          return mediaType.toLowerCase().includes(options.filter!.mediaType!.toLowerCase());
        });
      }
    }
    
    return bookmarks;
  }

  private async exportBookmarks(bookmarks: BookmarkData[], options: ExportOptions): Promise<ExportResult> {
    if (options.format === 'json') {
      return this.exportBookmarksToJSON(bookmarks, options);
    } else if (options.format === 'csv') {
      return this.exportBookmarksToCSV(bookmarks, options as CSVOptions);
    } else {
      throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportBookmarksToJSON(bookmarks: BookmarkData[], options: ExportOptions): ExportResult {
    try {
      const exportData = {
        metadata: options.includeMetadata ? {
          exportedAt: new Date().toISOString(),
          totalRecords: bookmarks.length,
          exportOptions: options,
          version: "1.0.0"
        } : undefined,
        bookmarks: bookmarks
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Generate filename if not provided
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = options.filePath || `bookmarks-export-${timestamp}.json`;
      
      // Save file using IINA's file API if filePath is provided
      if (options.filePath) {
        try {
          this.deps.file.write(options.filePath, jsonString);
          this.deps.console.log(`JSON export saved to: ${options.filePath}`);
          
          return {
            success: true,
            filePath: options.filePath,
            recordCount: bookmarks.length
          };
        } catch (fileError: any) {
          this.deps.console.error(`Failed to save JSON file: ${fileError.message}`);
          return {
            success: false,
            recordCount: 0,
            error: `Failed to save file: ${fileError.message}`
          };
        }
      } else {
        // Fallback: return data for UI download (for testing/development)
        return {
          success: true,
          filePath: fileName,
          recordCount: bookmarks.length,
          data: jsonString // Include data for testing/download in UI
        } as ExportResult & { data: string };
      }
      
    } catch (error: any) {
      return {
        success: false,
        recordCount: 0,
        error: `JSON export failed: ${error.message}`
      };
    }
  }

  private exportBookmarksToCSV(bookmarks: BookmarkData[], options: CSVOptions): ExportResult {
    try {
      const delimiter = options.delimiter || ',';
      const fields = options.selectedFields.length > 0 ? options.selectedFields : 
                    ['id', 'title', 'timestamp', 'filepath', 'description', 'createdAt', 'tags'];
      
      let csvContent = '';
      
      // Add headers if requested
      if (options.includeHeaders) {
        csvContent += fields.join(delimiter) + '\n';
      }
      
      // Add data rows
      for (const bookmark of bookmarks) {
        const row = fields.map(field => {
          let value = (bookmark as any)[field];
          
          // Special handling for different field types
          if (field === 'tags' && Array.isArray(value)) {
            value = value.join(';'); // Use semicolon to separate tags
          } else if (field === 'timestamp') {
            value = `${value} (${this.formatTime(value)})`;
          } else if (value === undefined || value === null) {
            value = '';
          }
          
          // Escape CSV values (wrap in quotes if contains delimiter or quotes)
          const stringValue = String(value);
          if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          
          return stringValue;
        });
        
        csvContent += row.join(delimiter) + '\n';
      }
      
      // Generate filename if not provided
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = options.filePath || `bookmarks-export-${timestamp}.csv`;
      
      // Save file using IINA's file API if filePath is provided
      if (options.filePath) {
        try {
          this.deps.file.write(options.filePath, csvContent);
          this.deps.console.log(`CSV export saved to: ${options.filePath}`);
          
          return {
            success: true,
            filePath: options.filePath,
            recordCount: bookmarks.length
          };
        } catch (fileError: any) {
          this.deps.console.error(`Failed to save CSV file: ${fileError.message}`);
          return {
            success: false,
            recordCount: 0,
            error: `Failed to save file: ${fileError.message}`
          };
        }
      } else {
        // Fallback: return data for UI download (for testing/development)
        return {
          success: true,
          filePath: fileName,
          recordCount: bookmarks.length,
          data: csvContent // Include data for testing/download in UI
        } as ExportResult & { data: string };
      }
      
    } catch (error: any) {
      return {
        success: false,
        recordCount: 0,
        error: `CSV export failed: ${error.message}`
      };
    }
  }

  public validateExportData(bookmarks: BookmarkData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(bookmarks)) {
      errors.push("Data must be an array of bookmarks");
      return { isValid: false, errors };
    }
    
    if (bookmarks.length === 0) {
      errors.push("No bookmarks found to export");
      return { isValid: false, errors };
    }
    
    bookmarks.forEach((bookmark, index) => {
      if (!bookmark.id || typeof bookmark.id !== 'string') {
        errors.push(`Bookmark at index ${index} missing required field: id`);
      }
      if (!bookmark.title || typeof bookmark.title !== 'string') {
        errors.push(`Bookmark at index ${index} missing required field: title`);
      }
      if (!bookmark.filepath || typeof bookmark.filepath !== 'string') {
        errors.push(`Bookmark at index ${index} missing required field: filepath`);
      }
      if (typeof bookmark.timestamp !== 'number' || bookmark.timestamp < 0) {
        errors.push(`Bookmark at index ${index} invalid timestamp: ${bookmark.timestamp}`);
      }
    });
    
    return { isValid: errors.length === 0, errors };
  }

  public async handleImportBookmarks(bookmarks: BookmarkData[], options: ImportOptions, uiSource: 'sidebar' | 'overlay' | 'window'): Promise<void> {
    try {
      this.deps.console.log(`Starting import with options: ${JSON.stringify(options)}`);
      this.deps.console.log(`Importing ${bookmarks.length} bookmarks`);
      
      // Import bookmarks
      const importResult = await this.importBookmarks(bookmarks, options);
      
      // Send result back to UI
      const responseTarget = uiSource === 'overlay' ? this.deps.overlay : 
                           (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
      
      responseTarget.postMessage(JSON.stringify({ 
        type: "IMPORT_RESULT", 
        data: importResult 
      }));
      
      this.deps.console.log(`Import completed: ${importResult.importedCount} imported, ${importResult.skippedCount} skipped, ${importResult.errorCount} errors`);
      
      // Refresh UIs if any bookmarks were imported
      if (importResult.importedCount > 0) {
        this.refreshUIs();
      }
    } catch (error: any) {
      this.deps.console.error(`Import failed: ${error.message}`);
      
      const responseTarget = uiSource === 'overlay' ? this.deps.overlay : 
                           (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
      
      responseTarget.postMessage(JSON.stringify({ 
        type: "IMPORT_RESULT", 
        data: { 
          success: false, 
          importedCount: 0, 
          skippedCount: 0, 
          errorCount: 1, 
          errors: [error.message] 
        } 
      }));
    }
  }

  private async importBookmarks(bookmarks: BookmarkData[], options: ImportOptions): Promise<ImportResult> {
    try {
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const errors: string[] = [];

      this.deps.console.log(`Starting optimized import of ${bookmarks.length} bookmarks...`);

      // Use batch processing for large datasets to prevent blocking
      const { result: results, duration } = await PerformanceUtils.measureAsync('importBookmarks', async () => {
        return await PerformanceUtils.batchProcess(
          bookmarks,
          async (bookmark, index) => {
            try {
              const existingBookmark = this.findExistingBookmark(bookmark);
              
              if (existingBookmark) {
                duplicateCount++;
                
                switch (options.duplicateHandling) {
                  case 'skip':
                    skippedCount++;
                    return { type: 'skipped', bookmark, message: `Skipping duplicate: ${bookmark.title}` };
                    
                  case 'replace':
                    this.updateExistingBookmark(existingBookmark.id, bookmark);
                    importedCount++;
                    return { type: 'replaced', bookmark, message: `Replaced: ${bookmark.title}` };
                    
                  case 'merge':
                    this.mergeBookmarks(existingBookmark, bookmark);
                    importedCount++;
                    return { type: 'merged', bookmark, message: `Merged: ${bookmark.title}` };
                }
              } else {
                // Create new bookmark
                const newBookmark: BookmarkData = {
                  id: options.preserveIds ? bookmark.id : this.generateUniqueId(),
                  title: bookmark.title,
                  timestamp: bookmark.timestamp,
                  filepath: bookmark.filepath,
                  description: bookmark.description || '',
                  createdAt: bookmark.createdAt || new Date().toISOString(),
                  tags: bookmark.tags || []
                };
                
                this.bookmarks.push(newBookmark);
                importedCount++;
                return { type: 'added', bookmark, message: `Added: ${bookmark.title}` };
              }
              
              return { type: 'unknown', bookmark, message: `Unknown result for: ${bookmark.title}` };
            } catch (error: any) {
              errorCount++;
              const errorMessage = `Bookmark ${index + 1} (${bookmark?.title || 'unknown'}): ${error.message}`;
              errors.push(errorMessage);
              return { type: 'error', bookmark, message: errorMessage };
            }
          },
          100, // Process 100 items per batch
          5    // 5ms delay between batches to prevent UI blocking
        );
      });

      // Log results summary
      const resultCounts = results.reduce((acc, result) => {
        acc[result.type] = (acc[result.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      this.deps.console.log(`Import batch processing completed in ${duration.toFixed(2)}ms. Results: ${JSON.stringify(resultCounts)}`);

      // Save bookmarks if any were imported (use debounced save)
      if (importedCount > 0) {
        this.debouncedSave();
      }

      const importResult: ImportResult = {
        success: errorCount === 0 || importedCount > 0,
        importedCount,
        skippedCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
        duplicates: duplicateCount
      };

      this.deps.console.log(`Import completed: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
      return importResult;

    } catch (error: any) {
      this.deps.console.error(`Critical import error: ${error.message}`);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [`Critical import error: ${error.message}`]
      };
    }
  }

  private validateImportData(bookmarks: BookmarkData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(bookmarks)) {
      errors.push("Import data must be an array of bookmarks");
      return { isValid: false, errors };
    }
    
    if (bookmarks.length === 0) {
      errors.push("No bookmarks found to import");
      return { isValid: false, errors };
    }
    
    bookmarks.forEach((bookmark, index) => {
      if (!bookmark.id || typeof bookmark.id !== 'string') {
        errors.push(`Bookmark ${index + 1}: Invalid or missing ID`);
      }
      if (!bookmark.title || typeof bookmark.title !== 'string') {
        errors.push(`Bookmark ${index + 1}: Invalid or missing title`);
      }
      if (!bookmark.filepath || typeof bookmark.filepath !== 'string') {
        errors.push(`Bookmark ${index + 1}: Invalid or missing filepath`);
      }
      if (typeof bookmark.timestamp !== 'number' || bookmark.timestamp < 0) {
        errors.push(`Bookmark ${index + 1}: Invalid timestamp`);
      }
      if (bookmark.tags && !Array.isArray(bookmark.tags)) {
        errors.push(`Bookmark ${index + 1}: Tags must be an array`);
      }
    });
    
    return { isValid: errors.length === 0, errors };
  }

  private findExistingBookmark(bookmark: BookmarkData): BookmarkData | undefined {
    // Check for exact ID match first using cache
    const idIndex = this.cache.findByIdIndex(bookmark.id);
    if (idIndex !== null && this.bookmarks[idIndex]) {
      return this.bookmarks[idIndex];
    }
    
    // Check for functional duplicates (same file, same timestamp) using cache
    const timestampIndexes = this.cache.findByTimestampIndex(bookmark.timestamp, 1.0);
    const filePathIndexes = new Set(this.cache.findByFilePathIndex(bookmark.filepath));
    
    // Find intersection of timestamp and filepath matches
    for (const timestampIndex of timestampIndexes) {
      if (filePathIndexes.has(timestampIndex) && this.bookmarks[timestampIndex]) {
        return this.bookmarks[timestampIndex];
      }
    }
    
    // Check for title + filepath match
    const fileBookmarks = this.cache.findByFilePathIndex(bookmark.filepath);
    for (const index of fileBookmarks) {
      const existing = this.bookmarks[index];
      if (existing && existing.title === bookmark.title) {
        return existing;
      }
    }
    
    return undefined;
  }

  private updateExistingBookmark(existingId: string, newBookmark: BookmarkData): void {
    const index = this.bookmarks.findIndex(b => b.id === existingId);
    if (index !== -1) {
      this.bookmarks[index] = {
        ...newBookmark,
        id: existingId, // Preserve original ID
        createdAt: this.bookmarks[index].createdAt // Preserve original creation date
      };
    }
  }

  private mergeBookmarks(existing: BookmarkData, imported: BookmarkData): void {
    const index = this.bookmarks.findIndex(b => b.id === existing.id);
    if (index !== -1) {
      // Merge tags
      const existingTags = existing.tags || [];
      const importedTags = imported.tags || [];
      const mergedTags = [...new Set([...existingTags, ...importedTags])];
      
      // Update with newest data but keep original creation info
      this.bookmarks[index] = {
        ...imported,
        id: existing.id, // Preserve original ID
        createdAt: existing.createdAt, // Preserve original creation date
        tags: mergedTags,
        // Keep imported description if existing is empty
        description: imported.description || existing.description || ''
      };
    }
  }

  /**
   * Handle import from menu - prompts user for file and imports
   */
  private async handleImportFromMenu(): Promise<void> {
    try {
      const filePath = this.promptForImportPath();
      if (!filePath) {
        this.deps.console.log("Import cancelled by user.");
        return;
      }

      const importResult = await this.importBookmarksFromFile(filePath, {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: false
      });

      if (importResult.success) {
        this.deps.console.log(`Import successful: ${importResult.importedCount} bookmarks imported`);
        if (importResult.skippedCount > 0) {
          this.deps.console.log(`${importResult.skippedCount} bookmarks skipped as duplicates`);
        }
      } else {
        this.deps.console.error(`Import failed: ${importResult.errors?.join(', ')}`);
      }
    } catch (error: any) {
      this.deps.console.error(`Import from menu failed: ${error.message}`);
    }
  }

  /**
   * Handle import request from UI - prompts for file selection and sends data back
   */
  private async handleImportFromFile(uiSource: 'sidebar' | 'overlay' | 'window'): Promise<void> {
    try {
      const filePath = this.promptForImportPath();
      if (!filePath) {
        this.sendImportResponse(uiSource, {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errorCount: 1,
          errors: ["Import cancelled by user"]
        });
        return;
      }

      const importResult = await this.importBookmarksFromFile(filePath, {
        duplicateHandling: 'skip',
        validateData: true,
        preserveIds: false
      });

      this.sendImportResponse(uiSource, importResult);

      // Refresh UIs if any bookmarks were imported
      if (importResult.importedCount > 0) {
        this.refreshUIs();
      }

    } catch (error: any) {
      this.deps.console.error(`Import from file failed: ${error.message}`);
      this.sendImportResponse(uiSource, {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [error.message]
      });
    }
  }

  /**
   * Comprehensive file validation before parsing
   */
  private validateImportFile(filePath: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if file exists
    if (!this.deps.file.exists(filePath)) {
      errors.push("File does not exist");
      return { isValid: false, errors };
    }

    // Validate file extension
    const lastDotIndex = filePath.lastIndexOf('.');
    const extension = lastDotIndex === -1 ? null : filePath.substring(lastDotIndex + 1).toLowerCase();
    if (!extension || !['json', 'csv'].includes(extension)) {
      errors.push(`Unsupported file extension: ${extension || 'none'}. Only JSON and CSV files are supported.`);
    }

    // Check for path traversal patterns in the full path
    if (filePath.includes('..')) {
      errors.push("File name contains invalid or suspicious characters");
    }

    // Validate file name (basic security check)
    const fileName = filePath.split('/').pop() || filePath;
    if (fileName.length > 255) {
      errors.push("File name is too long (maximum 255 characters)");
    }

    // Check for suspicious filename patterns
    const suspiciousPatterns = [
      /[<>:"\\|?*]/,  // Invalid characters for most file systems
      /^\s+|\s+$/,  // Leading/trailing spaces
    ];

    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(fileName)) {
        errors.push("File name contains invalid or suspicious characters");
      }
    });

    // Check Windows reserved names separately (without extension)
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(nameWithoutExt)) {
      errors.push("File name contains invalid or suspicious characters");
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate file content structure and format
   */
  private validateFileContent(filePath: string, content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const extension = filePath.split('.').pop()?.toLowerCase();

    // Check file size (prevent memory issues)
    const contentSize = new Blob([content]).size;
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    if (contentSize > maxSize) {
      errors.push(`File is too large (${Math.round(contentSize / 1024 / 1024)}MB). Maximum allowed size is 50MB.`);
      return { isValid: false, errors };
    }

    // Check for minimum content length
    if (content.length < 10) {
      errors.push("File content is too short to contain valid bookmark data");
      return { isValid: false, errors };
    }

    // Format-specific validation
    if (extension === 'json') {
      return this.validateJSONContent(content);
    } else if (extension === 'csv') {
      return this.validateCSVContent(content);
    }

    return { isValid: true, errors };
  }

  /**
   * Validate JSON file structure
   */
  private validateJSONContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(content);

      // Check if it's an array or object with bookmarks property
      if (!Array.isArray(parsed)) {
        if (typeof parsed !== 'object' || parsed === null) {
          errors.push("JSON must contain an array of bookmarks or an object with bookmarks property");
          return { isValid: false, errors };
        }

        if (!parsed.bookmarks || !Array.isArray(parsed.bookmarks)) {
          errors.push("JSON must contain an array of bookmarks");
          return { isValid: false, errors };
        }
      }

      const bookmarks = Array.isArray(parsed) ? parsed : parsed.bookmarks;

      // Validate bookmark count
      if (bookmarks.length === 0) {
        errors.push("No bookmarks found in file");
        return { isValid: false, errors };
      }

      if (bookmarks.length > 10000) {
        errors.push(`Too many bookmarks (${bookmarks.length}). Maximum allowed is 10,000.`);
        return { isValid: false, errors };
      }

      // Sample validation of first few bookmarks
      const sampleSize = Math.min(bookmarks.length, 5);
      for (let i = 0; i < sampleSize; i++) {
        const bookmark = bookmarks[i];
        if (typeof bookmark !== 'object' || bookmark === null) {
          errors.push(`Bookmark ${i + 1} is not a valid object`);
          continue;
        }

        // Check required fields existence (not content validation, just presence)
        const requiredFields = ['id', 'title', 'timestamp', 'filepath'];
        const missingFields = requiredFields.filter(field => !(field in bookmark));
        if (missingFields.length > 0) {
          errors.push(`Bookmark ${i + 1} missing required fields: ${missingFields.join(', ')}`);
        }
      }

    } catch (error: any) {
      errors.push(`Failed to parse JSON file: ${error.message}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate CSV file structure
   */
  private validateCSVContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const lines = content.trim().split('\n');
      
      if (lines.length < 2) {
        errors.push("CSV file must have at least a header row and one data row");
        return { isValid: false, errors };
      }

      if (lines.length > 10001) { // Header + 10000 data rows
        errors.push(`Too many rows (${lines.length - 1}). Maximum allowed is 10,000 bookmarks.`);
        return { isValid: false, errors };
      }

      // Validate header row
      const headers = this.parseCSVLine(lines[0]);
      if (headers.length === 0) {
        errors.push("CSV file has no headers");
        return { isValid: false, errors };
      }

      if (headers.length > 20) {
        errors.push("Too many columns in CSV file. Maximum 20 columns allowed.");
        return { isValid: false, errors };
      }

      // Check for required headers
      const requiredHeaders = ['id', 'title', 'timestamp', 'filepath'];
      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
      const missingHeaders = requiredHeaders.filter(header => !normalizedHeaders.includes(header));
      
      if (missingHeaders.length > 0) {
        errors.push(`CSV file missing required headers: ${missingHeaders.join(', ')}`);
      }

      // Validate a few sample rows for structure (allow some flexibility)
      const sampleSize = Math.min(lines.length - 1, 5);
      let validRowCount = 0;
      for (let i = 1; i <= sampleSize; i++) {
        const line = lines[i].trim();
        if (line === '') continue; // Skip empty lines
        
        try {
          const values = this.parseCSVLine(line);
          if (values.length === headers.length) {
            validRowCount++;
          }
          // Note: We don't fail here for mismatched columns, as parsing will handle this gracefully
        } catch (error) {
          // Parsing errors will be handled during the actual import
        }
      }
      
      // Only fail if NO valid rows are found in the sample
      if (validRowCount === 0 && sampleSize > 0) {
        errors.push("No valid data rows found in CSV file sample");
      }

      // Check for suspicious content patterns
      const suspiciousPatterns = [
        /<script/i,
        /<iframe/i,
        /javascript:/i,
        /data:text\/html/i
      ];

      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          errors.push("File contains potentially unsafe content");
        }
      });

    } catch (error: any) {
      errors.push(`CSV parsing error: ${error.message}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Prompt user to select import file path
   */
  private promptForImportPath(): string | null {
    try {
      const filePath = this.deps.utils.chooseFile("Select bookmark file to import", {
        allowedFileTypes: ['json', 'csv']
      });
      
      if (!filePath || filePath.trim() === '') {
        return null;
      }

      // Validate file exists
      if (!this.deps.file.exists(filePath)) {
        throw new Error("Selected file does not exist");
      }

      return filePath;
    } catch (error: any) {
      this.deps.console.error(`Error selecting import file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import bookmarks from file (JSON or CSV)
   */
  private async importBookmarksFromFile(filePath: string, options: ImportOptions): Promise<ImportResult> {
    try {
      this.deps.console.log(`Starting import from file: ${filePath}`);

      // Comprehensive file validation
      const validationResult = this.validateImportFile(filePath);
      if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.errors.join('; ')}`);
      }

      // Read file content
      const fileContent = this.deps.file.read(filePath);
      if (!fileContent || fileContent.trim() === '') {
        throw new Error("File is empty or could not be read");
      }

      // Validate file content structure
      const contentValidation = this.validateFileContent(filePath, fileContent);
      if (!contentValidation.isValid) {
        throw new Error(`Content validation failed: ${contentValidation.errors.join('; ')}`);
      }

      // Determine file format and parse
      const format = this.detectFileFormat(filePath, fileContent);
      let bookmarks: BookmarkData[];

      if (format === 'json') {
        bookmarks = this.parseJSONFile(fileContent);
        
        // For JSON files, apply additional validation if requested
        if (options.validateData) {
          const validation = this.validateImportData(bookmarks);
          if (!validation.isValid) {
            return {
              success: false,
              importedCount: 0,
              skippedCount: 0,
              errorCount: validation.errors.length,
              errors: validation.errors
            };
          }
        }
      } else if (format === 'csv') {
        bookmarks = this.parseCSVFile(fileContent);
        // CSV files are already validated during parsing
      } else {
        throw new Error("Unsupported file format. Only JSON and CSV files are supported.");
      }

      this.deps.console.log(`Parsed ${bookmarks.length} bookmarks from ${format.toUpperCase()} file`);

      // Import the parsed bookmarks
      return await this.importBookmarks(bookmarks, options);

    } catch (error: any) {
      this.deps.console.error(`Failed to import from file: ${error.message}`);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [`Failed to import from file: ${error.message}`]
      };
    }
  }

  /**
   * Detect file format based on extension and content
   */
  private detectFileFormat(filePath: string, content: string): 'json' | 'csv' {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    if (extension === 'json') {
      return 'json';
    } else if (extension === 'csv') {
      return 'csv';
    }

    // Fallback: try to detect by content
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      // If not JSON, assume CSV
      return 'csv';
    }
  }

  /**
   * Parse JSON bookmark file
   */
  private parseJSONFile(content: string): BookmarkData[] {
    try {
      const parsed = JSON.parse(content);
      
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed && typeof parsed === 'object' && parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
        // Handle wrapped format: { bookmarks: [...] }
        return parsed.bookmarks;
      } else {
        throw new Error("JSON file must contain an array of bookmarks or an object with a 'bookmarks' property");
      }
    } catch (error: any) {
      throw new Error(`Failed to parse JSON file: ${error.message}`);
    }
  }

  /**
   * Parse CSV bookmark file
   */
  private parseCSVFile(content: string): BookmarkData[] {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Parse header line
    const headers = this.parseCSVLine(lines[0]);
    if (headers.length === 0) {
      throw new Error("CSV file has no headers");
    }

    // Validate required headers
    const requiredHeaders = ['id', 'title', 'timestamp', 'filepath'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      throw new Error(`CSV file missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Parse data lines - handle errors gracefully
    const bookmarks: BookmarkData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines

      try {
        const values = this.parseCSVLine(line);
        if (values.length !== headers.length) {
          this.deps.console.warn(`CSV line ${i + 1} has ${values.length} values but expected ${headers.length}, skipping`);
          continue;
        }

        const bookmark = this.csvRowToBookmark(headers, values, i + 1);
        if (bookmark) {
          bookmarks.push(bookmark);
        }
      } catch (error: any) {
        this.deps.console.warn(`Failed to parse CSV line ${i + 1}: ${error.message}, skipping`);
        continue;
      }
    }

    return bookmarks;
  }

  /**
   * Parse a single CSV line, handling quoted values and commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  /**
   * Convert CSV row to BookmarkData object
   */
  private csvRowToBookmark(headers: string[], values: string[], lineNumber: number): BookmarkData | null {
    try {
      const bookmark: any = {};
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase();
        const value = values[i];

        switch (header) {
          case 'id':
            bookmark.id = value;
            break;
          case 'title':
            bookmark.title = value;
            break;
          case 'timestamp':
            bookmark.timestamp = parseFloat(value);
            if (isNaN(bookmark.timestamp)) {
              throw new Error(`Invalid timestamp: ${value}`);
            }
            break;
          case 'filepath':
            bookmark.filepath = value;
            break;
          case 'description':
            bookmark.description = value || '';
            break;
          case 'createdat':
          case 'created_at':
            bookmark.createdAt = value || new Date().toISOString();
            break;
          case 'tags':
            if (value && value.trim() !== '') {
              // Handle tags as JSON array or comma-separated string
              try {
                bookmark.tags = JSON.parse(value);
              } catch {
                // Parse as comma-separated string
                bookmark.tags = value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
              }
            } else {
              bookmark.tags = [];
            }
            break;
        }
      }

      // Validate required fields
      if (!bookmark.id || !bookmark.title || !bookmark.filepath || typeof bookmark.timestamp !== 'number') {
        throw new Error("Missing required fields");
      }

      // Set defaults
      bookmark.description = bookmark.description || '';
      bookmark.createdAt = bookmark.createdAt || new Date().toISOString();
      bookmark.tags = bookmark.tags || [];

      return bookmark as BookmarkData;
    } catch (error: any) {
      this.deps.console.warn(`Failed to parse CSV line ${lineNumber}: ${error.message}`);
      return null;
    }
  }

  /**
   * Send import result to UI
   */
  private sendImportResponse(uiSource: 'sidebar' | 'overlay' | 'window', result: ImportResult): void {
    const responseTarget = uiSource === 'overlay' ? this.deps.overlay : 
                         (uiSource === 'sidebar' ? this.deps.sidebar : this.deps.standaloneWindow);
    
    responseTarget.postMessage(JSON.stringify({ 
      type: "IMPORT_RESULT", 
      data: result 
    }));
  }
} 