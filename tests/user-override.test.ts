import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IINARuntimeDependencies } from '../src/types';
import { BookmarkManager } from '../src/bookmark-manager';
import { createMockDeps as _createMockDeps } from './helpers/mock-deps';

/** Wrapper with user-override-specific defaults (movie path + 30 min playback) */
function createMockDeps(): IINARuntimeDependencies {
  const deps = _createMockDeps();
  (deps.core.status as any).path = '/test/video/Sample.Movie.2023.1080p.BluRay.x264.mp4';
  (deps.core.status as any).currentTime = 1800;
  return deps;
}

describe('User Override Capabilities', () => {
  let deps: IINARuntimeDependencies;
  let manager: BookmarkManager;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    manager = new BookmarkManager(deps);
  });

  it('should use auto-generated defaults when no overrides provided', async () => {
    await manager.addBookmark();

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks).toHaveLength(1);

    // Title should be auto-generated from filename + timestamp
    expect(bookmarks[0].title).toContain('Sample.Movie.2023.1080p.BluRay.x264');
    expect(bookmarks[0].title).toContain('30:00');
    // Description should be auto-generated
    expect(bookmarks[0].description).toContain('Bookmark at');
    expect(bookmarks[0].description).toContain('30:00');
    // Timestamp should default to currentTime
    expect(bookmarks[0].timestamp).toBe(1800);
    // Filepath should come from core.status.path
    expect(bookmarks[0].filepath).toBe('/test/video/Sample.Movie.2023.1080p.BluRay.x264.mp4');
  });

  it('should allow complete override of title', async () => {
    const customTitle = 'My Custom Bookmark Title';
    await manager.addBookmark(customTitle, 1800, 'Custom description', ['custom-tag']);

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe(customTitle);
    expect(bookmarks[0].title).not.toContain('Sample.Movie'); // Not using default
  });

  it('should allow complete override of description', async () => {
    const customDescription =
      'This is my completely custom description that has nothing to do with the auto-generated one';
    await manager.addBookmark('Custom Title', 1800, customDescription, ['test']);

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks[0].description).toBe(customDescription);
    expect(bookmarks[0].description).not.toContain('Bookmark at'); // Not using default
  });

  it('should allow complete override of tags', async () => {
    const customTags = ['completely', 'custom', 'tags', 'no-auto-tags'];
    await manager.addBookmark('Custom Title', 1800, 'Custom description', customTags);

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks[0].tags).toEqual(customTags);
  });

  it('should allow override of timestamp', async () => {
    const customTimestamp = 3600; // 1 hour instead of 30 minutes
    await manager.addBookmark('Custom Title', customTimestamp, 'Custom description', ['test']);

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks[0].timestamp).toBe(customTimestamp);
    expect(bookmarks[0].timestamp).not.toBe(1800); // Not using current time
  });

  it('should allow partial overrides while keeping some defaults', async () => {
    // Override only title, keep other defaults
    const customTitle = 'Only Title Changed';
    await manager.addBookmark(customTitle); // Other params undefined = use defaults

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks[0].title).toBe(customTitle);
    expect(bookmarks[0].timestamp).toBe(1800); // Should use current time default
    expect(bookmarks[0].description).toContain('Bookmark at'); // Should use auto-generated description
  });

  it('should handle empty string overrides by falling back to defaults', async () => {
    // When empty title is passed, the modern BookmarkManager will generate one
    await manager.addBookmark('', 1800, '', []);

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks).toHaveLength(1);
    // Empty title means auto-generate: should contain filename
    expect(bookmarks[0].title).toContain('Sample.Movie');
    // Empty description means auto-generate: should contain "Bookmark at"
    expect(bookmarks[0].description).toContain('Bookmark at');
  });

  it('should preserve user overrides exactly as provided', async () => {
    const userOverrides = {
      title: "User's Exact Title with Special Characters !@#$%",
      description: "User's exact description with\nnewlines and\ttabs",
      tags: ['user-tag-1', 'user-tag-2', 'special!@#'],
      timestamp: 2500,
    };

    await manager.addBookmark(
      userOverrides.title,
      userOverrides.timestamp,
      userOverrides.description,
      userOverrides.tags,
    );

    const bookmarks = manager.getAllBookmarks();
    expect(bookmarks[0].title).toBe(userOverrides.title);
    expect(bookmarks[0].description).toBe(userOverrides.description);
    expect(bookmarks[0].tags).toEqual(userOverrides.tags);
    expect(bookmarks[0].timestamp).toBe(userOverrides.timestamp);
  });
});
