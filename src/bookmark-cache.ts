/**
 * Bookmark Cache for optimized storage and retrieval
 * Implements efficient data structures and caching strategies
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface BookmarkIndex {
  byId: Map<string, number>;
  byFilePath: Map<string, number[]>;
  byTitle: Map<string, number[]>;
  byTags: Map<string, number[]>;
  byTimestamp: Map<number, number>;
}

export class BookmarkCache {
  private cache = new Map<string, CacheEntry<any>>();
  private index: BookmarkIndex = {
    byId: new Map(),
    byFilePath: new Map(),
    byTitle: new Map(),
    byTags: new Map(),
    byTimestamp: new Map()
  };

  /**
   * Set cached data with TTL support
   */
  set<T>(key: string, data: T, ttl: number = 300000 /* 5 minutes */): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cached data with expiration check
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Build indexes for efficient searching
   */
  buildIndexes(bookmarks: any[]): void {
    // Clear existing indexes
    this.index.byId.clear();
    this.index.byFilePath.clear();
    this.index.byTitle.clear();
    this.index.byTags.clear();
    this.index.byTimestamp.clear();

    bookmarks.forEach((bookmark, index) => {
      // ID index
      this.index.byId.set(bookmark.id, index);

      // FilePath index
      const filePathEntries = this.index.byFilePath.get(bookmark.filepath) || [];
      filePathEntries.push(index);
      this.index.byFilePath.set(bookmark.filepath, filePathEntries);

      // Title index (normalized for fuzzy matching)
      const normalizedTitle = bookmark.title.toLowerCase().trim();
      const titleEntries = this.index.byTitle.get(normalizedTitle) || [];
      titleEntries.push(index);
      this.index.byTitle.set(normalizedTitle, titleEntries);

      // Tags index
      if (bookmark.tags && Array.isArray(bookmark.tags)) {
        bookmark.tags.forEach((tag: string) => {
          const normalizedTag = tag.toLowerCase().trim();
          const tagEntries = this.index.byTags.get(normalizedTag) || [];
          tagEntries.push(index);
          this.index.byTags.set(normalizedTag, tagEntries);
        });
      }

      // Timestamp index (rounded to nearest second for fuzzy matching)
      const roundedTimestamp = Math.round(bookmark.timestamp);
      this.index.byTimestamp.set(roundedTimestamp, index);
    });
  }

  /**
   * Fast lookup by ID
   */
  findByIdIndex(id: string): number | null {
    return this.index.byId.get(id) ?? null;
  }

  /**
   * Fast lookup by file path
   */
  findByFilePathIndex(filePath: string): number[] {
    return this.index.byFilePath.get(filePath) || [];
  }

  /**
   * Fast lookup by tags
   */
  findByTagsIndex(tags: string[]): Set<number> {
    const results = new Set<number>();
    
    tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase().trim();
      const entries = this.index.byTags.get(normalizedTag) || [];
      entries.forEach(index => results.add(index));
    });

    return results;
  }

  /**
   * Fast fuzzy search by timestamp (within tolerance)
   */
  findByTimestampIndex(timestamp: number, tolerance: number = 1.0): number[] {
    const results: number[] = [];
    const roundedTimestamp = Math.round(timestamp);
    
    // Check exact match first
    const exact = this.index.byTimestamp.get(roundedTimestamp);
    if (exact !== undefined) {
      results.push(exact);
    }

    // Check within tolerance range
    for (let i = 1; i <= Math.ceil(tolerance); i++) {
      const lower = this.index.byTimestamp.get(roundedTimestamp - i);
      const upper = this.index.byTimestamp.get(roundedTimestamp + i);
      
      if (lower !== undefined) results.push(lower);
      if (upper !== undefined) results.push(upper);
    }

    return results;
  }

  /**
   * Clear expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache and indexes
   */
  clear(): void {
    this.cache.clear();
    this.index.byId.clear();
    this.index.byFilePath.clear();
    this.index.byTitle.clear();
    this.index.byTags.clear();
    this.index.byTimestamp.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheSize: number;
    indexSizes: {
      byId: number;
      byFilePath: number;
      byTitle: number;
      byTags: number;
      byTimestamp: number;
    };
  } {
    return {
      cacheSize: this.cache.size,
      indexSizes: {
        byId: this.index.byId.size,
        byFilePath: this.index.byFilePath.size,
        byTitle: this.index.byTitle.size,
        byTags: this.index.byTags.size,
        byTimestamp: this.index.byTimestamp.size
      }
    };
  }
}