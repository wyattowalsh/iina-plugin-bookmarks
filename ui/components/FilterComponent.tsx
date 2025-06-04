import React, { useState, useCallback, useMemo } from "react";
import useDebounce from "../hooks/useDebounce";

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
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    ...initialFilters
  });
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(showAdvanced);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.searchTerm);

  // Debounce search input for performance
  const debouncedSearchTerm = useDebounce(searchInput, 300);

  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  }, [filters, onFilterChange]);

  // Update filters when debounced search term changes
  React.useEffect(() => {
    if (debouncedSearchTerm !== filters.searchTerm) {
      updateFilters({ searchTerm: debouncedSearchTerm });
    }
  }, [debouncedSearchTerm, filters.searchTerm, updateFilters]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortDirection] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['sortDirection']];
    updateFilters({ sortBy, sortDirection });
  }, [updateFilters]);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    updateFilters({
      dateRange: { ...filters.dateRange, [field]: value }
    });
  }, [filters.dateRange, updateFilters]);

  const handleTagToggle = useCallback((tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    updateFilters({ tags: newTags });
  }, [filters.tags, updateFilters]);

  const handleRemoveTag = useCallback((tag: string) => {
    updateFilters({ tags: filters.tags.filter(t => t !== tag) });
  }, [filters.tags, updateFilters]);

  const handleFileFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilters({ fileFilter: e.target.value });
  }, [updateFilters]);

  const clearAllFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSearchInput('');
    onFilterChange(defaultFilters);
  }, [onFilterChange]);

  const hasActiveFilters = useMemo(() => {
    return filters.searchTerm || 
           filters.dateRange.start || 
           filters.dateRange.end || 
           filters.tags.length > 0 || 
           filters.fileFilter;
  }, [filters]);

  const currentSortValue = `${filters.sortBy}-${filters.sortDirection}`;

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
              value={filters.fileFilter}
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
                Tags ({filters.tags.length})
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
                        checked={filters.tags.includes(tag)}
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
      {filters.tags.length > 0 && (
        <div className="filter-tags">
          {filters.tags.map(tag => (
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
                      value={filters.dateRange.start}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    />
                    <span className="date-separator">to</span>
                    <input
                      type="date"
                      value={filters.dateRange.end}
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