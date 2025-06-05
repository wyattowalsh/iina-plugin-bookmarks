import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('User Override Capabilities', () => {
  let mockDeps: any;
  let BookmarkManager: any;

  beforeEach(() => {
    // Reset modules to ensure clean state
    vi.resetModules();
    
    // Mock IINA dependencies
    mockDeps = {
      console: { 
        log: vi.fn(), 
        error: vi.fn(), 
        warn: vi.fn() 
      },
      preferences: { 
        get: vi.fn(() => null), 
        set: vi.fn() 
      },
      core: { 
        status: { 
          path: '/test/video/Sample.Movie.2023.1080p.BluRay.x264.mp4', 
          currentTime: 1800, // 30 minutes
          title: 'Sample Movie (2023)'
        } 
      },
      event: { on: vi.fn() },
      menu: { addItem: vi.fn(), item: vi.fn(() => ({})) },
      sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
      overlay: { 
        loadFile: vi.fn(), 
        postMessage: vi.fn(), 
        onMessage: vi.fn(), 
        setClickable: vi.fn(), 
        show: vi.fn(), 
        hide: vi.fn(), 
        isVisible: vi.fn(() => false) 
      },
      standaloneWindow: { 
        loadFile: vi.fn(), 
        postMessage: vi.fn(), 
        onMessage: vi.fn(), 
        show: vi.fn() 
      }
    };
  });

  it('should provide default values that can be overridden', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    // Get default values
    const defaults = await manager.getBookmarkDefaults();
    
    // Verify defaults are populated
    expect(defaults.title).toContain('Sample Movie');
    expect(defaults.title).toContain('30:00');
    expect(defaults.description).toContain('30:00');
    expect(defaults.tags).toBeInstanceOf(Array);
    expect(defaults.timestamp).toBe(1800);
    expect(defaults.filepath).toBe('/test/video/Sample.Movie.2023.1080p.BluRay.x264.mp4');
  });

  it('should allow complete override of title', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    // Test that addBookmark accepts custom title override
    const customTitle = "My Custom Bookmark Title";
    await manager.addBookmark(customTitle, 1800, "Custom description", ["custom-tag"]);
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe(customTitle);
    expect(bookmarks[0].title).not.toContain('Sample Movie'); // Verify it's not using default
  });

  it('should allow complete override of description', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    const customDescription = "This is my completely custom description that has nothing to do with the auto-generated one";
    await manager.addBookmark("Custom Title", 1800, customDescription, ["test"]);
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks[0].description).toBe(customDescription);
    expect(bookmarks[0].description).not.toContain('Bookmark at'); // Verify it's not using default
  });

  it('should allow complete override of tags', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    const customTags = ["completely", "custom", "tags", "no-auto-tags"];
    await manager.addBookmark("Custom Title", 1800, "Custom description", customTags);
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks[0].tags).toEqual(customTags);
    // Verify none of the auto-generated tags are present
    expect(bookmarks[0].tags).not.toContain('video');
    expect(bookmarks[0].tags).not.toContain('early');
  });

  it('should allow override of timestamp', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    const customTimestamp = 3600; // 1 hour instead of 30 minutes
    await manager.addBookmark("Custom Title", customTimestamp, "Custom description", ["test"]);
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks[0].timestamp).toBe(customTimestamp);
    expect(bookmarks[0].timestamp).not.toBe(1800); // Verify it's not using current time
  });

  it('should allow partial overrides while keeping some defaults', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    // Override only title, keep other defaults
    const customTitle = "Only Title Changed";
    await manager.addBookmark(customTitle); // Other params undefined = use defaults
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks[0].title).toBe(customTitle);
    expect(bookmarks[0].timestamp).toBe(1800); // Should use current time default
    expect(bookmarks[0].description).toContain('Bookmark at'); // Should use auto-generated description
  });

  it('should handle empty string overrides correctly', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    // Test empty string overrides
    await manager.addBookmark("", 1800, "", []);
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks).toHaveLength(1);
    // Should fall back to defaults when empty strings provided
    expect(bookmarks[0].title).toContain('Sample Movie'); // Should use default title
    expect(bookmarks[0].description).toContain('Bookmark at'); // Should use default description
  });

  it('should preserve user overrides exactly as provided', async () => {
    const { BookmarkManager } = await import('../src/bookmark-manager');
    const manager = new BookmarkManager(mockDeps);
    
    const userOverrides = {
      title: "User's Exact Title with Special Characters !@#$%",
      description: "User's exact description with\nnewlines and\ttabs",
      tags: ["user-tag-1", "user-tag-2", "special!@#"],
      timestamp: 2500
    };
    
    await manager.addBookmark(
      userOverrides.title, 
      userOverrides.timestamp, 
      userOverrides.description, 
      userOverrides.tags
    );
    
    const bookmarks = manager.getBookmarks();
    expect(bookmarks[0].title).toBe(userOverrides.title);
    expect(bookmarks[0].description).toBe(userOverrides.description);
    expect(bookmarks[0].tags).toEqual(userOverrides.tags);
    expect(bookmarks[0].timestamp).toBe(userOverrides.timestamp);
  });
}); 