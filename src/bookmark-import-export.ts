// Bookmark Import/Export
// Handles importing bookmarks from external data and exporting to JSON/CSV

import {
  MAX_TIMESTAMP,
  type BookmarkData,
  type BookmarkCollection,
  type SmartCollection,
  type ImportOptions,
  type ImportResult,
  type IINAConsole,
} from './types';
import { stripHtmlTags, validateBookmarkArray } from './utils/validation';

/** Prefix CSV-dangerous leading characters with a single quote to prevent formula injection */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/** Sanitize and construct a BookmarkData from a validated import entry */
function sanitizeImportedBookmark(
  raw: BookmarkData,
  id: string,
  ts: number,
  createdAt: string,
  now: string,
): BookmarkData {
  const bookmark: BookmarkData = {
    id,
    title: stripHtmlTags(String(raw.title || 'Imported Bookmark')),
    timestamp: ts,
    filepath: String(raw.filepath || ''),
    description: raw.description ? stripHtmlTags(String(raw.description)) : undefined,
    createdAt,
    updatedAt: now,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t: unknown) => stripHtmlTags(String(t))) : [],
  };
  // Preserve annotation fields
  if (raw.color) bookmark.color = raw.color;
  if (typeof raw.endTimestamp === 'number') bookmark.endTimestamp = raw.endTimestamp;
  if (typeof raw.pinned === 'boolean') bookmark.pinned = raw.pinned;
  if (raw.chapterTitle) bookmark.chapterTitle = raw.chapterTitle;
  if (raw.subtitleText) bookmark.subtitleText = raw.subtitleText;
  if (typeof raw.scratchpad === 'boolean') bookmark.scratchpad = raw.scratchpad;
  if (raw.thumbnailPath) bookmark.thumbnailPath = raw.thumbnailPath;
  return bookmark;
}

export class BookmarkImportExport {
  constructor(private console: IINAConsole) {}

  import(
    existingBookmarks: BookmarkData[],
    rawBookmarks: unknown[],
    options?: ImportOptions,
    generateId?: () => string,
  ): { bookmarks: BookmarkData[]; result: ImportResult } {
    const validated = validateBookmarkArray(rawBookmarks, this.console);
    const duplicateHandling = options?.duplicateHandling || 'skip';
    const preserveIds = options?.preserveIds ?? false;
    let imported = 0;
    let skipped = 0;

    // Work on a copy to avoid mutating the caller's array
    const bookmarks = [...existingBookmarks];

    for (const raw of validated) {
      const ts = typeof raw.timestamp === 'number' ? raw.timestamp : 0;
      if (!Number.isFinite(ts) || ts < 0 || ts > MAX_TIMESTAMP) continue;

      const now = new Date().toISOString();
      const bookmarkId =
        preserveIds && raw.id
          ? raw.id
          : generateId
            ? generateId()
            : `import-${Date.now()}-${imported + skipped}`;

      // Check for duplicates by id
      const existingIndex = bookmarks.findIndex((b) => b.id === bookmarkId || b.id === raw.id);

      if (existingIndex !== -1) {
        if (duplicateHandling === 'skip') {
          skipped++;
          continue;
        } else if (duplicateHandling === 'replace') {
          bookmarks[existingIndex] = sanitizeImportedBookmark(
            raw,
            bookmarks[existingIndex].id,
            ts,
            raw.createdAt || bookmarks[existingIndex].createdAt,
            now,
          );
          imported++;
          continue;
        } else if (duplicateHandling === 'merge') {
          const existing = bookmarks[existingIndex];
          const newTags = Array.isArray(raw.tags)
            ? raw.tags.map((t: unknown) => stripHtmlTags(String(t)))
            : [];
          const mergedTags = [...new Set([...existing.tags, ...newTags])];
          bookmarks[existingIndex] = {
            ...existing,
            tags: mergedTags,
            updatedAt: now,
          };
          imported++;
          continue;
        }
      }

      bookmarks.push(sanitizeImportedBookmark(raw, bookmarkId, ts, raw.createdAt || now, now));
      imported++;
    }

    return {
      bookmarks,
      result: {
        success: true,
        importedCount: imported,
        skippedCount: skipped,
        errorCount: 0,
      },
    };
  }

  exportJSON(bookmarks: BookmarkData[]): string {
    return JSON.stringify(bookmarks, null, 2);
  }

  exportJSONv2(
    bookmarks: BookmarkData[],
    collections: BookmarkCollection[],
    smartCollections: SmartCollection[],
  ): string {
    return JSON.stringify({ version: 2, bookmarks, collections, smartCollections }, null, 2);
  }

  /**
   * Detect whether parsed JSON is a v2 export (object with version: 2)
   * or a v1 export (plain bookmark array). Returns a normalized structure.
   */
  static parseExport(data: unknown): {
    version: 1 | 2;
    bookmarks: unknown[];
    collections?: BookmarkCollection[];
    smartCollections?: SmartCollection[];
  } {
    if (
      data !== null &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (data as Record<string, unknown>).version === 2
    ) {
      const obj = data as Record<string, unknown>;
      return {
        version: 2,
        bookmarks: Array.isArray(obj.bookmarks) ? obj.bookmarks : [],
        collections: Array.isArray(obj.collections)
          ? (obj.collections as BookmarkCollection[])
          : [],
        smartCollections: Array.isArray(obj.smartCollections)
          ? (obj.smartCollections as SmartCollection[])
          : [],
      };
    }
    // v1: plain array of bookmarks
    return {
      version: 1,
      bookmarks: Array.isArray(data) ? data : [],
    };
  }

  exportCSV(bookmarks: BookmarkData[]): string {
    const header = 'id,title,timestamp,filepath,description,createdAt,updatedAt,tags';
    const rows = bookmarks.map((b) => {
      return [
        sanitizeCsvCell(b.id),
        sanitizeCsvCell(b.title),
        String(b.timestamp),
        sanitizeCsvCell(b.filepath),
        sanitizeCsvCell(b.description || ''),
        sanitizeCsvCell(b.createdAt),
        sanitizeCsvCell(b.updatedAt),
        sanitizeCsvCell(b.tags.join(';')),
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(',');
    });

    return [header, ...rows].join('\n');
  }
}
