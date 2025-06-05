/**
 * Comprehensive Test Suite for Tag Parsing and Rendering
 * Tests tag functionality including parsing, validation, and display
 */

// Mock TagInput component functionality for testing
const TagInput = {
  parseTagInput: (input) => {
    if (!input || typeof input !== 'string') return [];
    return input
      .split(/[,;\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.toLowerCase())
      .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
  },
  
  validateTag: (tag) => {
    if (!tag || typeof tag !== 'string') return false;
    const trimmed = tag.trim();
    if (trimmed.length === 0) return false;
    if (trimmed.length > 50) return false; // Max tag length
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) return false; // Only alphanumeric, dash, underscore
    return true;
  },

  sanitizeTags: (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags
      .filter(tag => TagInput.validateTag(tag))
      .map(tag => tag.trim().toLowerCase())
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
      .slice(0, 10); // Max 10 tags
  }
};

// Mock advanced search query parsing for tags
const AdvancedSearchParser = {
  parseTagQuery: (query) => {
    if (!query || typeof query !== 'string') return { tags: [], operator: 'AND' };
    
    const tagMatches = query.match(/tag:([^\s]+)/g) || [];
    const tags = tagMatches.map(match => match.replace('tag:', '').toLowerCase());
    
    // Detect operator context - check for NOT first, then OR
    const hasNot = /NOT\s+tag:/i.test(query);
    const hasOr = /\s+OR\s+/i.test(query);
    
    return {
      tags,
      operator: hasNot ? 'NOT' : hasOr ? 'OR' : 'AND'
    };
  },

  filterByTagQuery: (bookmarks, tagQuery) => {
    if (!tagQuery.tags.length) return bookmarks;
    
    return bookmarks.filter(bookmark => {
      const bookmarkTags = (bookmark.tags || []).map(tag => tag.toLowerCase());
      
      switch (tagQuery.operator) {
        case 'OR':
          return tagQuery.tags.some(tag => bookmarkTags.includes(tag));
        case 'NOT':
          return !tagQuery.tags.some(tag => bookmarkTags.includes(tag));
        case 'AND':
        default:
          return tagQuery.tags.every(tag => bookmarkTags.includes(tag));
      }
    });
  }
};

// Mock tag rendering functionality
const TagRenderer = {
  renderTag: (tag, className = 'bookmark-tag') => {
    if (!tag || typeof tag !== 'string') return null;
    const sanitized = tag.trim();
    if (!sanitized) return null;
    
    return {
      tag: 'span',
      className,
      textContent: sanitized,
      attributes: {
        'data-tag': sanitized,
        'title': `Tag: ${sanitized}`
      }
    };
  },

  renderTagList: (tags, className = 'bookmark-tags') => {
    if (!Array.isArray(tags)) return null;
    const validTags = tags.filter(tag => tag && typeof tag === 'string' && tag.trim());
    if (validTags.length === 0) return null;
    
    return {
      tag: 'div',
      className,
      children: validTags.map(tag => TagRenderer.renderTag(tag))
    };
  },

  getTagColor: (tag) => {
    // Simple hash-based color assignment for consistent colors
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['blue', 'green', 'orange', 'purple', 'red', 'teal', 'yellow'];
    return colors[Math.abs(hash) % colors.length];
  }
};

// Test datasets with comprehensive tag scenarios
const createTagTestDatasets = () => {
  const baseDate = new Date('2025-01-01').getTime();
  
  return {
    basicTags: [
      {
        id: '1',
        title: 'Action Movie Scene',
        timestamp: 120,
        filepath: '/movies/action.mp4',
        description: 'Intense action sequence',
        createdAt: new Date(baseDate).toISOString(),
        tags: ['action', 'thriller', 'explosions']
      },
      {
        id: '2',
        title: 'Comedy Sketch',
        timestamp: 300,
        filepath: '/tv/comedy.mp4',
        description: 'Funny comedy bit',
        createdAt: new Date(baseDate + 86400000).toISOString(),
        tags: ['comedy', 'funny', 'sketch']
      },
      {
        id: '3',
        title: 'Documentary Scene',
        timestamp: 600,
        filepath: '/docs/nature.mp4',
        description: 'Nature documentary',
        createdAt: new Date(baseDate + 172800000).toISOString(),
        tags: ['documentary', 'nature', 'wildlife']
      }
    ],
    
    edgeCases: [
      {
        id: '4',
        title: 'No Tags Bookmark',
        timestamp: 900,
        filepath: '/misc/random.mp4',
        description: 'Bookmark without tags',
        createdAt: new Date(baseDate + 259200000).toISOString(),
        tags: []
      },
      {
        id: '5',
        title: 'Empty Tags Bookmark',
        timestamp: 1200,
        filepath: '/misc/empty.mp4',
        description: 'Bookmark with undefined tags',
        createdAt: new Date(baseDate + 345600000).toISOString()
        // No tags property
      },
      {
        id: '6',
        title: 'Mixed Case Tags',
        timestamp: 1500,
        filepath: '/mixed/case.mp4',
        description: 'Tags with different cases',
        createdAt: new Date(baseDate + 432000000).toISOString(),
        tags: ['Action', 'THRILLER', 'comedy', 'Drama']
      }
    ],
    
    complexTags: [
      {
        id: '7',
        title: 'Multi-genre Movie',
        timestamp: 1800,
        filepath: '/movies/complex.mp4',
        description: 'Movie with many genres',
        createdAt: new Date(baseDate + 518400000).toISOString(),
        tags: ['action', 'comedy', 'drama', 'thriller', 'romance', 'sci-fi']
      },
      {
        id: '8',
        title: 'Work Related Content',
        timestamp: 2100,
        filepath: '/work/training.mp4',
        description: 'Training video',
        createdAt: new Date(baseDate + 604800000).toISOString(),
        tags: ['work', 'training', 'professional', 'education']
      }
    ]
  };
};

// Test runner utilities
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

const assertArrayContains = (array, item, message = '') => {
  if (!Array.isArray(array) || !array.includes(item)) {
    throw new Error(`${message}\n  Expected array to contain: ${item}\n  Actual array: ${JSON.stringify(array)}`);
  }
};

// Main test suite
const runTagTests = () => {
  console.log('🏷️  Starting Comprehensive Tag Parsing and Rendering Tests\n');
  
  const datasets = createTagTestDatasets();
  let passCount = 0;
  let totalTests = 0;

  // Tag Input Parsing Tests
  console.log('📝 Tag Input Parsing Tests');
  
  totalTests++;
  passCount += runTest('Parse comma-separated tags', () => {
    const input = 'action, comedy, drama';
    const result = TagInput.parseTagInput(input);
    assertEqual(result, ['action', 'comedy', 'drama']);
  });

  totalTests++;
  passCount += runTest('Parse semicolon-separated tags', () => {
    const input = 'action; comedy; drama';
    const result = TagInput.parseTagInput(input);
    assertEqual(result, ['action', 'comedy', 'drama']);
  });

  totalTests++;
  passCount += runTest('Parse space-separated tags', () => {
    const input = 'action comedy drama';
    const result = TagInput.parseTagInput(input);
    assertEqual(result, ['action', 'comedy', 'drama']);
  });

  totalTests++;
  passCount += runTest('Handle mixed separators', () => {
    const input = 'action, comedy; drama thriller';
    const result = TagInput.parseTagInput(input);
    assertEqual(result, ['action', 'comedy', 'drama', 'thriller']);
  });

  totalTests++;
  passCount += runTest('Remove duplicate tags', () => {
    const input = 'action, comedy, action, drama, comedy';
    const result = TagInput.parseTagInput(input);
    assertEqual(result, ['action', 'comedy', 'drama']);
  });

  totalTests++;
  passCount += runTest('Handle empty and whitespace input', () => {
    assertEqual(TagInput.parseTagInput(''), []);
    assertEqual(TagInput.parseTagInput('   '), []);
    assertEqual(TagInput.parseTagInput(null), []);
    assertEqual(TagInput.parseTagInput(undefined), []);
  });

  // Tag Validation Tests
  console.log('\n✅ Tag Validation Tests');

  totalTests++;
  passCount += runTest('Valid tag formats', () => {
    assertTrue(TagInput.validateTag('action'));
    assertTrue(TagInput.validateTag('sci-fi'));
    assertTrue(TagInput.validateTag('action_movie'));
    assertTrue(TagInput.validateTag('genre123'));
  });

  totalTests++;
  passCount += runTest('Invalid tag formats', () => {
    assertTrue(!TagInput.validateTag(''));
    assertTrue(!TagInput.validateTag('   '));
    assertTrue(!TagInput.validateTag('tag with spaces'));
    assertTrue(!TagInput.validateTag('tag@special'));
    assertTrue(!TagInput.validateTag('a'.repeat(51))); // Too long
  });

  totalTests++;
  passCount += runTest('Sanitize tag array', () => {
    const input = ['action', 'comedy!', '', 'drama', 'valid-tag', 'too@special', 'THRILLER'];
    const result = TagInput.sanitizeTags(input);
    assertEqual(result, ['action', 'drama', 'valid-tag', 'thriller']);
  });

  // Advanced Search Tag Parsing Tests
  console.log('\n🔍 Advanced Search Tag Parsing Tests');

  totalTests++;
  passCount += runTest('Parse single tag query', () => {
    const query = 'tag:action';
    const result = AdvancedSearchParser.parseTagQuery(query);
    assertEqual(result.tags, ['action']);
    assertEqual(result.operator, 'AND');
  });

  totalTests++;
  passCount += runTest('Parse multiple tag query (AND)', () => {
    const query = 'tag:action tag:thriller';
    const result = AdvancedSearchParser.parseTagQuery(query);
    assertEqual(result.tags, ['action', 'thriller']);
    assertEqual(result.operator, 'AND');
  });

  totalTests++;
  passCount += runTest('Parse tag query with OR operator', () => {
    const query = 'tag:action OR tag:comedy';
    const result = AdvancedSearchParser.parseTagQuery(query);
    assertEqual(result.tags, ['action', 'comedy']);
    assertEqual(result.operator, 'OR');
  });

  totalTests++;
  passCount += runTest('Parse tag query with NOT operator', () => {
    const query = 'NOT tag:horror';
    const result = AdvancedSearchParser.parseTagQuery(query);
    assertEqual(result.tags, ['horror']);
    assertEqual(result.operator, 'NOT');
  });

  // Tag Filtering Tests
  console.log('\n🎯 Tag Filtering Tests');

  totalTests++;
  passCount += runTest('Filter by single tag (AND)', () => {
    const tagQuery = { tags: ['action'], operator: 'AND' };
    const result = AdvancedSearchParser.filterByTagQuery(
      [...datasets.basicTags, ...datasets.complexTags], 
      tagQuery
    );
    assertEqual(result.length, 2); // Should find action movie and multi-genre
    assertTrue(result.every(b => b.tags.includes('action')));
  });

  totalTests++;
  passCount += runTest('Filter by multiple tags (AND)', () => {
    const tagQuery = { tags: ['action', 'thriller'], operator: 'AND' };
    const result = AdvancedSearchParser.filterByTagQuery(
      [...datasets.basicTags, ...datasets.complexTags], 
      tagQuery
    );
    assertEqual(result.length, 2); // Action movie and multi-genre both have action+thriller
    assertTrue(result.every(b => b.tags.includes('action') && b.tags.includes('thriller')));
  });

  totalTests++;
  passCount += runTest('Filter by tags (OR)', () => {
    const tagQuery = { tags: ['comedy', 'documentary'], operator: 'OR' };
    const result = AdvancedSearchParser.filterByTagQuery(
      datasets.basicTags, 
      tagQuery
    );
    assertEqual(result.length, 2); // Comedy and documentary bookmarks
    assertTrue(result.some(b => b.id === '2')); // Comedy
    assertTrue(result.some(b => b.id === '3')); // Documentary
  });

  totalTests++;
  passCount += runTest('Filter by tags (NOT)', () => {
    const tagQuery = { tags: ['action'], operator: 'NOT' };
    const result = AdvancedSearchParser.filterByTagQuery(
      datasets.basicTags, 
      tagQuery
    );
    assertEqual(result.length, 2); // All except action movie
    assertTrue(result.every(b => !b.tags.includes('action')));
  });

  // Tag Rendering Tests
  console.log('\n🎨 Tag Rendering Tests');

  totalTests++;
  passCount += runTest('Render single tag', () => {
    const result = TagRenderer.renderTag('action');
    assertEqual(result.tag, 'span');
    assertEqual(result.className, 'bookmark-tag');
    assertEqual(result.textContent, 'action');
    assertEqual(result.attributes['data-tag'], 'action');
  });

  totalTests++;
  passCount += runTest('Render tag list', () => {
    const tags = ['action', 'comedy', 'drama'];
    const result = TagRenderer.renderTagList(tags);
    assertEqual(result.tag, 'div');
    assertEqual(result.className, 'bookmark-tags');
    assertEqual(result.children.length, 3);
    assertEqual(result.children[0].textContent, 'action');
  });

  totalTests++;
  passCount += runTest('Handle empty tag list rendering', () => {
    assertEqual(TagRenderer.renderTagList([]), null);
    assertEqual(TagRenderer.renderTagList(null), null);
    assertEqual(TagRenderer.renderTagList(['', '  ']), null);
  });

  totalTests++;
  passCount += runTest('Generate consistent tag colors', () => {
    const color1 = TagRenderer.getTagColor('action');
    const color2 = TagRenderer.getTagColor('action');
    assertEqual(color1, color2);
    
    // Different tags should potentially have different colors
    const actionColor = TagRenderer.getTagColor('action');
    const comedyColor = TagRenderer.getTagColor('comedy');
    assertTrue(typeof actionColor === 'string');
    assertTrue(typeof comedyColor === 'string');
  });

  // Edge Case Tests
  console.log('\n🛡️  Edge Case Tests');

  totalTests++;
  passCount += runTest('Handle bookmarks without tags', () => {
    const tagQuery = { tags: ['action'], operator: 'AND' };
    const result = AdvancedSearchParser.filterByTagQuery(
      datasets.edgeCases.filter(b => b.id !== '6'), // Exclude mixed case which has Action
      tagQuery
    );
    assertEqual(result.length, 0); // No bookmarks should match
  });

  totalTests++;
  passCount += runTest('Handle case-insensitive tag matching', () => {
    const tagQuery = { tags: ['action'], operator: 'AND' };
    const result = AdvancedSearchParser.filterByTagQuery(
      datasets.edgeCases.filter(b => b.id === '6'), // Mixed case tags
      tagQuery
    );
    assertEqual(result.length, 1); // Should match despite case difference
  });

  totalTests++;
  passCount += runTest('Handle undefined tags property', () => {
    const bookmark = datasets.edgeCases.find(b => b.id === '5');
    assertTrue(!bookmark.tags); // Undefined tags
    
    const tagQuery = { tags: ['any'], operator: 'AND' };
    const result = AdvancedSearchParser.filterByTagQuery([bookmark], tagQuery);
    assertEqual(result.length, 0); // Should not match
  });

  // Performance Tests
  console.log('\n⚡ Performance Tests');

  totalTests++;
  passCount += runTest('Handle large tag arrays efficiently', () => {
    const largeTagArray = Array.from({ length: 1000 }, (_, i) => `tag${i}`);
    const startTime = Date.now();
    const result = TagInput.sanitizeTags(largeTagArray);
    const endTime = Date.now();
    
    assertEqual(result.length, 10); // Should be limited to 10
    assertTrue((endTime - startTime) < 100); // Should complete in under 100ms
  });

  // Summary
  console.log('\n📊 Test Summary');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${totalTests - passCount}`);
  console.log(`Success Rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);
  
  if (passCount === totalTests) {
    console.log('🎉 All tag parsing and rendering tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
  }
  
  return {
    total: totalTests,
    passed: passCount,
    failed: totalTests - passCount,
    successRate: (passCount / totalTests) * 100
  };
};

// Export for Node.js environment or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runTagTests,
    TagInput,
    AdvancedSearchParser,
    TagRenderer,
    createTagTestDatasets
  };
  // Auto-run tests when loaded in Node.js
  runTagTests();
} else {
  // Run tests if loaded in browser
  runTagTests();
} 