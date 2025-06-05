// Global declarations for IINA environment
declare global {
  const iina: any;
}

interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string; // ISO string
  tags?: string[];
}

// For communication from UI to plugin
interface UIMessage {
  type: string;
  payload?: any;
  sourceUI?: 'sidebar' | 'overlay' | 'window'; // Optional: to know which UI sent it if needed centrally
}

class BookmarkManager {
  private bookmarks: BookmarkData[] = [];
  private readonly STORAGE_KEY = "bookmarks";
  private standaloneWindow: any;
  private overlay: any;
  private sidebar: any;
  private event: any;
  private console: any;
  private menu: any;
  private core: any;
  private preferences: any;
  private iina: any;

  constructor(deps: any) {
    this.standaloneWindow = deps.standaloneWindow;
    this.overlay = deps.overlay;
    this.sidebar = deps.sidebar;
    this.event = deps.event;
    this.console = deps.console;
    this.menu = deps.menu;
    this.core = deps.core;
    this.preferences = deps.preferences;
    this.iina = deps.iina;

    this.loadBookmarks();
    this.setupEventListeners();
    this.setupWebUI();
    this.setupUIMessageListeners();

    this.console.log("IINA Bookmarks Plugin initialized. Message passing enabled.");
  }

  private setupWebUI(): void {
    try {
      this.sidebar.loadFile("dist/ui/sidebar/index.html");
      this.overlay.loadFile("dist/ui/overlay/index.html");
      this.overlay.setClickable(true);
      this.overlay.hide();
      this.standaloneWindow.loadFile("dist/ui/window/index.html");
      this.console.log("Web UIs loaded successfully.");
    } catch (e: any) {
      this.console.error(`Error loading Web UIs: ${e.message}`);
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
            this.console.error(`[${uiSource}] Error parsing JSON message:`, messageContent, e);
            return;
          }
        } else if (typeof messageContent === 'object' && messageContent !== null && 'type' in messageContent) {
          message = messageContent as UIMessage;
        } else {
          this.console.warn(`[${uiSource}] Received non-standard message:`, messageContent);
          return;
        }
        
        this.console.log(`[${uiSource}] Received message:`, message);

        switch (message.type) {
          case "REQUEST_FILE_PATH":
            const currentPath = this.core.status.path;
            const responseTarget = uiSource === 'overlay' ? this.overlay : (uiSource === 'sidebar' ? this.sidebar : this.standaloneWindow);
            responseTarget.postMessage(JSON.stringify({ type: "CURRENT_FILE_PATH", data: currentPath }));
            break;
          case "JUMP_TO_BOOKMARK":
            if (message.payload?.id) {
              this.jumpToBookmark(message.payload.id);
            }
            break;
          case "HIDE_OVERLAY":
            this.overlay.hide();
            break;
          case "ADD_BOOKMARK": // Assuming payload is { title, timestamp, description, tags }
             this.addBookmark(message.payload?.title, message.payload?.timestamp, message.payload?.description, message.payload?.tags);
            break;
          case "DELETE_BOOKMARK":
            if (message.payload?.id) {
              this.removeBookmark(message.payload.id);
            }
            break;
          case "UPDATE_BOOKMARK": // Assuming payload is { id, data: Partial<BookmarkData> }
            if (message.payload?.id && message.payload?.data) {
              this.updateBookmark(message.payload.id, message.payload.data);
            }
            break;
          case "UI_READY": // A UI is ready and requests initial data
            const targetUI = uiSource === 'overlay' ? this.overlay : (uiSource === 'sidebar' ? this.sidebar : this.standaloneWindow);
            const bookmarksForUI = this.getBookmarks(this.core.status.path || undefined); // Send bookmarks for current file
            targetUI.postMessage(JSON.stringify({ type: "BOOKMARKS_UPDATED", data: bookmarksForUI }));
            this.console.log(`Sent initial bookmarks to ${uiSource} for path: ${this.core.status.path}`);
            break;
          default:
            this.console.warn(`[${uiSource}] Unknown message type:`, message.type);
        }
      };
    };

    this.sidebar.onMessage(createHandler('sidebar'));
    this.overlay.onMessage(createHandler('overlay'));
    this.standaloneWindow.onMessage(createHandler('window'));
    this.console.log("UI Message Listeners are set up.");
  }

  private loadBookmarks(): void {
    try {
      const stored = this.preferences.get(this.STORAGE_KEY) as string;
      if (stored) {
        const parsedBookmarks = JSON.parse(stored) as BookmarkData[];
        this.bookmarks = parsedBookmarks.map(b => ({
            ...b,
            createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString()
        }));
      }
      this.console.log("Bookmarks loaded:", this.bookmarks.length);
    } catch (error: any) {
      this.console.error("Error loading bookmarks:", error.message);
      this.bookmarks = [];
    }
  }

  private saveBookmarks(): void {
    try {
      this.preferences.set(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
      this.console.log("Bookmarks saved.");
      this.refreshUIs();
    } catch (error: any) {
      this.console.error("Error saving bookmarks:", error.message);
    }
  }

  private refreshUIs(specificUI?: 'sidebar' | 'overlay' | 'window'): void {
    const currentPath = this.core.status.path;
    const bookmarksToSend = this.getBookmarks(currentPath || undefined);
    const message = { type: "BOOKMARKS_UPDATED", data: bookmarksToSend };
    const messageString = JSON.stringify(message);

    this.console.log(`Refreshing UIs. Specific: ${specificUI || 'all'}. Path: ${currentPath}. Count: ${bookmarksToSend.length}`);

    try {
      if (!specificUI || specificUI === 'sidebar') this.sidebar.postMessage(messageString);
      if (!specificUI || specificUI === 'overlay') this.overlay.postMessage(messageString);
      if (!specificUI || specificUI === 'window') this.standaloneWindow.postMessage(messageString);
    } catch (e: any) {
        this.console.warn("Could not refresh one or more UIs. They might not be loaded yet.", e.message);
    }
  }
  
  private setupEventListeners(): void {
    this.event.on("file-loaded", () => {
      this.console.log("File loaded event triggered.");
      this.refreshUIs(); 
    });

    this.menu.addItem(
      this.menu.item("Add Bookmark at Current Time", () => {
        this.addBookmark();
      })
    );
    this.menu.addItem(
      this.menu.item("Manage Bookmarks", () => {
        this.standaloneWindow.show();
      })
    );
    this.menu.addItem(
      this.menu.item("Toggle Bookmarks Overlay", () => {
        if (this.overlay.isVisible()) {
          this.overlay.hide();
        } else {
          this.refreshUIs('overlay'); // Send current bookmarks before showing specifically to overlay
          this.overlay.show();
        }
      })
    );
  }

  public addBookmark(title?: string, timestamp?: number, description?: string, tags?: string[]): void {
    const currentFile = this.core.status.path;
    const mediaTitle = this.core.status.title || "Unknown Media";
    const currentTime = timestamp ?? this.core.status.position;

    if (!currentFile) {
      this.console.log("Cannot add bookmark: No file loaded.");
      this.iina.postMessage("showNotification", { title: "Error", message: "No file loaded to add a bookmark.", type: "error" });
      return;
    }

    const bookmarkTitle = title || `Bookmark at ${this.formatTime(currentTime || 0)} (${mediaTitle})`;

    const bookmark: BookmarkData = {
      id: Date.now().toString(),
      title: bookmarkTitle,
      timestamp: currentTime || 0,
      filepath: currentFile,
      description: description || `Recorded on ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      tags: tags || [],
    };
    this.bookmarks.push(bookmark);
    this.saveBookmarks(); // This will call refreshUIs()
    this.console.log("Bookmark added:", bookmark.title);
    this.iina.postMessage("showNotification", { title: "Bookmark Added", message: bookmark.title });
  }

  public removeBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    this.saveBookmarks(); // This will call refreshUIs()
    this.console.log("Bookmark removed:", id);
    this.iina.postMessage("showNotification", { title: "Bookmark Removed" });
  }

  public updateBookmark(id: string, data: Partial<Omit<BookmarkData, 'id' | 'filepath' | 'createdAt'>>): void {
    const index = this.bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      // Preserve original filepath and id, only update allowed fields
      const originalBookmark = this.bookmarks[index];
      this.bookmarks[index] = {
        ...originalBookmark,
        ...data,
        id: originalBookmark.id, // ensure id is not changed by data
        filepath: originalBookmark.filepath, // ensure filepath is not changed by data
      };
      this.saveBookmarks(); // This will call refreshUIs()
      this.console.log("Bookmark updated:", id);
      this.iina.postMessage("showNotification", { title: "Bookmark Updated" });
    } else {
      this.console.log("Update failed: Bookmark not found", id);
    }
  }

  public jumpToBookmark(id: string): void {
    const bookmark = this.bookmarks.find((b) => b.id === id);
    if (bookmark) {
      if (this.core.status.path !== bookmark.filepath) {
        this.core.open(bookmark.filepath);
        this.event.once("file-loaded", () => {
          this.core.seek(bookmark.timestamp);
          this.refreshUIs('overlay'); // Refresh overlay after jump to new file
          this.overlay.show();
        });
      } else {
        this.core.seek(bookmark.timestamp);
        this.refreshUIs('overlay'); // Refresh overlay after jump in same file
        this.overlay.show();
      }
      this.console.log("Jumped to bookmark:", bookmark.title);
      this.standaloneWindow.hide(); // Hide management window after jumping
    } else {
      this.console.log("Jump failed: Bookmark not found", id);
    }
  }

  public getBookmarks(filePath?: string): BookmarkData[] {
    let relevantBookmarks = this.bookmarks;
    if (filePath) {
        relevantBookmarks = this.bookmarks.filter(b => b.filepath === filePath);
    }
    return [...relevantBookmarks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private formatTime(seconds: number): string {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
  }
}

// Main plugin entry point - only runs in IINA environment
if (typeof iina !== 'undefined') {
  const {
    standaloneWindow,
    overlay,
    sidebar,
    event,
    console,
    menu,
    core,
    preferences
  } = iina;

  // Create dependencies object for BookmarkManager
  const iinaRuntimeDeps = {
    standaloneWindow,
    overlay,
    sidebar,
    event,
    console,
    menu,
    core,
    preferences,
    iina
  };

  // Initialize the bookmark manager with IINA runtime dependencies
  new BookmarkManager(iinaRuntimeDeps);
  
  console.log("IINA Bookmarks Plugin with Comprehensive Filtering initialized successfully!");
} else {
  // Build-time or non-IINA environment
  console.log("IINA Bookmarks Plugin: Not running in IINA environment");
} 