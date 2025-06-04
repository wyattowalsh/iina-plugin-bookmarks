import { useMemo } from 'react';
import { FilterState } from '../components/FilterComponent';

interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  tags?: string[];
}

interface UseBookmarkFiltersProps {
  bookmarks: BookmarkData[];
  filters: FilterState;
}

export const useBookmarkFilters = ({ bookmarks, filters }: UseBookmarkFiltersProps) => {
  const filteredAndSortedBookmarks = useMemo(() => {
    let result = [...bookmarks];

    // Apply text search filter
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      result = result.filter(bookmark => 
        bookmark.title.toLowerCase().includes(searchTerm) ||
        (bookmark.description || '').toLowerCase().includes(searchTerm) ||
        bookmark.filepath.toLowerCase().includes(searchTerm) ||
        (bookmark.tags || []).some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply file filter
    if (filters.fileFilter) {
      result = result.filter(bookmark => bookmark.filepath === filters.fileFilter);
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
      result = result.filter(bookmark => {
        const bookmarkTags = bookmark.tags || [];
        return filters.tags.every(filterTag => bookmarkTags.includes(filterTag));
      });
    }

    // Apply date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      result = result.filter(bookmark => {
        const bookmarkDate = new Date(bookmark.createdAt);
        const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
        const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;

        if (startDate && bookmarkDate < startDate) return false;
        if (endDate && bookmarkDate > endDate) return false;
        return true;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'createdAt':
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return filters.sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [bookmarks, filters]);

  const availableFiles = useMemo(() => {
    return Array.from(new Set(bookmarks.map(b => b.filepath))).sort();
  }, [bookmarks]);

  const availableTags = useMemo(() => {
    const allTags = bookmarks.flatMap(b => b.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [bookmarks]);

  return {
    filteredBookmarks: filteredAndSortedBookmarks,
    resultsCount: filteredAndSortedBookmarks.length,
    availableFiles,
    availableTags
  };
};

export default useBookmarkFilters; 