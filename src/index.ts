import {
  standaloneWindow,
  overlay,
  sidebar,
  event,
  console,
  menu,
  core,
  preferences,
  iina
} from "iina";

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

  constructor() {
    this.loadBookmarks();
    this.setupEventListeners();
    this.setupWebUI();
    this.setupUIMessageListeners();

    console.log("IINA Bookmarks Plugin initialized. Message passing enabled.");
  }

  private setupWebUI(): void {
    try {
      sidebar.loadFile("dist/ui/sidebar/index.html");
      overlay.loadFile("dist/ui/overlay/index.html");
      overlay.setClickable(true);
      overlay.hide();
      standaloneWindow.loadFile("dist/ui/window/index.html");
      console.log("Web UIs loaded successfully.");
    } catch (e: any) {
      console.error(`Error loading Web UIs: ${e.message}`);
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
            console.error(`[${uiSource}] Error parsing JSON message:`, messageContent, e);
            return;
          }
        } else if (typeof messageContent === 'object' && messageContent !== null && 'type' in messageContent) {
          message = messageContent as UIMessage;
        } else {
          console.warn(`[${uiSource}] Received non-standard message:`, messageContent);
          return;
        }
        
        console.log(`[${uiSource}] Received message:`, message);

        switch (message.type) {
          case "REQUEST_FILE_PATH":
            const currentPath = core.status.path;
            const responseTarget = uiSource === 'overlay' ? overlay : (uiSource === 'sidebar' ? sidebar : standaloneWindow);
            responseTarget.postMessage(JSON.stringify({ type: "CURRENT_FILE_PATH", data: currentPath }));
            break;
          case "JUMP_TO_BOOKMARK":
            if (message.payload?.id) {
              this.jumpToBookmark(message.payload.id);
            }
            break;
          case "HIDE_OVERLAY":
            overlay.hide();
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
            const targetUI = uiSource === 'overlay' ? overlay : (uiSource === 'sidebar' ? sidebar : standaloneWindow);
            const bookmarksForUI = this.getBookmarks(core.status.path || undefined); // Send bookmarks for current file
            targetUI.postMessage(JSON.stringify({ type: "BOOKMARKS_UPDATED", data: bookmarksForUI }));
            console.log(`Sent initial bookmarks to ${uiSource} for path: ${core.status.path}`);
            break;
          default:
            console.warn(`[${uiSource}] Unknown message type:`, message.type);
        }
      };
    };

    sidebar.onMessage(createHandler('sidebar'));
    overlay.onMessage(createHandler('overlay'));
    standaloneWindow.onMessage(createHandler('window'));
    console.log("UI Message Listeners are set up.");
  }

  private loadBookmarks(): void {
    try {
      const stored = preferences.get(this.STORAGE_KEY) as string;
      if (stored) {
        const parsedBookmarks = JSON.parse(stored) as BookmarkData[];
        this.bookmarks = parsedBookmarks.map(b => ({
            ...b,
            createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString()
        }));
      }
      console.log("Bookmarks loaded:", this.bookmarks.length);
    } catch (error: any) {
      console.error("Error loading bookmarks:", error.message);
      this.bookmarks = [];
    }
  }

  private saveBookmarks(): void {
    try {
      preferences.set(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
      console.log("Bookmarks saved.");
      this.refreshUIs();
    } catch (error: any) {
      console.error("Error saving bookmarks:", error.message);
    }
  }

  private refreshUIs(specificUI?: 'sidebar' | 'overlay' | 'window'): void {
    const currentPath = core.status.path;
    const bookmarksToSend = this.getBookmarks(currentPath || undefined);
    const message = { type: "BOOKMARKS_UPDATED", data: bookmarksToSend };
    const messageString = JSON.stringify(message);

    console.log(`Refreshing UIs. Specific: ${specificUI || 'all'}. Path: ${currentPath}. Count: ${bookmarksToSend.length}`);

    try {
      if (!specificUI || specificUI === 'sidebar') sidebar.postMessage(messageString);
      if (!specificUI || specificUI === 'overlay') overlay.postMessage(messageString);
      if (!specificUI || specificUI === 'window') standaloneWindow.postMessage(messageString);
    } catch (e: any) {
        console.warn("Could not refresh one or more UIs. They might not be loaded yet.", e.message);
    }
  }
  
  private setupEventListeners(): void {
    event.on("file-loaded", () => {
      console.log("File loaded event triggered.");
      this.refreshUIs(); 
    });

    menu.addItem(
      menu.item("Add Bookmark at Current Time", () => {
        this.addBookmark();
      })
    );
    menu.addItem(
      menu.item("Manage Bookmarks", () => {
        standaloneWindow.show();
      })
    );
    menu.addItem(
      menu.item("Toggle Bookmarks Overlay", () => {
        if (overlay.isVisible()) {
          overlay.hide();
        } else {
          this.refreshUIs('overlay'); // Send current bookmarks before showing specifically to overlay
          overlay.show();
        }
      })
    );
  }

  public addBookmark(title?: string, timestamp?: number, description?: string, tags?: string[]): void {
    const currentFile = core.status.path;
    const mediaTitle = core.status.title || "Unknown Media";
    const currentTime = timestamp ?? core.status.position;

    if (!currentFile) {
      console.log("Cannot add bookmark: No file loaded.");
      iina.postMessage("showNotification", { title: "Error", message: "No file loaded to add a bookmark.", type: "error" });
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
    console.log("Bookmark added:", bookmark.title);
    iina.postMessage("showNotification", { title: "Bookmark Added", message: bookmark.title });
  }

  public removeBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    this.saveBookmarks(); // This will call refreshUIs()
    console.log("Bookmark removed:", id);
    iina.postMessage("showNotification", { title: "Bookmark Removed" });
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
      console.log("Bookmark updated:", id);
      iina.postMessage("showNotification", { title: "Bookmark Updated" });
    } else {
      console.log("Update failed: Bookmark not found", id);
    }
  }

  public jumpToBookmark(id: string): void {
    const bookmark = this.bookmarks.find((b) => b.id === id);
    if (bookmark) {
      if (core.status.path !== bookmark.filepath) {
        core.open(bookmark.filepath);
        event.once("file-loaded", () => {
          core.seek(bookmark.timestamp);
          this.refreshUIs('overlay'); // Refresh overlay after jump to new file
          overlay.show();
        });
      } else {
        core.seek(bookmark.timestamp);
        this.refreshUIs('overlay'); // Refresh overlay after jump in same file
        overlay.show();
      }
      console.log("Jumped to bookmark:", bookmark.title);
      standaloneWindow.hide(); // Hide management window after jumping
    } else {
      console.log("Jump failed: Bookmark not found", id);
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

// Initialize the plugin
new BookmarkManager(); 