import { useMemo } from 'react';
import { FilterState } from '../components/FilterComponent';
import { ParsedSearchQuery } from '../components/AdvancedSearch';

interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  tags?: string[];
}

interface UseAdvancedBookmarkFiltersProps {
  bookmarks: BookmarkData[];
  filters: FilterState;
  parsedQuery?: ParsedSearchQuery;
}

export const useAdvancedBookmarkFilters = ({ 
  bookmarks, 
  filters, 
  parsedQuery 
}: UseAdvancedBookmarkFiltersProps) => {
  
  const filteredAndSortedBookmarks = useMemo(() => {
    let result = [...bookmarks];

    // Apply advanced search if available, otherwise fall back to basic search
    if (parsedQuery) {
      result = applyAdvancedSearch(result, parsedQuery);
    } else if (filters.searchTerm) {
      result = applyBasicSearch(result, filters.searchTerm);
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
      result = applyDateRangeFilter(result, filters.dateRange);
    }

    // Apply sorting
    result = applySorting(result, filters.sortBy, filters.sortDirection);

    return result;
  }, [bookmarks, filters, parsedQuery]);

  const availableFiles = useMemo(() => {
    return Array.from(new Set(bookmarks.map(b => b.filepath))).sort();
  }, [bookmarks]);

  const availableTags = useMemo(() => {
    const allTags = bookmarks.flatMap(b => b.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [bookmarks]);

  const filterAnalytics = useMemo(() => {
    const totalBookmarks = bookmarks.length;
    const filteredCount = filteredAndSortedBookmarks.length;
    const reductionPercentage = totalBookmarks > 0 ? 
      ((totalBookmarks - filteredCount) / totalBookmarks * 100).toFixed(1) : '0';
    
    return {
      totalBookmarks,
      filteredCount,
      reductionPercentage: parseFloat(reductionPercentage),
      hasActiveFilters: filteredCount !== totalBookmarks
    };
  }, [bookmarks.length, filteredAndSortedBookmarks.length]);

  return {
    filteredBookmarks: filteredAndSortedBookmarks,
    resultsCount: filteredAndSortedBookmarks.length,
    availableFiles,
    availableTags,
    analytics: filterAnalytics
  };
};

// Helper function to apply advanced search logic
function applyAdvancedSearch(bookmarks: BookmarkData[], query: ParsedSearchQuery): BookmarkData[] {
  return bookmarks.filter(bookmark => {
    // Field-specific searches
    if (query.fieldSearches.title && 
        !bookmark.title.toLowerCase().includes(query.fieldSearches.title.toLowerCase())) {
      return false;
    }
    
    if (query.fieldSearches.description && 
        !(bookmark.description || '').toLowerCase().includes(query.fieldSearches.description.toLowerCase())) {
      return false;
    }
    
    if (query.fieldSearches.filepath && 
        !bookmark.filepath.toLowerCase().includes(query.fieldSearches.filepath.toLowerCase())) {
      return false;
    }
    
    if (query.fieldSearches.tags && query.fieldSearches.tags.length > 0) {
      const bookmarkTags = (bookmark.tags || []).map(tag => tag.toLowerCase());
      const hasAllTags = query.fieldSearches.tags.every(searchTag => 
        bookmarkTags.some(bookmarkTag => bookmarkTag.includes(searchTag.toLowerCase()))
      );
      if (!hasAllTags) return false;
    }

    // Date filters
    if (query.dateFilters.created) {
      const bookmarkDate = new Date(bookmark.createdAt);
      if (!applyDateFilter(bookmarkDate, query.dateFilters.created)) {
        return false;
      }
    }

    // Boolean operators
    if (query.operators.NOT.length > 0) {
      const hasExcludedTerm = query.operators.NOT.some(term => 
        matchesBookmarkContent(bookmark, term)
      );
      if (hasExcludedTerm) return false;
    }

    if (query.operators.AND.length > 0) {
      const hasAllTerms = query.operators.AND.every(term => 
        matchesBookmarkContent(bookmark, term)
      );
      if (!hasAllTerms) return false;
    }

    if (query.operators.OR.length > 0) {
      const hasAnyTerm = query.operators.OR.some(term => 
        matchesBookmarkContent(bookmark, term)
      );
      if (!hasAnyTerm) return false;
    }

    // General text search (if any remains)
    if (query.textSearch) {
      return matchesBookmarkContent(bookmark, query.textSearch);
    }

    return true;
  });
}

// Helper function for basic search (fallback)
function applyBasicSearch(bookmarks: BookmarkData[], searchTerm: string): BookmarkData[] {
  const term = searchTerm.toLowerCase();
  return bookmarks.filter(bookmark => 
    bookmark.title.toLowerCase().includes(term) ||
    (bookmark.description || '').toLowerCase().includes(term) ||
    bookmark.filepath.toLowerCase().includes(term) ||
    (bookmark.tags || []).some(tag => tag.toLowerCase().includes(term))
  );
}

// Helper function to check if bookmark matches a search term
function matchesBookmarkContent(bookmark: BookmarkData, term: string): boolean {
  const searchTerm = term.toLowerCase();
  return bookmark.title.toLowerCase().includes(searchTerm) ||
         (bookmark.description || '').toLowerCase().includes(searchTerm) ||
         bookmark.filepath.toLowerCase().includes(searchTerm) ||
         (bookmark.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
}

// Helper function to apply date filters
function applyDateFilter(
  bookmarkDate: Date, 
  dateFilter: { operator: string; value?: string }
): boolean {
  const now = new Date();
  
  switch (dateFilter.operator) {
    case 'today':
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return bookmarkDate >= today;
      
    case 'yesterday':
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const yesterdayEnd = new Date(yesterdayStart.getTime() + 24 * 60 * 60 * 1000);
      return bookmarkDate >= yesterdayStart && bookmarkDate < yesterdayEnd;
      
    case 'this-week':
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return bookmarkDate >= weekStart;
      
    case 'this-month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return bookmarkDate >= monthStart;
      
    case '>':
      if (dateFilter.value) {
        const compareDate = new Date(dateFilter.value);
        return bookmarkDate > compareDate;
      }
      break;
      
    case '<':
      if (dateFilter.value) {
        const compareDate = new Date(dateFilter.value);
        return bookmarkDate < compareDate;
      }
      break;
      
    case '=':
      if (dateFilter.value) {
        const compareDate = new Date(dateFilter.value);
        const dayStart = new Date(compareDate.getFullYear(), compareDate.getMonth(), compareDate.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        return bookmarkDate >= dayStart && bookmarkDate < dayEnd;
      }
      break;
  }
  
  return true;
}

// Helper function to apply date range filter
function applyDateRangeFilter(
  bookmarks: BookmarkData[], 
  dateRange: { start: string; end: string }
): BookmarkData[] {
  return bookmarks.filter(bookmark => {
    const bookmarkDate = new Date(bookmark.createdAt);
    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    if (startDate && bookmarkDate < startDate) return false;
    if (endDate && bookmarkDate > endDate) return false;
    return true;
  });
}

// Helper function to apply sorting
function applySorting(
  bookmarks: BookmarkData[], 
  sortBy: FilterState['sortBy'], 
  sortDirection: FilterState['sortDirection']
): BookmarkData[] {
  const sorted = [...bookmarks].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
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

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

export default useAdvancedBookmarkFilters; 