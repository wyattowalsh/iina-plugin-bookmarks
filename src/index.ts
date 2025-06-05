import { BookmarkManager } from './bookmark-manager';

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
    console,
    preferences,
    core,
    event,
    menu,
    sidebar,
    overlay,
    standaloneWindow
  };

  // Initialize the bookmark manager with IINA runtime dependencies
  new BookmarkManager(iinaRuntimeDeps);
  
  console.log("IINA Bookmarks Plugin with Comprehensive Filtering initialized successfully!");
} else {
  // Build-time or non-IINA environment
  console.log("IINA Bookmarks Plugin: Not running in IINA environment");
} 