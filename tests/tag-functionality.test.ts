import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BookmarkManager } from '../src/bookmark-manager'

// Mock BookmarkData interface
interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  tags?: string[];
}

describe('Tag Functionality', () => {
  let manager: BookmarkManager
  
  beforeEach(() => {
    vi.clearAllMocks()
    manager = new BookmarkManager()
  })

  describe('Tag Storage and Persistence', () => {
    it('should store tags with bookmarks', () => {
      const tags = ['work', 'important', 'meeting']
      manager.addBookmark('Test Bookmark', 100, 'Test description', tags)
      
      const bookmarks = manager.getBookmarks()
      expect(bookmarks).toHaveLength(1)
      // Should include user tags exactly as provided
      expect(bookmarks[0].tags).toContain('work')
      expect(bookmarks[0].tags).toContain('important')
      expect(bookmarks[0].tags).toContain('meeting')
    })

    it('should handle empty tags array', () => {
      manager.addBookmark('Test Bookmark', 100, 'Test description', [])
      
      const bookmarks = manager.getBookmarks()
      // Should still have auto-generated tags even with empty user tags
      expect(bookmarks[0].tags).toBeDefined()
      expect(Array.isArray(bookmarks[0].tags)).toBe(true)
    })

    it('should handle undefined tags', () => {
      manager.addBookmark('Test Bookmark', 100, 'Test description')
      
      const bookmarks = manager.getBookmarks()
      // Should have auto-generated tags even when user tags are undefined
      expect(bookmarks[0].tags).toBeDefined()
      expect(Array.isArray(bookmarks[0].tags)).toBe(true)
    })
  })

  describe('Tag Parsing and Validation', () => {
    it('should handle comma-separated tags', () => {
      const tagString = 'work, important, meeting'
      const parsedTags = tagString.split(',').map(t => t.trim())
      
      expect(parsedTags).toEqual(['work', 'important', 'meeting'])
    })

    it('should handle semicolon-separated tags', () => {
      const tagString = 'work; important; meeting'
      const parsedTags = tagString.split(';').map(t => t.trim())
      
      expect(parsedTags).toEqual(['work', 'important', 'meeting'])
    })

    it('should handle space-separated tags', () => {
      const tagString = 'work important meeting'
      const parsedTags = tagString.split(/\s+/).filter(t => t.length > 0)
      
      expect(parsedTags).toEqual(['work', 'important', 'meeting'])
    })

    it('should remove duplicate tags', () => {
      const tags = ['work', 'important', 'work', 'meeting', 'important']
      const uniqueTags = [...new Set(tags)]
      
      expect(uniqueTags).toEqual(['work', 'important', 'meeting'])
    })

    it('should handle case-insensitive tag matching', () => {
      const tags1 = ['Work', 'IMPORTANT']
      const tags2 = ['work', 'important']
      
      const normalized1 = tags1.map(t => t.toLowerCase())
      const normalized2 = tags2.map(t => t.toLowerCase())
      
      expect(normalized1).toEqual(normalized2)
    })

    it('should handle special characters in tags', () => {
      const tags = ['C++', 'Node.js', 'React-Native', '@urgent', '#todo']
      
      manager.addBookmark('Test', 100, 'Test', tags)
      const bookmarks = manager.getBookmarks()
      
      // Should contain all user-specified tags
      tags.forEach(tag => {
        expect(bookmarks[0].tags).toContain(tag)
      })
    })
  })

  describe('Tag Search and Filtering', () => {
    beforeEach(() => {
      // Add test bookmarks with various tags
      manager.addBookmark('Work Meeting', 100, 'Important meeting', ['work', 'meeting', 'important'])
      manager.addBookmark('Personal Video', 200, 'Family video', ['personal', 'family'])
      manager.addBookmark('Tutorial', 300, 'React tutorial', ['tutorial', 'react', 'programming'])
      manager.addBookmark('Conference Talk', 400, 'Tech conference', ['work', 'conference', 'tech'])
    })

    it('should filter bookmarks by single tag', () => {
      const workBookmarks = manager.getBookmarks().filter(b => 
        b.tags?.includes('work')
      )
      
      expect(workBookmarks).toHaveLength(2)
      expect(workBookmarks.map(b => b.title)).toEqual(['Work Meeting', 'Conference Talk'])
    })

    it('should filter bookmarks by multiple tags (AND)', () => {
      const workMeetingBookmarks = manager.getBookmarks().filter(b => 
        b.tags?.includes('work') && b.tags?.includes('meeting')
      )
      
      expect(workMeetingBookmarks).toHaveLength(1)
      expect(workMeetingBookmarks[0].title).toBe('Work Meeting')
    })

    it('should filter bookmarks by multiple tags (OR)', () => {
      const techOrPersonalBookmarks = manager.getBookmarks().filter(b => 
        b.tags?.includes('tech') || b.tags?.includes('personal')
      )
      
      expect(techOrPersonalBookmarks).toHaveLength(2)
      expect(techOrPersonalBookmarks.map(b => b.title)).toEqual(['Personal Video', 'Conference Talk'])
    })

    it('should handle tag search with NOT operator', () => {
      const nonWorkBookmarks = manager.getBookmarks().filter(b => 
        !b.tags?.includes('work')
      )
      
      expect(nonWorkBookmarks).toHaveLength(2)
      expect(nonWorkBookmarks.map(b => b.title)).toEqual(['Personal Video', 'Tutorial'])
    })
  })

  describe('Tag Auto-Completion and Suggestions', () => {
    beforeEach(() => {
      manager.addBookmark('Bookmark 1', 100, 'Desc', ['javascript', 'programming', 'web'])
      manager.addBookmark('Bookmark 2', 200, 'Desc', ['java', 'programming', 'backend'])
      manager.addBookmark('Bookmark 3', 300, 'Desc', ['python', 'data-science', 'ml'])
      // Add bookmarks without user tags to get auto-generated tags
      manager.addBookmark('Video Bookmark', 100, 'Auto tags test') // Should get 'video', 'beginning'
    })

    it('should get all unique tags from bookmarks', () => {
      const allTags = new Set<string>()
      manager.getBookmarks().forEach(b => {
        b.tags?.forEach(tag => allTags.add(tag))
      })
      
      const uniqueTags = Array.from(allTags).sort()
      // Should include both user tags and auto-generated tags
      expect(uniqueTags).toContain('backend')
      expect(uniqueTags).toContain('data-science')
      expect(uniqueTags).toContain('java')
      expect(uniqueTags).toContain('javascript')
      expect(uniqueTags).toContain('ml')
      expect(uniqueTags).toContain('programming')
      expect(uniqueTags).toContain('python')
      expect(uniqueTags).toContain('web')
      expect(uniqueTags).toContain('video') // auto-generated
      expect(uniqueTags).toContain('beginning') // auto-generated
    })

    it('should suggest tags based on partial input', () => {
      const allTags = ['javascript', 'java', 'programming', 'python', 'web', 'backend', 'data-science', 'ml']
      const input = 'ja'
      
      const suggestions = allTags.filter(tag => 
        tag.toLowerCase().includes(input.toLowerCase())
      )
      
      expect(suggestions).toEqual(['javascript', 'java'])
    })

    it('should prioritize exact matches in suggestions', () => {
      const allTags = ['test', 'testing', 'tester', 'attestation']
      const input = 'test'
      
      const suggestions = allTags
        .filter(tag => tag.toLowerCase().includes(input.toLowerCase()))
        .sort((a, b) => {
          if (a.toLowerCase() === input.toLowerCase()) return -1
          if (b.toLowerCase() === input.toLowerCase()) return 1
          if (a.toLowerCase().startsWith(input.toLowerCase()) && !b.toLowerCase().startsWith(input.toLowerCase())) return -1
          if (b.toLowerCase().startsWith(input.toLowerCase()) && !a.toLowerCase().startsWith(input.toLowerCase())) return 1
          return a.localeCompare(b)
        })
      
      expect(suggestions[0]).toBe('test')
      expect(suggestions.slice(1)).toEqual(['tester', 'testing', 'attestation'])
    })
  })

  describe('Tag Performance with Large Datasets', () => {
    it('should handle hundreds of unique tags efficiently', () => {
      const startTime = performance.now()
      
      // Create 500 bookmarks with various tags
      for (let i = 0; i < 500; i++) {
        const tags = [
          `category-${i % 20}`,
          `priority-${i % 5}`,
          `project-${i % 10}`,
          `year-${2020 + (i % 5)}`
        ]
        manager.addBookmark(`Bookmark ${i}`, i * 10, `Description ${i}`, tags)
      }
      
      const endTime = performance.now()
      
      // Should complete within reasonable time (under 1000ms since we're adding auto-tags)
      expect(endTime - startTime).toBeLessThan(1000)
      
      // Verify we have the expected number of bookmarks
      expect(manager.getBookmarks()).toHaveLength(500)
    })

    it('should efficiently filter large tag datasets', () => {
      // Add test data
      for (let i = 0; i < 1000; i++) {
        const tags = [`tag-${i % 50}`, `category-${i % 10}`]
        manager.addBookmark(`Bookmark ${i}`, i, `Desc ${i}`, tags)
      }
      
      const startTime = performance.now()
      
      // Filter by a common tag
      const filtered = manager.getBookmarks().filter(b => 
        b.tags?.includes('category-5')
      )
      
      const endTime = performance.now()
      
      // Should complete filtering quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100)
      
      // Should find the expected number of matches
      expect(filtered).toHaveLength(100)
    })
  })

  describe('Tag Edge Cases', () => {
    it('should handle very long tag names', () => {
      const longTag = 'a'.repeat(100)
      manager.addBookmark('Test', 100, 'Test', [longTag])
      
      const bookmarks = manager.getBookmarks()
      expect(bookmarks[0].tags).toContain(longTag)
    })

    it('should handle tags with only whitespace', () => {
      const tags = ['valid-tag', '   ', '\t\n', 'another-valid-tag']
      const cleanedTags = tags.filter(tag => tag.trim().length > 0)
      
      expect(cleanedTags).toEqual(['valid-tag', 'another-valid-tag'])
    })

    it('should handle Unicode characters in tags', () => {
      const unicodeTags = ['日本語', 'العربية', '🎬', '📚', 'émoji']
      
      manager.addBookmark('Unicode Test', 100, 'Test', unicodeTags)
      const bookmarks = manager.getBookmarks()
      
      // Should contain all Unicode tags
      unicodeTags.forEach(tag => {
        expect(bookmarks[0].tags).toContain(tag)
      })
    })

    it('should handle extremely large number of tags on single bookmark', () => {
      const manyTags = Array.from({ length: 100 }, (_, i) => `tag-${i}`)
      
      manager.addBookmark('Many Tags', 100, 'Test', manyTags)
      const bookmarks = manager.getBookmarks()
      
      // Should contain all user tags plus auto-generated tags
      expect(bookmarks[0].tags!.length).toBeGreaterThanOrEqual(100)
      manyTags.forEach(tag => {
        expect(bookmarks[0].tags).toContain(tag)
      })
    })
  })
}) 