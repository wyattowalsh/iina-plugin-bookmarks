import React, { useState, useCallback, useMemo } from "react";
import useDebounce from "../hooks/useDebounce";
import { usePersistentFilterState } from "../hooks/usePersistentState";

export interface FilterState {
  searchTerm: string;
  dateRange: {
    start: string;
    end: string;
  };
  tags: string[];
  sortBy: 'timestamp' | 'title' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  fileFilter: string;
}

interface FilterComponentProps {
  onFilterChange: (filters: FilterState) => void;
  availableTags?: string[];
  availableFiles?: string[];
  resultsCount?: number;
  compact?: boolean;
  showAdvanced?: boolean;
  initialFilters?: Partial<FilterState>;
  viewId?: string;
}

const defaultFilters: FilterState = {
  searchTerm: '',
  dateRange: { start: '', end: '' },
  tags: [],
  sortBy: 'createdAt',
  sortDirection: 'desc',
  fileFilter: ''
};

export const FilterComponent: React.FC<FilterComponentProps> = ({
  onFilterChange,
  availableTags = [],
  availableFiles = [],
  resultsCount,
  compact = false,
  showAdvanced = false,
  initialFilters = {},
  viewId = 'default'
}) => {
  // Use persistent state for filters, but merge with initial filters
  const baseFilters = { ...defaultFilters, ...initialFilters };
  const [persistentFilters, setPersistentFilters] = usePersistentFilterState(viewId, baseFilters);
  
  // For non-persistent state like UI interactions
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(showAdvanced);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(persistentFilters.searchTerm);

  // Debounce search input for performance
  const debouncedSearchTerm = useDebounce(searchInput, 300);

  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...persistentFilters, ...newFilters };
    setPersistentFilters(updatedFilters);
    onFilterChange(updatedFilters);
  }, [persistentFilters, onFilterChange, setPersistentFilters]);

  // Update filters when debounced search term changes
  React.useEffect(() => {
    if (debouncedSearchTerm !== persistentFilters.searchTerm) {
      updateFilters({ searchTerm: debouncedSearchTerm });
    }
  }, [debouncedSearchTerm, persistentFilters.searchTerm, updateFilters]);

  // Initialize parent component with persistent filters on mount
  React.useEffect(() => {
    onFilterChange(persistentFilters);
  }, []); // Only run on mount

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortDirection] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['sortDirection']];
    updateFilters({ sortBy, sortDirection });
  }, [updateFilters]);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    updateFilters({
      dateRange: { ...persistentFilters.dateRange, [field]: value }
    });
  }, [persistentFilters.dateRange, updateFilters]);

  const handleTagToggle = useCallback((tag: string) => {
    const newTags = persistentFilters.tags.includes(tag)
      ? persistentFilters.tags.filter(t => t !== tag)
      : [...persistentFilters.tags, tag];
    updateFilters({ tags: newTags });
  }, [persistentFilters.tags, updateFilters]);

  const handleRemoveTag = useCallback((tag: string) => {
    updateFilters({ tags: persistentFilters.tags.filter(t => t !== tag) });
  }, [persistentFilters.tags, updateFilters]);

  const handleFileFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilters({ fileFilter: e.target.value });
  }, [updateFilters]);

  const clearAllFilters = useCallback(() => {
    setPersistentFilters(defaultFilters);
    setSearchInput('');
    onFilterChange(defaultFilters);
  }, [onFilterChange]);

  const hasActiveFilters = useMemo(() => {
    return persistentFilters.searchTerm || 
           persistentFilters.dateRange.start || 
           persistentFilters.dateRange.end || 
           persistentFilters.tags.length > 0 || 
           persistentFilters.fileFilter;
  }, [persistentFilters]);

  const currentSortValue = `${persistentFilters.sortBy}-${persistentFilters.sortDirection}`;

  return (
    <div className={`filter-container ${compact ? 'compact' : ''}`}>
      {/* Primary Filter Row */}
      <div className="filter-row">
        <div className="filter-group">
          <input
            type="text"
            className={`filter-input ${compact ? 'compact' : ''}`}
            placeholder="Search bookmarks..."
            value={searchInput}
            onChange={handleSearchChange}
          />
        </div>

        <div className="filter-group">
          <select
            className={`filter-select ${compact ? 'compact' : ''}`}
            value={currentSortValue}
            onChange={handleSortChange}
          >
            <option value="createdAt-desc">Latest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="timestamp-asc">Time (Start)</option>
            <option value="timestamp-desc">Time (End)</option>
          </select>
        </div>

        {availableFiles.length > 0 && (
          <div className="filter-group">
            <select
              className={`filter-select ${compact ? 'compact' : ''}`}
              value={persistentFilters.fileFilter}
              onChange={handleFileFilterChange}
            >
              <option value="">All Files</option>
              {availableFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
          </div>
        )}

        {availableTags.length > 0 && (
          <div className="filter-group">
            <div className="multi-select-dropdown">
              <button
                className={`dropdown-toggle ${compact ? 'compact' : ''}`}
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              >
                Tags ({persistentFilters.tags.length})
              </button>
              {tagDropdownOpen && (
                <div className="dropdown-menu">
                  {availableTags.map(tag => (
                    <div
                      key={tag}
                      className="dropdown-item"
                      onClick={() => handleTagToggle(tag)}
                    >
                      <input
                        type="checkbox"
                        checked={persistentFilters.tags.includes(tag)}
                        readOnly
                      />
                      <span>{tag}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Filter Tags */}
      {persistentFilters.tags.length > 0 && (
        <div className="filter-tags">
          {persistentFilters.tags.map(tag => (
            <span key={tag} className="filter-tag">
              {tag}
              <span className="remove-tag" onClick={() => handleRemoveTag(tag)}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* Advanced Filter Panel */}
      {availableTags.length > 0 && (
        <div className="advanced-filter-panel">
          <div 
            className="advanced-toggle"
            onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
          >
            <span>{showAdvancedPanel ? '▼' : '▶'}</span>
            <span>Advanced Filters</span>
          </div>
          
          {showAdvancedPanel && (
            <div className="advanced-content">
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label">Date Range</label>
                  <div className="date-range-picker">
                    <input
                      type="date"
                      value={persistentFilters.dateRange.start}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    />
                    <span className="date-separator">to</span>
                    <input
                      type="date"
                      value={persistentFilters.dateRange.end}
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results and Clear */}
      <div className="filter-row">
        {resultsCount !== undefined && (
          <div className="filter-results-count">
            {resultsCount} bookmark{resultsCount !== 1 ? 's' : ''} found
          </div>
        )}
        
        {hasActiveFilters && (
          <button className="filter-clear" onClick={clearAllFilters}>
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterComponent; 