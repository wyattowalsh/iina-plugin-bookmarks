import { BookmarkManager } from './bookmark-manager';

// Global declarations for IINA environment
declare global {
  const iina: any;
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
  
  console.log("IINA Bookmarks Plugin with Enhanced Metadata Detection initialized successfully!");
} else {
  // Build-time or non-IINA environment
  console.log("IINA Bookmarks Plugin: Not running in IINA environment");
} 