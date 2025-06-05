import { MetadataDetector, MediaMetadata, IINACore } from './metadata-detector';

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

  constructor(dependencies?: IINADependencies) {
    // Default to empty implementations for testing
    this.deps = dependencies || {
      console: { log: () => {}, error: () => {}, warn: () => {} },
      preferences: { get: () => null, set: () => {} },
      core: { status: {} },
      event: { on: () => {} },
      menu: { addItem: () => {}, item: () => ({}) },
      sidebar: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {} },
      overlay: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {}, setClickable: () => {}, show: () => {}, hide: () => {}, isVisible: () => false },
      standaloneWindow: { loadFile: () => {}, postMessage: () => {}, onMessage: () => {}, show: () => {} }
    };

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
      this.deps.sidebar.loadFile("dist/ui/sidebar/index.html");
      this.deps.overlay.loadFile("dist/ui/overlay/index.html");
      this.deps.overlay.setClickable(true);
      this.deps.overlay.hide();
      this.deps.standaloneWindow.loadFile("dist/ui/window/index.html");
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
            this.deps.console.error(`[${uiSource}] Error parsing JSON message:`, messageContent, e);
            return;
          }
        } else if (typeof messageContent === 'object' && messageContent !== null && 'type' in messageContent) {
          message = messageContent as UIMessage;
        } else {
          this.deps.console.warn(`[${uiSource}] Received non-standard message:`, messageContent);
          return;
        }
        
        this.deps.console.log(`[${uiSource}] Received message:`, message);

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
              .catch(error => this.deps.console.error("Failed to add bookmark:", error.message));
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
          default:
            this.deps.console.warn(`[${uiSource}] Unknown message type:`, message.type);
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
      const stored = this.deps.preferences.get(this.STORAGE_KEY) as string;
      if (stored) {
        const parsedBookmarks = JSON.parse(stored) as BookmarkData[];
        this.bookmarks = parsedBookmarks.map(b => ({
            ...b,
            createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString()
        }));
      }
      this.deps.console.log("Bookmarks loaded:", this.bookmarks.length);
    } catch (error: any) {
      this.deps.console.error("Error loading bookmarks:", error.message);
      this.bookmarks = [];
    }
  }

  private saveBookmarks(): void {
    try {
      this.deps.preferences.set(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
      this.deps.console.log("Bookmarks saved.");
      this.refreshUIs();
    } catch (error: any) {
      this.deps.console.error("Error saving bookmarks:", error.message);
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
        this.deps.console.warn("Could not refresh one or more UIs. They might not be loaded yet.", e.message);
    }
  }
  
  private setupEventListeners(): void {
    this.deps.event.on("file-loaded", () => {
      this.deps.console.log("File loaded event triggered.");
      // Refresh metadata cache when file changes
      this.metadataDetector.refreshMetadata()
        .then(() => this.refreshUIs())
        .catch(error => this.deps.console.error("Failed to refresh metadata on file load:", error.message));
    });

    this.deps.menu.addItem(
      this.deps.menu.item("Add Bookmark at Current Time", () => {
        this.addBookmark()
          .catch(error => this.deps.console.error("Failed to add bookmark from menu:", error.message));
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
  }

  public async addBookmark(title?: string, timestamp?: number, description?: string, tags?: string[]): Promise<void> {
    try {
      const currentPath = this.deps.core.status.path || '/test/video.mp4'; // Default for testing
      const currentTime = timestamp !== undefined ? timestamp : (this.deps.core.status.currentTime || 0);
      
      // Use enhanced metadata detection
      let detectedTitle: string;
      try {
        const metadataTitle = await this.metadataDetector.getCurrentTitle();
        detectedTitle = metadataTitle || this.extractMediaTitle(currentPath);
      } catch (error: any) {
        this.deps.console.warn(`Metadata detection failed, falling back to filename: ${error.message}`);
        detectedTitle = this.extractMediaTitle(currentPath);
      }
      
      const metadata = this.generateBookmarkMetadata(
        currentPath, 
        detectedTitle, 
        currentTime, 
        title, 
        description, 
        tags
      );

      const bookmark: BookmarkData = {
        id: this.generateUniqueId(),
        title: metadata.title,
        timestamp: currentTime,
        filepath: currentPath,
        description: metadata.description,
        createdAt: new Date().toISOString(),
        tags: metadata.tags
      };

      this.bookmarks.push(bookmark);
      this.saveBookmarks();
      this.deps.console.log("Bookmark added with enhanced metadata detection:", bookmark.title);
    } catch (error: any) {
      this.deps.console.error("Error adding bookmark:", error.message);
      throw error;
    }
  }

  private extractMediaTitle(filepath: string): string {
    const filename = filepath.split('/').pop() || filepath;
    return filename.replace(/\.[^/.]+$/, ""); // Remove extension
  }

  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateBookmarkMetadata(filepath: string, mediaTitle: string, timestamp: number, userTitle?: string, userDescription?: string, userTags?: string[]) {
    const extension = filepath.split('.').pop()?.toLowerCase() || '';
    const mediaType = this.getMediaType(extension);
    const autoTags = this.generateAutoTags(filepath, extension, mediaTitle, timestamp);
    
    // Merge user tags with auto tags, removing duplicates
    const allTags = [...new Set([...(userTags || []), ...autoTags])];
    
    return {
      title: userTitle || `${mediaTitle} - ${this.formatTime(timestamp)}`,
      description: userDescription || `Bookmark at ${this.formatTime(timestamp)} in ${mediaType}`,
      tags: allTags.length > 0 ? allTags : undefined
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
    this.bookmarks = this.bookmarks.filter(b => b.id !== id);
    this.saveBookmarks();
    this.deps.console.log("Bookmark removed:", id);
  }

  public updateBookmark(id: string, data: Partial<Omit<BookmarkData, 'id' | 'filepath' | 'createdAt'>>): void {
    const index = this.bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      this.bookmarks[index] = { ...this.bookmarks[index], ...data };
      this.saveBookmarks();
      this.deps.console.log("Bookmark updated:", id);
    }
  }

  public jumpToBookmark(id: string): void {
    const bookmark = this.bookmarks.find(b => b.id === id);
    if (!bookmark) {
      this.deps.console.error("Bookmark not found:", id);
      return;
    }

    // TODO: Implement actual seek functionality when IINA API is available
    // For now, just log the action
    this.deps.console.log(`Jumping to bookmark: ${bookmark.title} at ${this.formatTime(bookmark.timestamp)} in ${bookmark.filepath}`);
    
    // Example of what the actual implementation might look like:
    // iina.player.seek(bookmark.timestamp);
    // iina.player.loadFile(bookmark.filepath);
  }

  public getBookmarks(filePath?: string): BookmarkData[] {
    if (filePath) {
      return this.bookmarks.filter(bookmark => bookmark.filepath === filePath);
    }
    return [...this.bookmarks];
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
        this.deps.console.log("Sort preferences loaded:", stored);
      }
    } catch (error: any) {
      this.deps.console.error("Error loading sort preferences:", error.message);
    }
  }

  private saveSortPreferences(preferences: any): void {
    try {
      this.deps.preferences.set(this.SORT_PREFERENCES_KEY, JSON.stringify(preferences));
      this.deps.console.log("Sort preferences saved:", preferences);
    } catch (error: any) {
      this.deps.console.error("Error saving sort preferences:", error.message);
    }
  }
} 