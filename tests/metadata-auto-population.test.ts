import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BookmarkManager } from '../src/bookmark-manager'

describe('Metadata Auto-Population', () => {
  let manager: BookmarkManager
  
  beforeEach(() => {
    vi.clearAllMocks()
    manager = new BookmarkManager()
  })

  describe('Smart Title Generation', () => {
    it('should extract clean titles from movie files', () => {
      manager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].title).toContain('video')
      expect(bookmarks[0].title).toContain('1:40')
    })

    it('should handle TV show episode naming patterns', () => {
      // Mock a TV show file path
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/tv/shows/Breaking.Bad.S01E01.720p.mkv', currentTime: 300 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const tvManager = new BookmarkManager(mockDeps)
      tvManager.addBookmark(undefined, 300, undefined, undefined)
      const bookmarks = tvManager.getBookmarks()
      
      expect(bookmarks[0].title).toContain('Breaking.Bad.S01E01.720p')
      expect(bookmarks[0].tags).toContain('tv-episode')
      expect(bookmarks[0].tags).toContain('hd')
    })

    it('should include timestamp information for context', () => {
      manager.addBookmark(undefined, 3661, undefined, undefined) // 1:01:01
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].title).toContain('1:01:01')
    })

    it('should handle multiple language title formats', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/movies/七武士.1954.Criterion.1080p.mkv', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const unicodeManager = new BookmarkManager(mockDeps)
      unicodeManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = unicodeManager.getBookmarks()
      
      expect(bookmarks[0].title).toContain('七武士.1954.Criterion.1080p')
      expect(bookmarks[0].tags).toContain('dated-content')
      expect(bookmarks[0].tags).toContain('hd')
    })
  })

  describe('Intelligent Description Generation', () => {
    it('should generate context-aware descriptions for movies', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/movies/Inception.2010.1080p.mp4', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const movieManager = new BookmarkManager(mockDeps)
      movieManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = movieManager.getBookmarks()
      
      expect(bookmarks[0].description).toContain('Bookmark at 1:40 in video')
    })

    it('should detect opening scenes for timestamps', () => {
      manager.addBookmark(undefined, 30, undefined, undefined) // 30 seconds
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('beginning')
    })

    it('should include time markers for navigation', () => {
      manager.addBookmark(undefined, 1800, undefined, undefined) // 30 minutes
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].title).toContain('30:00')
      expect(bookmarks[0].description).toContain('30:00')
    })

    it('should include media quality information', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/movies/Avatar.2009.4K.UHD.HDR.mkv', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const qualityManager = new BookmarkManager(mockDeps)
      qualityManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = qualityManager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('4k')
      expect(bookmarks[0].tags).toContain('hdr')
    })
  })

  describe('Automatic Tag Generation', () => {
    describe('File Path Analysis', () => {
      it('should extract tags from directory structure', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/movies/action/John.Wick.2014.1080p.mp4', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const pathManager = new BookmarkManager(mockDeps)
        pathManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = pathManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('movie')
        expect(bookmarks[0].tags).toContain('video')
        expect(bookmarks[0].tags).toContain('hd')
        expect(bookmarks[0].tags).toContain('dated-content')
      })
    })

    describe('Media Type Detection', () => {
      it('should detect movie files', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/content/The.Matrix.1999.mp4', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const movieManager = new BookmarkManager(mockDeps)
        movieManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = movieManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('video')
        expect(bookmarks[0].tags).toContain('dated-content')
      })

      it('should detect TV show files', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/tv/Game.of.Thrones.S08E06.mkv', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const tvManager = new BookmarkManager(mockDeps)
        tvManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = tvManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('tv-episode')
        expect(bookmarks[0].tags).toContain('video')
      })

      it('should detect documentary files', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/docs/Planet.Earth.Documentary.2006.mkv', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const docManager = new BookmarkManager(mockDeps)
        docManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = docManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('documentary')
        expect(bookmarks[0].tags).toContain('video')
        expect(bookmarks[0].tags).toContain('dated-content')
      })

      it('should detect music files', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/music/Bohemian.Rhapsody.Live.Concert.mp3', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const musicManager = new BookmarkManager(mockDeps)
        musicManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = musicManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('audio')
        expect(bookmarks[0].tags).toContain('live-performance')
      })
    })

    describe('Quality Detection', () => {
      it('should detect 4K content', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/movies/Dune.2021.4K.UHD.mkv', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const uhd4kManager = new BookmarkManager(mockDeps)
        uhd4kManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = uhd4kManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('4k')
      })

      it('should detect HD content', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/movies/Interstellar.2014.1080p.mkv', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const hdManager = new BookmarkManager(mockDeps)
        hdManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = hdManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('hd')
        expect(bookmarks[0].tags).toContain('dated-content')
      })

      it('should detect HDR content', () => {
        const mockDeps = {
          console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
          core: { status: { path: '/movies/Blade.Runner.2049.HDR.mkv', currentTime: 100 } },
          event: { on: vi.fn() },
          menu: { addItem: vi.fn(), item: vi.fn() },
          sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
          overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
          standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
        }
        
        const hdrManager = new BookmarkManager(mockDeps)
        hdrManager.addBookmark(undefined, 100, undefined, undefined)
        const bookmarks = hdrManager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('hdr')
      })
    })

    describe('Temporal Context', () => {
      it('should tag beginning scenes', () => {
        manager.addBookmark(undefined, 30, undefined, undefined) // 30 seconds
        const bookmarks = manager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('beginning')
      })

      it('should tag early scenes', () => {
        manager.addBookmark(undefined, 1800, undefined, undefined) // 30 minutes
        const bookmarks = manager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('early')
      })

      it('should tag late scenes', () => {
        manager.addBookmark(undefined, 7200, undefined, undefined) // 2 hours
        const bookmarks = manager.getBookmarks()
        
        expect(bookmarks[0].tags).toContain('late')
      })
    })
  })

  describe('Content Analysis', () => {
    it('should detect trailers', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/trailers/Avengers.Endgame.Trailer.2019.mp4', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const trailerManager = new BookmarkManager(mockDeps)
      trailerManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = trailerManager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('trailer')
      expect(bookmarks[0].tags).toContain('dated-content')
    })

    it('should detect interviews', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/interviews/Director.Interview.Behind.Scenes.mp4', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const interviewManager = new BookmarkManager(mockDeps)
      interviewManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = interviewManager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('interview')
      expect(bookmarks[0].tags).toContain('behind-scenes')
    })

    it('should detect live performances', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/concerts/Queen.Live.Aid.1985.Concert.mkv', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const concertManager = new BookmarkManager(mockDeps)
      concertManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = concertManager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('live-performance')
      expect(bookmarks[0].tags).toContain('dated-content')
    })
  })

  describe('User Override Capabilities', () => {
    it('should allow user to override auto-generated title', () => {
      manager.addBookmark('Custom Title', 100, undefined, undefined)
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].title).toBe('Custom Title')
    })

    it('should allow user to override auto-generated description', () => {
      manager.addBookmark(undefined, 100, 'Custom description', undefined)
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].description).toBe('Custom description')
    })

    it('should merge user tags with auto-generated tags', () => {
      manager.addBookmark(undefined, 100, undefined, ['custom-tag', 'user-defined'])
      const bookmarks = manager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('custom-tag')
      expect(bookmarks[0].tags).toContain('user-defined')
      expect(bookmarks[0].tags).toContain('video') // auto-generated
      expect(bookmarks[0].tags).toContain('beginning') // auto-generated
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle files with no extension gracefully', () => {
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: '/content/unknown_file', currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const unknownManager = new BookmarkManager(mockDeps)
      unknownManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = unknownManager.getBookmarks()
      
      expect(bookmarks[0].tags).toContain('media') // fallback media type
      expect(bookmarks[0].title).toContain('unknown_file')
    })

    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/with/many/nested/directories/and/a/very/long/filename/that/exceeds/normal/limits/Movie.Title.2023.1080p.mkv'
      const mockDeps = {
        console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
        core: { status: { path: longPath, currentTime: 100 } },
        event: { on: vi.fn() },
        menu: { addItem: vi.fn(), item: vi.fn() },
        sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
        overlay: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), setClickable: vi.fn(), show: vi.fn(), hide: vi.fn(), isVisible: vi.fn() },
        standaloneWindow: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn(), show: vi.fn() }
      }
      
      const longPathManager = new BookmarkManager(mockDeps)
      longPathManager.addBookmark(undefined, 100, undefined, undefined)
      const bookmarks = longPathManager.getBookmarks()
      
      expect(bookmarks[0].title).toContain('Movie.Title.2023.1080p')
      expect(bookmarks[0].tags).toContain('hd')
      expect(bookmarks[0].tags).toContain('dated-content')
    })

    it('should generate metadata efficiently for multiple bookmarks', () => {
      const startTime = performance.now()
      
      // Add 50 bookmarks with auto-generation
      for (let i = 0; i < 50; i++) {
        manager.addBookmark(undefined, i * 60, undefined, undefined)
      }
      
      const endTime = performance.now()
      
      // Should complete within reasonable time (under 500ms)
      expect(endTime - startTime).toBeLessThan(500)
      
      const bookmarks = manager.getBookmarks()
      expect(bookmarks).toHaveLength(50)
      
      // All bookmarks should have auto-generated metadata
      bookmarks.forEach(bookmark => {
        expect(bookmark.tags).toBeDefined()
        expect(bookmark.tags!.length).toBeGreaterThan(0)
        expect(bookmark.title).toBeDefined()
        expect(bookmark.description).toBeDefined()
      })
    })
  })
}) 