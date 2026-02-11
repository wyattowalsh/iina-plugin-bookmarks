/**
 * Performance optimization utilities for bookmark operations
 */

export class PerformanceUtils {
  private static performanceMarks = new Map<string, number>();

  /**
   * Debounce function to prevent excessive calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        func(...args);
        timeoutId = null;
      }, delay);
    };
  }

  /**
   * Throttle function to limit execution frequency
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let lastExecuted = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>): void => {
      const now = Date.now();

      if (now - lastExecuted >= delay) {
        func(...args);
        lastExecuted = now;
      } else if (!timeoutId) {
        timeoutId = setTimeout(
          () => {
            func(...args);
            lastExecuted = Date.now();
            timeoutId = null;
          },
          delay - (now - lastExecuted),
        );
      }
    };
  }

  /**
   * Batch process array in chunks to prevent blocking
   */
  static async batchProcess<T, R>(
    items: T[],
    processor: (item: T, index: number) => R | Promise<R>,
    batchSize: number = 100,
    delayBetweenBatches: number = 0,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item, index) => processor(item, i + index)),
      );

      results.push(...batchResults);

      // Allow other operations to run between batches
      if (delayBetweenBatches > 0 && i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Memoize function results with LRU cache
   */
  static memoize<T extends (...args: any[]) => any>(func: T, maxSize: number = 100): T {
    const cache = new Map<string, { result: ReturnType<T>; timestamp: number }>();
    const accessOrder: string[] = [];

    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = JSON.stringify(args);

      // Check cache hit
      if (cache.has(key)) {
        // Move to end (most recently used)
        const index = accessOrder.indexOf(key);
        if (index > -1) {
          accessOrder.splice(index, 1);
        }
        accessOrder.push(key);
        return cache.get(key)!.result;
      }

      // Cache miss - compute result
      const result = func(...args);

      // Add to cache
      cache.set(key, { result, timestamp: Date.now() });
      accessOrder.push(key);

      // Evict LRU if cache is full
      if (cache.size > maxSize) {
        const lruKey = accessOrder.shift()!;
        cache.delete(lruKey);
      }

      return result;
    }) as T;
  }

  /**
   * Start performance measurement
   */
  static startMark(name: string): void {
    this.performanceMarks.set(name, performance.now());
  }

  /**
   * End performance measurement and return duration
   */
  static endMark(name: string): number {
    const start = this.performanceMarks.get(name);
    if (!start) {
      throw new Error(`Performance mark '${name}' not found`);
    }

    const duration = performance.now() - start;
    this.performanceMarks.delete(name);
    return duration;
  }

  /**
   * Measure execution time of a function
   */
  static async measureAsync<T>(
    name: string,
    func: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    this.startMark(name);
    const result = await func();
    const duration = this.endMark(name);
    return { result, duration };
  }

  /**
   * Measure execution time of a synchronous function
   */
  static measure<T>(name: string, func: () => T): { result: T; duration: number } {
    this.startMark(name);
    const result = func();
    const duration = this.endMark(name);
    return { result, duration };
  }

  /**
   * Efficient array chunking
   */
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Deep clone object efficiently
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map((item) => this.deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as { [key: string]: any };
      Object.keys(obj).forEach((key) => {
        cloned[key] = this.deepClone((obj as any)[key]);
      });
      return cloned as T;
    }

    return obj;
  }

  /**
   * Efficient object property access with path
   */
  static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if arrays are equal (shallow comparison)
   */
  static arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }

    return true;
  }

  /**
   * Remove duplicates from array efficiently
   */
  static removeDuplicates<T>(array: T[], keyExtractor?: (item: T) => any): T[] {
    if (!keyExtractor) {
      return [...new Set(array)];
    }

    const seen = new Set();
    return array.filter((item) => {
      const key = keyExtractor(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Efficient binary search for sorted arrays
   */
  static binarySearch<T>(array: T[], target: T, compareFn: (a: T, b: T) => number): number {
    let left = 0;
    let right = array.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const comparison = compareFn(array[mid], target);

      if (comparison === 0) {
        return mid;
      } else if (comparison < 0) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return -1; // Not found
  }

  /**
   * Calculate memory usage estimation
   */
  static estimateMemoryUsage(obj: any): number {
    const seen = new WeakSet();

    function sizeOf(obj: any): number {
      if (obj === null || obj === undefined) return 0;

      if (typeof obj === 'boolean') return 4;
      if (typeof obj === 'number') return 8;
      if (typeof obj === 'string') return obj.length * 2;

      if (typeof obj === 'object') {
        if (seen.has(obj)) {
          return 0; // Avoid circular references
        }
        seen.add(obj);

        let size = 0;

        if (Array.isArray(obj)) {
          size = obj.reduce((acc, item) => acc + sizeOf(item), 0);
        } else {
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              size += sizeOf(key) + sizeOf(obj[key]);
            }
          }
        }

        return size;
      }

      return 0;
    }

    return sizeOf(obj);
  }
}
