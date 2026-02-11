// IINA Plugin Bookmarks - Modern TypeScript Entry Point
// ES6 Module implementation following IINA plugin guidelines (Sept 2025)

import type { IINARuntimeDependencies } from './types';
import { BookmarkManager } from './bookmark-manager-modern';

// Plugin initialization function
export function plugin(): void {
  console.log('🚀 IINA Plugin Bookmarks - Starting initialization (Modern TypeScript)');

  try {
    // Access IINA runtime (available as global variable in IINA context)
    const iinaRuntime = (globalThis as any).iina as IINARuntimeDependencies;

    // Validate IINA runtime availability
    if (!iinaRuntime) {
      throw new Error('IINA runtime not available');
    }

    // Log available IINA API components
    const availableAPIs = Object.keys(iinaRuntime).join(', ');
    console.log('📋 Available IINA APIs:', availableAPIs);

    // Initialize the bookmark manager
    const bookmarkManager = new BookmarkManager(iinaRuntime);

    console.log('✅ IINA Plugin Bookmarks - Initialization completed successfully');

    // Store reference globally for debugging
    (globalThis as any).bookmarkManager = bookmarkManager;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ IINA Plugin Bookmarks - Initialization failed:', errorMessage);

    // Log additional debug information
    console.error('🔍 Debug info:');
    console.error('  - typeof iina:', typeof (globalThis as any).iina);
    console.error('  - globalThis keys:', Object.keys(globalThis));

    throw error;
  }
}

// Auto-initialize if running in IINA context
if (typeof (globalThis as any).iina !== 'undefined') {
  plugin();
} else {
  console.warn('⚠️ IINA runtime not detected - plugin will initialize when loaded by IINA');
}
