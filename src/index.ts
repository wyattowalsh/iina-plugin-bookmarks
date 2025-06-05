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
  private readonly SORT_PREFERENCES_KEY = "sortPreferences";

  constructor() {
    this.loadBookmarks();
    this.loadSortPreferences();
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
          case "SAVE_SORT_PREFERENCES":
            if (message.payload?.preferences) {
              this.saveSortPreferences(message.payload.preferences);
            }
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

    // Enhanced metadata auto-population
    const metadata = this.generateBookmarkMetadata(currentFile, mediaTitle, currentTime || 0, title, description, tags);

    const bookmark: BookmarkData = {
      id: Date.now().toString(),
      title: metadata.title,
      timestamp: currentTime || 0,
      filepath: currentFile,
      description: metadata.description,
      createdAt: new Date().toISOString(),
      tags: metadata.tags,
    };
    this.bookmarks.push(bookmark);
    this.saveBookmarks(); // This will call refreshUIs()
    console.log("Bookmark added:", bookmark.title);
    iina.postMessage("showNotification", { title: "Bookmark Added", message: bookmark.title });
  }

  private generateBookmarkMetadata(filepath: string, mediaTitle: string, timestamp: number, userTitle?: string, userDescription?: string, userTags?: string[]) {
    // Extract filename and extension for analysis
    const filename = filepath.split('/').pop() || 'unknown';
    const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Generate intelligent title
    let autoTitle = userTitle;
    if (!autoTitle) {
      // Try to extract meaningful title from media title or filename
      if (mediaTitle && mediaTitle !== "Unknown Media" && !mediaTitle.includes(filename)) {
        autoTitle = `${mediaTitle} - ${this.formatTime(timestamp)}`;
      } else {
        // Clean up filename for better title
        const cleanTitle = filenameWithoutExt
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
        autoTitle = `${cleanTitle} - ${this.formatTime(timestamp)}`;
      }
    }

    // Generate intelligent description
    let autoDescription = userDescription;
    if (!autoDescription) {
      const fileType = this.getMediaType(fileExtension);
      const timeOfDay = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = new Date().toLocaleDateString();
      
      autoDescription = `${fileType} bookmark created at ${timeOfDay} on ${date}`;
      
      // Add context based on timestamp
      if (timestamp < 300) { // First 5 minutes
        autoDescription += " (Opening scene)";
      } else if (timestamp > 0) {
        const minutes = Math.floor(timestamp / 60);
        autoDescription += ` (${minutes} minutes in)`;
      }
    }

    // Generate intelligent tags
    let autoTags = userTags || [];
    if (!userTags || userTags.length === 0) {
      autoTags = this.generateAutoTags(filepath, fileExtension, mediaTitle, timestamp);
    }

    return {
      title: autoTitle,
      description: autoDescription,
      tags: autoTags
    };
  }

  private getMediaType(extension: string): string {
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
    const documentaryKeywords = ['documentary', 'doc', 'nature', 'history', 'science'];
    
    if (videoExtensions.includes(extension)) {
      return 'Video';
    } else if (audioExtensions.includes(extension)) {
      return 'Audio';
    }
    return 'Media';
  }

  private generateAutoTags(filepath: string, extension: string, mediaTitle: string, timestamp: number): string[] {
    const tags: string[] = [];
    const pathLower = filepath.toLowerCase();
    const titleLower = mediaTitle.toLowerCase();
    
    // Media type tags
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'];
    
    if (videoExtensions.includes(extension)) {
      tags.push('video');
    } else if (audioExtensions.includes(extension)) {
      tags.push('audio');
    }

    // Content type detection from path
    if (pathLower.includes('movie') || pathLower.includes('film')) {
      tags.push('movie');
    }
    if (pathLower.includes('tv') || pathLower.includes('series') || pathLower.includes('episode')) {
      tags.push('tv-show');
    }
    if (pathLower.includes('documentary') || pathLower.includes('doc')) {
      tags.push('documentary');
    }
    if (pathLower.includes('music') || pathLower.includes('song') || pathLower.includes('album')) {
      tags.push('music');
    }
    if (pathLower.includes('tutorial') || pathLower.includes('training') || pathLower.includes('course')) {
      tags.push('educational');
    }
    if (pathLower.includes('work') || pathLower.includes('meeting') || pathLower.includes('presentation')) {
      tags.push('work');
    }

    // Genre detection from title and path
    const genreKeywords = {
      'action': ['action', 'fight', 'battle', 'war', 'combat'],
      'comedy': ['comedy', 'funny', 'humor', 'laugh', 'comic'],
      'drama': ['drama', 'dramatic', 'emotional'],
      'horror': ['horror', 'scary', 'fear', 'terror', 'zombie'],
      'sci-fi': ['sci-fi', 'science fiction', 'space', 'alien', 'future'],
      'thriller': ['thriller', 'suspense', 'mystery', 'crime'],
      'romance': ['romance', 'love', 'romantic', 'dating'],
      'adventure': ['adventure', 'quest', 'journey', 'explore'],
      'fantasy': ['fantasy', 'magic', 'wizard', 'dragon', 'medieval'],
      'animation': ['animation', 'animated', 'cartoon', 'anime']
    };

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(keyword => titleLower.includes(keyword) || pathLower.includes(keyword))) {
        tags.push(genre);
      }
    }

    // Temporal tags based on timestamp
    if (timestamp < 300) { // First 5 minutes
      tags.push('opening');
    } else if (timestamp < 600) { // First 10 minutes
      tags.push('beginning');
    }

    // Quality/resolution detection from filename
    if (pathLower.includes('4k') || pathLower.includes('2160p')) {
      tags.push('4k');
    } else if (pathLower.includes('1080p') || pathLower.includes('hd')) {
      tags.push('hd');
    } else if (pathLower.includes('720p')) {
      tags.push('720p');
    }

    // Language detection
    if (pathLower.includes('english') || pathLower.includes('en')) {
      tags.push('english');
    }
    if (pathLower.includes('subtitle') || pathLower.includes('sub')) {
      tags.push('subtitled');
    }

    // Remove duplicates and limit to reasonable number
    return [...new Set(tags)].slice(0, 5);
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

  private loadSortPreferences(): void {
    try {
      const preferencesData = iina.core.preference.get(this.SORT_PREFERENCES_KEY);
      if (preferencesData) {
        const preferences = JSON.parse(preferencesData);
        console.log("Sort preferences loaded:", preferences);
        // Send preferences to UIs
        this.refreshUIs();
      }
    } catch (error) {
      console.log("No existing sort preferences or failed to load:", error);
    }
  }

  private saveSortPreferences(preferences: any): void {
    try {
      iina.core.preference.set(this.SORT_PREFERENCES_KEY, JSON.stringify(preferences));
      console.log("Sort preferences saved:", preferences);
    } catch (error) {
      console.error("Failed to save sort preferences:", error);
    }
  }
}

// Initialize the plugin
new BookmarkManager(); 