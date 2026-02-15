// Validation Utilities
// Shared validation and sanitization functions

import type { BookmarkData, IINAConsole } from '../types';

/**
 * Strip HTML tags to prevent XSS on import.
 * React's text interpolation provides additional escaping on the UI side.
 */
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/** Validate an unknown value as an array of BookmarkData, dropping invalid entries */
export function validateBookmarkArray(data: unknown, logger?: IINAConsole): BookmarkData[] {
  if (!Array.isArray(data)) {
    logger?.warn('Expected bookmark array but got ' + typeof data);
    return [];
  }

  const valid: BookmarkData[] = [];
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    if (!entry || typeof entry !== 'object') {
      logger?.warn(`Bookmark entry ${i} is not an object, skipping`);
      continue;
    }
    const obj = entry as Record<string, unknown>;
    if (
      typeof obj.id !== 'string' ||
      typeof obj.title !== 'string' ||
      typeof obj.filepath !== 'string' ||
      typeof obj.createdAt !== 'string' ||
      typeof obj.updatedAt !== 'string'
    ) {
      logger?.warn(`Bookmark entry ${i} missing required string fields, skipping`);
      continue;
    }
    const ts = Number(obj.timestamp);
    if (!Number.isFinite(ts) || ts < 0) {
      logger?.warn(`Bookmark entry ${i} has invalid timestamp, skipping`);
      continue;
    }
    valid.push({
      id: obj.id,
      title: obj.title,
      timestamp: ts,
      filepath: obj.filepath,
      description: typeof obj.description === 'string' ? obj.description : undefined,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
      tags: Array.isArray(obj.tags)
        ? obj.tags.filter((t): t is string => typeof t === 'string')
        : [],
    });
  }
  return valid;
}
