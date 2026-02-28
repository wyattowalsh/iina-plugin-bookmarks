// IINA Plugin Bookmarks - Entry Point
// ES6 Module implementation following IINA plugin guidelines (Sept 2025)

import { errorMessage, type IINARuntimeDependencies } from './types';
import { BookmarkManager } from './bookmark-manager';

// Plugin initialization function
export function plugin(): void {
  // Access IINA runtime (available as global variable in IINA context)
  const iina = (globalThis as any).iina;

  if (!iina) {
    throw new Error('IINA runtime not available');
  }

  const log = iina.console as {
    log: (m: string) => void;
    error: (m: string) => void;
    warn: (m: string) => void;
  };
  log.log('IINA Plugin Bookmarks - Starting initialization');

  try {
    const deps: IINARuntimeDependencies = {
      console: iina.console,
      core: iina.core,
      preferences: iina.preferences,
      menu: iina.menu,
      event: iina.event,
      sidebar: iina.sidebar,
      overlay: iina.overlay,
      standaloneWindow: iina.standaloneWindow,
      utils: iina.utils,
      file: iina.file,
      mpv: iina.mpv,
      playlist: iina.playlist,
    };

    const bookmarkManager = new BookmarkManager(deps);

    log.log('IINA Plugin Bookmarks - Initialization completed successfully');

    // Store reference globally for debugging
    (globalThis as any).bookmarkManager = bookmarkManager;
  } catch (error) {
    const errMsg = errorMessage(error);
    log.error(`IINA Plugin Bookmarks - Initialization failed: ${errMsg}`);
    throw error;
  }
}

// Auto-initialize if running in IINA context
if (typeof (globalThis as any).iina !== 'undefined') {
  plugin();
} else {
  // Cannot use iina.console here since iina is not available
  // This is acceptable -- the warning only triggers outside IINA
}
