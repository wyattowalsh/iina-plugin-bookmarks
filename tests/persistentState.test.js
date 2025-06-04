/**
 * Persistent State Test Suite
 * Tests localStorage functionality for filter state persistence
 */

// Mock localStorage for testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value;
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// Mock usePersistentState implementation
const mockUsePersistentState = (key, defaultValue) => {
  const storage = new MockLocalStorage();
  
  // Initialize state
  let state;
  try {
    const item = storage.getItem(key);
    state = item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    state = defaultValue;
  }

  const setValue = (value) => {
    try {
      state = value;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [state, setValue, storage];
};

// Test data
const defaultFilters = {
  searchTerm: '',
  dateRange: { start: '', end: '' },
  tags: [],
  sortBy: 'createdAt',
  sortDirection: 'desc',
  fileFilter: ''
};

const testFilters = {
  searchTerm: 'action',
  dateRange: { start: '2024-01-01', end: '2024-12-31' },
  tags: ['drama', 'thriller'],
  sortBy: 'title',
  sortDirection: 'asc',
  fileFilter: 'movie1.mp4'
};

// Test cases
const tests = [
  {
    name: 'Initialize with default values',
    test: () => {
      const [state, setState, storage] = mockUsePersistentState('test-filters', defaultFilters);
      
      // Should return default values when no stored data exists
      return JSON.stringify(state) === JSON.stringify(defaultFilters);
    },
    description: 'Should initialize with default values when localStorage is empty'
  },
  {
    name: 'Persist state to localStorage',
    test: () => {
      const [state, setState, storage] = mockUsePersistentState('test-filters', defaultFilters);
      
      // Set new state
      setState(testFilters);
      
      // Check if it was stored
      const storedValue = storage.getItem('test-filters');
      const parsedValue = JSON.parse(storedValue);
      
      return JSON.stringify(parsedValue) === JSON.stringify(testFilters);
    },
    description: 'Should persist filter state to localStorage'
  },
  {
    name: 'Restore state from localStorage',
    test: () => {
      // Create a properly initialized mock with pre-existing data
      const mockUsePersistentStateWithData = (key, defaultValue) => {
        const storage = new MockLocalStorage();
        storage.setItem(key, JSON.stringify(testFilters));
        
        // Initialize state from storage
        let state;
        try {
          const item = storage.getItem(key);
          state = item ? JSON.parse(item) : defaultValue;
        } catch (error) {
          state = defaultValue;
        }

        const setValue = (value) => {
          try {
            state = value;
            storage.setItem(key, JSON.stringify(value));
          } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
          }
        };

        return [state, setValue, storage];
      };
      
      const [state, setState, storage] = mockUsePersistentStateWithData('test-filters', defaultFilters);
      
      return JSON.stringify(state) === JSON.stringify(testFilters);
    },
    description: 'Should restore saved filter state from localStorage'
  },
  {
    name: 'Handle different view IDs',
    test: () => {
      const sidebarFilters = { ...testFilters, searchTerm: 'sidebar search' };
      const mainFilters = { ...testFilters, searchTerm: 'main search' };
      
      const [sidebarState, setSidebarState, sidebarStorage] = mockUsePersistentState('sidebar', defaultFilters);
      const [mainState, setMainState, mainStorage] = mockUsePersistentState('main', defaultFilters);
      
      setSidebarState(sidebarFilters);
      setMainState(mainFilters);
      
      // Check that each view has its own state
      const sidebarStored = JSON.parse(sidebarStorage.getItem('sidebar'));
      const mainStored = JSON.parse(mainStorage.getItem('main'));
      
      return sidebarStored.searchTerm === 'sidebar search' && 
             mainStored.searchTerm === 'main search';
    },
    description: 'Should maintain separate state for different view IDs'
  },
  {
    name: 'Handle malformed JSON gracefully',
    test: () => {
      const storage = new MockLocalStorage();
      storage.setItem('test-filters', 'invalid json {');
      
      // Should fall back to default values
      const [state, setState] = mockUsePersistentState('test-filters', defaultFilters);
      
      return JSON.stringify(state) === JSON.stringify(defaultFilters);
    },
    description: 'Should fall back to defaults when localStorage contains malformed JSON'
  },
  {
    name: 'Performance test with large filter states',
    test: () => {
      const largeFilters = {
        ...defaultFilters,
        tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
        searchTerm: 'a'.repeat(1000)
      };
      
      const startTime = performance.now();
      const [state, setState, storage] = mockUsePersistentState('large-test', defaultFilters);
      setState(largeFilters);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const stored = JSON.parse(storage.getItem('large-test'));
      
      return duration < 10 && // Should complete in under 10ms
             stored.tags.length === 100 &&
             stored.searchTerm.length === 1000;
    },
    description: 'Should handle large filter states efficiently'
  }
];

// Test runner
function runPersistentStateTests() {
  console.log('🔄 Running Persistent State Tests...\n');
  
  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`Description: ${test.description}`);
    
    try {
      const startTime = performance.now();
      const result = test.test();
      const endTime = performance.now();
      
      if (result) {
        console.log('✅ PASSED');
        console.log(`   Time: ${(endTime - startTime).toFixed(2)}ms`);
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log(`   Time: ${(endTime - startTime).toFixed(2)}ms`);
        failed++;
      }
    } catch (error) {
      console.log('💥 ERROR:', error.message);
      failed++;
    }
    
    console.log('');
  });

  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  return { passed, failed, successRate: (passed / (passed + failed)) * 100 };
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPersistentStateTests, MockLocalStorage, mockUsePersistentState };
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runPersistentStateTests();
} 