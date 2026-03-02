// Validation Utilities
// Shared validation and sanitization functions

import { MAX_TIMESTAMP, type BookmarkData, type IINAConsole } from '../types';

const SAFE_BOOKMARK_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Strip HTML tags to prevent XSS on import.
 * React's text interpolation provides additional escaping on the UI side.
 */
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

export function isSafeBookmarkId(id: string): boolean {
  return SAFE_BOOKMARK_ID_PATTERN.test(id);
}

export function isValidEndTimestamp(
  endTimestamp: unknown,
  startTimestamp: number,
): endTimestamp is number {
  return (
    typeof endTimestamp === 'number' &&
    Number.isFinite(endTimestamp) &&
    endTimestamp >= 0 &&
    endTimestamp <= MAX_TIMESTAMP &&
    endTimestamp >= startTimestamp
  );
}

export function isSafeThumbnailPath(thumbnailPath: unknown): thumbnailPath is string {
  return (
    typeof thumbnailPath === 'string' &&
    thumbnailPath.startsWith('@data/thumbs/') &&
    !thumbnailPath.includes('://') &&
    !thumbnailPath.includes('..')
  );
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
    if (!isSafeBookmarkId(obj.id)) {
      logger?.warn(`Bookmark entry ${i} has unsafe id, skipping`);
      continue;
    }
    const ts = Number(obj.timestamp);
    if (!Number.isFinite(ts) || ts < 0 || ts > MAX_TIMESTAMP) {
      logger?.warn(`Bookmark entry ${i} has invalid timestamp, skipping`);
      continue;
    }
    const bookmark: BookmarkData = {
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
    };
    // Preserve annotation fields
    if (typeof obj.color === 'string') bookmark.color = obj.color as BookmarkData['color'];
    if (isValidEndTimestamp(obj.endTimestamp, ts)) bookmark.endTimestamp = obj.endTimestamp;
    if (typeof obj.pinned === 'boolean') bookmark.pinned = obj.pinned;
    if (typeof obj.chapterTitle === 'string') bookmark.chapterTitle = obj.chapterTitle;
    if (typeof obj.subtitleText === 'string') bookmark.subtitleText = obj.subtitleText;
    if (typeof obj.scratchpad === 'boolean') bookmark.scratchpad = obj.scratchpad;
    if (isSafeThumbnailPath(obj.thumbnailPath)) {
      bookmark.thumbnailPath = obj.thumbnailPath;
    }
    valid.push(bookmark);
  }
  return valid;
}
