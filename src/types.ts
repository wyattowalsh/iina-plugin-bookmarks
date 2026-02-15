// IINA Plugin Types
// Type definitions for IINA plugin API (February 2026)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max reasonable timestamp: 365 days in seconds */
export const MAX_TIMESTAMP = 86400 * 365;

/** Extract a human-readable message from an unknown thrown value */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Literal union types
// ---------------------------------------------------------------------------

export type UISource = 'sidebar' | 'overlay' | 'window';
export type CloudProviderId = 'gdrive' | 'dropbox';
export type CloudSyncAction = 'upload' | 'download' | 'sync';
export type ExportFormat = 'json' | 'csv';
export type ReconciliationAction = 'update_path' | 'remove_bookmark' | 'search_similar';
export type DuplicateHandling = 'skip' | 'replace' | 'merge';

// ---------------------------------------------------------------------------
// Core data interfaces
// ---------------------------------------------------------------------------

export interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface CloudCredentials {
  apiKey?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface SortPreferences {
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

export interface ImportOptions {
  duplicateHandling?: DuplicateHandling;
  preserveIds?: boolean;
}

export interface BookmarkDefaults {
  title: string;
  description: string;
  tags: string[];
  timestamp: number;
  filepath: string;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: string[];
  duplicates?: number;
}

export interface BookmarkUpdatableFields {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface SyncStats {
  added: number;
  updated: number;
  conflicts: number;
  total: number;
}

export interface BackupMetadata {
  version: string;
  createdAt: string;
  totalBookmarks: number;
  device: string;
  userAgent: string;
}

// ---------------------------------------------------------------------------
// UI ↔ Backend messaging protocol
// ---------------------------------------------------------------------------

export interface UIMessage {
  type: string;
  payload?: Record<string, unknown>;
  sourceUI?: UISource;
}

/** Payload map for messages sent from UI → Backend (via iina.postMessage). */
export interface UIToBackendPayloadMap {
  UI_READY: { uiType: UISource };
  REQUEST_FILE_PATH: undefined;
  ADD_BOOKMARK: { title?: string; timestamp?: number; description?: string; tags?: string[] };
  DELETE_BOOKMARK: { id: string };
  JUMP_TO_BOOKMARK: { id: string };
  UPDATE_BOOKMARK: { id: string; data: BookmarkUpdatableFields };
  HIDE_OVERLAY: undefined;
  IMPORT_BOOKMARKS: { bookmarks: unknown[]; options?: ImportOptions };
  EXPORT_BOOKMARKS: { format?: ExportFormat };
  CLOUD_SYNC_REQUEST: {
    action: CloudSyncAction;
    provider: CloudProviderId;
    credentials: CloudCredentials;
  };
  FILE_RECONCILIATION_REQUEST: {
    action: ReconciliationAction;
    bookmarkId: string;
    newPath?: string;
    originalPath?: string;
  };
  RECONCILE_FILES: undefined;
  REQUEST_BOOKMARK_DEFAULTS: undefined;
  SAVE_SORT_PREFERENCES: { preferences: SortPreferences };
}

/** Payload map for messages sent from Backend → UI (via target.postMessage). */
export interface BackendToUIPayloadMap {
  BOOKMARKS_UPDATED: BookmarkData[];
  CURRENT_FILE_PATH: string;
  BOOKMARK_ADDED: Record<string, never>;
  BOOKMARK_DELETED: Record<string, never>;
  BOOKMARK_JUMPED: Record<string, never>;
  BOOKMARK_DEFAULTS: BookmarkDefaults;
  SORT_PREFERENCES: SortPreferences;
  IMPORT_RESULT: ImportResult;
  IMPORT_STARTED: undefined;
  EXPORT_RESULT: { format: ExportFormat; content: string };
  CLOUD_SYNC_RESULT: {
    success: boolean;
    action: CloudSyncAction;
    message?: string;
    error?: string;
    bookmarks?: BookmarkData[];
    backupId?: string;
    metadata?: BackupMetadata;
    syncStats?: SyncStats;
  };
  SHOW_CLOUD_SYNC_DIALOG: undefined;
  SHOW_FILE_RECONCILIATION_DIALOG: { movedFiles: BookmarkData[] };
  FILE_RECONCILIATION_RESULT: {
    success: boolean;
    action: ReconciliationAction;
    bookmarkId: string;
    oldPath?: string;
    newPath?: string;
    originalPath?: string;
    similarFiles?: string[];
    message?: string;
  };
  ERROR: { message: string };
}

// ---------------------------------------------------------------------------
// IINA plugin API interfaces
// ---------------------------------------------------------------------------

export interface IINACore {
  status: {
    path?: string;
    currentTime?: number;
    metadata?: {
      title?: string;
    };
  };
  seek?: (time: number, exact?: boolean) => void;
  seekTo?: (seconds: number) => void;
  osd?: (message: string) => void;
}

export interface IINAConsole {
  log: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

export interface IINAPreferences {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
}

export interface IINAMenu {
  addItem: (item: any) => void;
  item: (title: string, action: () => void) => any;
}

export interface IINAEvent {
  on: (event: string, callback: (...args: any[]) => void) => string;
  off: (event: string, id: string) => void;
}

export interface IINAUIAPI {
  loadFile: (path: string) => void;
  postMessage: (name: string, data?: any) => void;
  onMessage: (name: string, callback: (data: any) => void) => void;
}

export type IINASidebar = IINAUIAPI;

export interface IINAOverlay extends IINAUIAPI {
  setClickable: (clickable: boolean) => void;
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
}

export interface IINAStandaloneWindow extends IINAUIAPI {
  show: () => void;
}

export interface IINAUtils {
  ask: (question: string) => boolean;
  prompt: (question: string) => string | null;
  chooseFile: (title: string, options?: any) => string | null;
}

export interface IINAFile {
  read: (path: string) => string;
  write: (path: string, content: string) => void;
  exists: (path: string) => boolean;
}

/**
 * HTTP adapter interface that abstracts iina.http for cloud storage.
 * Methods mirror the IINA HTTP module's API shape.
 */
export interface HttpAdapter {
  get(
    url: string,
    options?: { headers?: Record<string, string>; params?: Record<string, string> },
  ): Promise<{ text: string; statusCode: number }>;
  post(
    url: string,
    options?: {
      headers?: Record<string, string>;
      data?: any;
      params?: Record<string, string>;
    },
  ): Promise<{ text: string; statusCode: number }>;
  put(
    url: string,
    options?: {
      headers?: Record<string, string>;
      data?: any;
      params?: Record<string, string>;
    },
  ): Promise<{ text: string; statusCode: number }>;
  patch(
    url: string,
    options?: {
      headers?: Record<string, string>;
      data?: any;
      params?: Record<string, string>;
    },
  ): Promise<{ text: string; statusCode: number }>;
  delete(
    url: string,
    options?: { headers?: Record<string, string>; params?: Record<string, string> },
  ): Promise<{ text: string; statusCode: number }>;
}

export interface IINARuntimeDependencies {
  console: IINAConsole;
  core: IINACore;
  preferences: IINAPreferences;
  menu: IINAMenu;
  event: IINAEvent;
  sidebar: IINASidebar;
  overlay: IINAOverlay;
  standaloneWindow: IINAStandaloneWindow;
  utils: IINAUtils;
  file: IINAFile;
  http: HttpAdapter;
}
