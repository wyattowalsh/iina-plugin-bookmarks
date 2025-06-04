import React, { useState } from 'react';
import { FilterComponent, FilterState } from '../ui/components/FilterComponent';

/**
 * Example demonstrating persistent filter state across different views
 * Each view maintains its own filter preferences
 */
export const PersistentFilterExample: React.FC = () => {
  const [currentView, setCurrentView] = useState<'sidebar' | 'main' | 'popup'>('main');
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateRange: { start: '', end: '' },
    tags: [],
    sortBy: 'createdAt',
    sortDirection: 'desc',
    fileFilter: ''
  });

  // Mock data for demonstration
  const mockTags = ['action', 'drama', 'comedy', 'thriller', 'romance'];
  const mockFiles = ['movie1.mp4', 'movie2.mp4', 'series1.mkv', 'documentary.mp4'];

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    console.log(`Filters updated for ${currentView} view:`, newFilters);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Persistent Filter State Demo</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Switch Views (each maintains separate filter state):</h3>
        <button 
          onClick={() => setCurrentView('sidebar')}
          style={{ 
            margin: '5px', 
            padding: '10px',
            backgroundColor: currentView === 'sidebar' ? '#007acc' : '#f0f0f0',
            color: currentView === 'sidebar' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Sidebar View
        </button>
        <button 
          onClick={() => setCurrentView('main')}
          style={{ 
            margin: '5px', 
            padding: '10px',
            backgroundColor: currentView === 'main' ? '#007acc' : '#f0f0f0',
            color: currentView === 'main' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Main View
        </button>
        <button 
          onClick={() => setCurrentView('popup')}
          style={{ 
            margin: '5px', 
            padding: '10px',
            backgroundColor: currentView === 'popup' ? '#007acc' : '#f0f0f0',
            color: currentView === 'popup' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Popup View
        </button>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
        <h3>Current View: {currentView}</h3>
        <p>
          Each view will remember its own sort preferences, search terms, and filter settings.
          Try changing filters, switching views, and returning to see the persistence in action.
        </p>
        
        <FilterComponent
          viewId={currentView}
          onFilterChange={handleFilterChange}
          availableTags={mockTags}
          availableFiles={mockFiles}
          resultsCount={42}
          showAdvanced={true}
        />
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h3>Current Filter State:</h3>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
          {JSON.stringify(filters, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
        <h3>How it works:</h3>
        <ul>
          <li><strong>Persistent Storage:</strong> Each view (sidebar, main, popup) maintains separate localStorage entries</li>
          <li><strong>Automatic Restoration:</strong> Filter states are automatically restored when components mount</li>
          <li><strong>Per-View Preferences:</strong> Users can have different sort orders and filters for different contexts</li>
          <li><strong>Storage Keys:</strong> 
            <ul>
              <li>Sidebar: <code>iina-bookmarks-filters-sidebar</code></li>
              <li>Main: <code>iina-bookmarks-filters-main</code></li>
              <li>Popup: <code>iina-bookmarks-filters-popup</code></li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PersistentFilterExample; 