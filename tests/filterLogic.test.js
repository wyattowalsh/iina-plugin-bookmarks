/**
 * Comprehensive Test Suite for Bookmark Filtering Logic
 * Tests filtering and sorting functionality with various datasets
 */

// Mock useBookmarkFilters implementation for testing
const useBookmarkFilters = ({ bookmarks, filters }) => {
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

  const availableFiles = Array.from(new Set(bookmarks.map(b => b.filepath))).sort();
  const availableTags = Array.from(new Set(bookmarks.flatMap(b => b.tags || []))).sort();

  return {
    filteredBookmarks: result,
    resultsCount: result.length,
    availableFiles,
    availableTags
  };
};

// Test datasets
const createTestDatasets = () => {
  const baseDate = new Date('2025-01-01').getTime();
  
  return {
    smallDataset: [
      {
        id: '1',
        title: 'Opening Scene',
        timestamp: 120,
        filepath: '/movies/inception.mp4',
        description: 'The movie begins',
        createdAt: new Date(baseDate).toISOString(),
        tags: ['action', 'thriller']
      },
      {
        id: '2',
        title: 'Dream Sequence',
        timestamp: 3600,
        filepath: '/movies/inception.mp4',
        description: 'Multiple layers of dreams',
        createdAt: new Date(baseDate + 86400000).toISOString(),
        tags: ['mind-bending', 'thriller']
      },
      {
        id: '3',
        title: 'Documentary Intro',
        timestamp: 60,
        filepath: '/docs/nature.mp4',
        description: 'Nature documentary opening',
        createdAt: new Date(baseDate + 172800000).toISOString(),
        tags: ['documentary', 'nature']
      }
    ],
    
    largeDataset: [
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        title: `${i % 3 === 0 ? 'Movie' : i % 3 === 1 ? 'TV Show' : 'Documentary'} Scene ${i + 1}`,
        timestamp: Math.floor(Math.random() * 7200),
        filepath: `/media/${i % 3 === 0 ? 'movies' : i % 3 === 1 ? 'tv' : 'docs'}/file${Math.floor(i / 10) + 1}.mp4`,
        description: `Content description ${i + 1}`,
        createdAt: new Date(baseDate + i * 86400000).toISOString(),
        tags: [i % 2 === 0 ? 'action' : 'drama', i % 3 === 0 ? 'thriller' : 'comedy']
      }))
    ]
  };
};

// Test runner and assertions
const runTest = (description, testFn) => {
  try {
    testFn();
    console.log(`✅ PASS: ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${description}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
};

const assertEqual = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
  }
};

const assertTrue = (condition, message = '') => {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
};

// Main test suite
const runFilterTests = () => {
  console.log('🚀 Starting Comprehensive Bookmark Filter Tests\n');
  
  const datasets = createTestDatasets();
  let passCount = 0;
  let totalTests = 0;

  // Test 1: Search by title
  totalTests++;
  passCount += runTest('Search by title (case-insensitive)', () => {
    const filters = {
      searchTerm: 'dream',
      dateRange: { start: '', end: '' },
      tags: [],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      fileFilter: ''
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.smallDataset,
      filters
    });
    
    assertEqual(result.resultsCount, 1);
    assertEqual(result.filteredBookmarks[0].title, 'Dream Sequence');
  });

  // Test 2: Search by description
  totalTests++;
  passCount += runTest('Search by description content', () => {
    const filters = {
      searchTerm: 'nature',
      dateRange: { start: '', end: '' },
      tags: [],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      fileFilter: ''
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.smallDataset,
      filters
    });
    
    assertEqual(result.resultsCount, 1);
    assertEqual(result.filteredBookmarks[0].title, 'Documentary Intro');
  });

  // Test 3: Tag filtering
  totalTests++;
  passCount += runTest('Filter by tags (AND logic)', () => {
    const filters = {
      searchTerm: '',
      dateRange: { start: '', end: '' },
      tags: ['thriller', 'action'],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      fileFilter: ''
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.smallDataset,
      filters
    });
    
    assertEqual(result.resultsCount, 1);
    assertEqual(result.filteredBookmarks[0].title, 'Opening Scene');
  });

  // Test 4: File filtering
  totalTests++;
  passCount += runTest('Filter by specific file', () => {
    const filters = {
      searchTerm: '',
      dateRange: { start: '', end: '' },
      tags: [],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      fileFilter: '/docs/nature.mp4'
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.smallDataset,
      filters
    });
    
    assertEqual(result.resultsCount, 1);
    assertEqual(result.filteredBookmarks[0].title, 'Documentary Intro');
  });

  // Test 5: Sorting by title
  totalTests++;
  passCount += runTest('Sort by title (ascending)', () => {
    const filters = {
      searchTerm: '',
      dateRange: { start: '', end: '' },
      tags: [],
      sortBy: 'title',
      sortDirection: 'asc',
      fileFilter: ''
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.smallDataset,
      filters
    });
    
    const titles = result.filteredBookmarks.map(b => b.title);
    assertEqual(titles, ['Documentary Intro', 'Dream Sequence', 'Opening Scene']);
  });

  // Test 6: Large dataset performance
  totalTests++;
  passCount += runTest('Large dataset filtering performance', () => {
    const startTime = Date.now();
    
    const filters = {
      searchTerm: 'movie',
      dateRange: { start: '', end: '' },
      tags: ['action'],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      fileFilter: ''
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.largeDataset,
      filters
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    assertTrue(result.resultsCount > 0, 'Should find matching bookmarks');
    assertTrue(duration < 100, `Filtering should complete quickly (took ${duration}ms)`);
  });

  // Test 7: Combined filters
  totalTests++;
  passCount += runTest('Multiple filters combined', () => {
    const filters = {
      searchTerm: 'movie',
      dateRange: { start: '', end: '' },
      tags: ['action'],
      sortBy: 'timestamp',
      sortDirection: 'asc',
      fileFilter: ''
    };
    
    const result = useBookmarkFilters({
      bookmarks: datasets.largeDataset,
      filters
    });
    
    // Verify all results match criteria
    result.filteredBookmarks.forEach(bookmark => {
      assertTrue(
        bookmark.title.toLowerCase().includes('movie') ||
        (bookmark.description || '').toLowerCase().includes('movie'),
        'Each result should match search term'
      );
      assertTrue(
        bookmark.tags && bookmark.tags.includes('action'),
        'Each result should have action tag'
      );
    });
  });

  // Test Results Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`   Tests Passed: ${passCount}/${totalTests}`);
  console.log(`   Success Rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);
  
  if (passCount === totalTests) {
    console.log('🎉 All tests passed! Filter logic is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }
  
  return passCount === totalTests;
};

// Run the tests
if (require.main === module) {
  runFilterTests();
}

module.exports = { runFilterTests, useBookmarkFilters, createTestDatasets };