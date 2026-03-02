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
export type ExportFormat = 'json' | 'csv';
export type ReconciliationAction = 'update_path' | 'remove_bookmark' | 'search_similar';
export type DuplicateHandling = 'skip' | 'replace' | 'merge';
export type BookmarkColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'grey';
export type BatchTagAction = 'add' | 'remove';
export type CollectionAssignAction = 'add' | 'remove';
export type BookmarkNavigationScope = 'file' | 'all';

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
  color?: BookmarkColor;
  endTimestamp?: number;
  pinned?: boolean;
  thumbnailPath?: string;
  chapterTitle?: string;
  subtitleText?: string;
  scratchpad?: boolean;
}

export interface ChapterInfo {
  title: string;
  time: number;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  bookmarkIds: string[];
  color?: BookmarkColor;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmartCollectionFilters {
  searchTerm?: string;
  fileFilter?: string;
  tags?: string[];
  showOnlyUntagged?: boolean;
  showOnlyPinned?: boolean;
  showOnlyRangeBookmarks?: boolean;
  showOnlyScratchpad?: boolean;
  dateRange?: { start: string; end: string };
}

export interface SmartCollection {
  id: string;
  name: string;
  description?: string;
  filters: SmartCollectionFilters;
  color?: BookmarkColor;
  icon?: string;
  createdAt: string;
  usageCount: number;
  builtin?: boolean;
}

export interface PlaybackStatus {
  duration: number;
  position: number;
  chapters: ChapterInfo[];
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

export type ExportResult =
  | {
      success: true;
      format: ExportFormat;
      content: string;
    }
  | {
      success: false;
      error: string;
      format?: ExportFormat;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExportFormat(value: unknown): value is ExportFormat {
  return value === 'json' || value === 'csv';
}

export function normalizeExportResult(payload: unknown): ExportResult {
  if (!isRecord(payload)) {
    return { success: false, error: 'Invalid export result payload' };
  }

  const format = isExportFormat(payload.format) ? payload.format : undefined;
  const content =
    typeof payload.content === 'string'
      ? payload.content
      : typeof payload.data === 'string'
        ? payload.data
        : undefined;
  const error = typeof payload.error === 'string' ? payload.error : undefined;

  if (payload.success === false || (!content && error)) {
    return {
      success: false,
      ...(format ? { format } : {}),
      error: error || 'Export failed',
    };
  }

  if (format && content !== undefined) {
    return { success: true, format, content };
  }

  return {
    success: false,
    ...(format ? { format } : {}),
    error: error || 'Invalid export result payload',
  };
}

export interface BookmarkUpdatableFields {
  title?: string;
  description?: string;
  tags?: string[];
  color?: BookmarkColor;
  endTimestamp?: number;
  pinned?: boolean;
  scratchpad?: boolean;
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
  ADD_BOOKMARK: {
    title?: string;
    timestamp?: number;
    description?: string;
    tags?: string[];
    color?: BookmarkColor;
    endTimestamp?: number;
  };
  DELETE_BOOKMARK: { id: string };
  JUMP_TO_BOOKMARK: { id: string };
  UPDATE_BOOKMARK: { id: string; data: BookmarkUpdatableFields };
  HIDE_OVERLAY: undefined;
  IMPORT_BOOKMARKS: {
    bookmarks: unknown[];
    options?: ImportOptions;
    collections?: BookmarkCollection[];
    smartCollections?: SmartCollection[];
  };
  EXPORT_BOOKMARKS: { format?: ExportFormat };
  FILE_RECONCILIATION_REQUEST: {
    action: ReconciliationAction;
    bookmarkId: string;
    newPath?: string;
    originalPath?: string;
  };
  RECONCILE_FILES: undefined;
  REQUEST_BOOKMARK_DEFAULTS: undefined;
  SAVE_SORT_PREFERENCES: { preferences: SortPreferences };

  // Collections
  CREATE_COLLECTION: { name: string; description?: string; color?: BookmarkColor; icon?: string };
  UPDATE_COLLECTION: { id: string; data: Partial<Omit<BookmarkCollection, 'id' | 'createdAt'>> };
  DELETE_COLLECTION: { id: string };
  CREATE_SMART_COLLECTION: {
    name: string;
    description?: string;
    filters: SmartCollectionFilters;
    color?: BookmarkColor;
    icon?: string;
  };
  UPDATE_SMART_COLLECTION: {
    id: string;
    data: Partial<Omit<SmartCollection, 'id' | 'createdAt' | 'builtin'>>;
  };
  DELETE_SMART_COLLECTION: { id: string };
  ADD_TO_COLLECTION: { bookmarkIds: string[]; collectionId: string };
  REMOVE_FROM_COLLECTION: { bookmarkIds: string[]; collectionId: string };

  // Batch operations
  BATCH_DELETE: { ids: string[] };
  BATCH_TAG: { ids: string[]; tags: string[]; action: BatchTagAction };
  BATCH_ASSIGN_COLLECTION: { ids: string[]; collectionId: string; action: CollectionAssignAction };
  BATCH_PIN: { ids: string[]; pinned: boolean };
  BATCH_COLOR: { ids: string[]; color: BookmarkColor };

  // Navigation
  NEXT_BOOKMARK: { currentId: string; scope: BookmarkNavigationScope };
  PREV_BOOKMARK: { currentId: string; scope: BookmarkNavigationScope };

  // Range & loop
  SET_AB_LOOP: { bookmarkId: string };
  CLEAR_AB_LOOP: undefined;

  // Thumbnails
  REQUEST_THUMBNAIL: { bookmarkId: string };

  // Scratchpad
  PROMOTE_SCRATCHPAD: { ids: string[] };
  DISCARD_SCRATCHPAD: { ids: string[] };

  // Duplicate resolution
  CONFIRM_BOOKMARK: {
    title?: string;
    timestamp?: number;
    description?: string;
    tags?: string[];
    color?: BookmarkColor;
  };
  MERGE_BOOKMARK: { existingId: string; mergeData: BookmarkUpdatableFields };

  // Range bookmark I/O marking
  SET_IN_POINT: undefined;
  SET_OUT_POINT: undefined;

  // Direct seek (from timeline click on empty space)
  SEEK_TO_TIMESTAMP: { timestamp: number };
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
  EXPORT_RESULT: ExportResult;
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

  // Collections
  COLLECTIONS_UPDATED: BookmarkCollection[];
  SMART_COLLECTIONS_UPDATED: SmartCollection[];

  // Playback
  PLAYBACK_STATUS: PlaybackStatus;

  // Auto-resume
  RESUME_POSITION: { filepath: string; timestamp: number };

  // Duplicate detection
  BOOKMARK_NEAR_DUPLICATE: {
    existingBookmark: BookmarkData;
    proposedTimestamp: number;
    distance: number;
  };

  // Thumbnails
  THUMBNAIL_READY: { bookmarkId: string; path: string };

  // Quick bookmark
  QUICK_BOOKMARK_CREATED: { bookmarkId: string; timestamp: number };
}

// ---------------------------------------------------------------------------
// IINA plugin API interfaces
// ---------------------------------------------------------------------------

export interface IINACore {
  status: {
    path?: string;
    currentTime?: number;
    duration?: number;
    position?: number;
    metadata?: {
      title?: string;
    };
  };
  window?: { loaded: boolean };
  seek?: (time: number, exact?: boolean) => void;
  seekTo?: (seconds: number) => void;
  osd?: (message: string) => void;
  open?: (url: string) => void;
  getChapters?: () => ChapterInfo[];
}

export interface IINAConsole {
  log: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

export interface IINAPreferences {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  sync?: () => void;
}

export interface IINAMenu {
  addItem: (item: any) => void;
  item: (title: string, action: () => void, options?: { keyBinding?: string }) => any;
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

export interface IINAMpv {
  set?: (property: string, value: string | number) => void;
  getString?: (property: string) => string | undefined;
}

export interface IINAPlaylist {
  registerMenuBuilder?: (builder: (items: any[]) => any[]) => void;
}

export interface IINAUtils {
  ask: (question: string) => boolean;
  prompt: (question: string) => string | null;
  chooseFile: (title: string, options?: any) => string | null;
  exec?: (file: string, args: string[]) => void;
}

export interface IINAFile {
  read: (path: string) => string;
  write: (path: string, content: string) => void;
  exists: (path: string) => boolean;
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
  mpv?: IINAMpv;
  playlist?: IINAPlaylist;
}
