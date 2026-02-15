import React, { useState, useCallback, useMemo } from 'react';
import useDebounce from '../hooks/useDebounce';
import {
  usePersistentFilterState,
  usePersistentSortPreferences,
} from '../hooks/usePersistentState';

export interface FilterState {
  searchTerm: string;
  dateRange: {
    start: string;
    end: string;
  };
  tags: string[];
  sortBy: 'timestamp' | 'title' | 'createdAt' | 'description' | 'tags' | 'mediaFileName';
  sortDirection: 'asc' | 'desc';
  fileFilter: string;
  sortCriteria: Array<{
    field: 'timestamp' | 'title' | 'createdAt' | 'description' | 'tags' | 'mediaFileName';
    direction: 'asc' | 'desc';
    priority: number;
  }>;
  enableMultiSort: boolean;
  showOnlyUntagged?: boolean;
  showOnlyNoDescription?: boolean;
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

export const DEFAULT_FILTER_STATE: FilterState = {
  searchTerm: '',
  dateRange: { start: '', end: '' },
  tags: [],
  sortBy: 'createdAt',
  sortDirection: 'desc',
  fileFilter: '',
  sortCriteria: [],
  enableMultiSort: false,
};

export const FilterComponent: React.FC<FilterComponentProps> = ({
  onFilterChange,
  availableTags = [],
  availableFiles = [],
  resultsCount,
  compact = false,
  showAdvanced = false,
  initialFilters = {},
  viewId = 'default',
}) => {
  // Use persistent state for filters, but merge with initial filters
  const baseFilters = { ...DEFAULT_FILTER_STATE, ...initialFilters };
  const [persistentFilters, setPersistentFilters] = usePersistentFilterState(viewId, baseFilters);

  // Use persistent sort preferences
  const { saveSortPreferences } = usePersistentSortPreferences(viewId);

  // For non-persistent state like UI interactions
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(showAdvanced);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(persistentFilters.searchTerm);

  // Debounce search input for performance
  const debouncedSearchTerm = useDebounce(searchInput, 300);

  const updateFilters = useCallback(
    (newFilters: Partial<FilterState>) => {
      const updatedFilters = { ...persistentFilters, ...newFilters };
      setPersistentFilters(updatedFilters);
      onFilterChange(updatedFilters);

      // Save sort preferences when sort-related fields change
      if (
        'sortBy' in newFilters ||
        'sortDirection' in newFilters ||
        'sortCriteria' in newFilters ||
        'enableMultiSort' in newFilters
      ) {
        saveSortPreferences({
          sortBy: updatedFilters.sortBy,
          sortDirection: updatedFilters.sortDirection,
          sortCriteria: updatedFilters.sortCriteria,
          enableMultiSort: updatedFilters.enableMultiSort,
        });
      }
    },
    [persistentFilters, onFilterChange, setPersistentFilters, saveSortPreferences],
  );

  // Update filters when debounced search term changes
  React.useEffect(() => {
    if (debouncedSearchTerm !== persistentFilters.searchTerm) {
      updateFilters({ searchTerm: debouncedSearchTerm });
    }
  }, [debouncedSearchTerm, persistentFilters.searchTerm, updateFilters]);

  // Initialize parent component with persistent filters on mount

  React.useEffect(() => {
    onFilterChange(persistentFilters);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const [sortBy, sortDirection] = e.target.value.split('-') as [
        FilterState['sortBy'],
        FilterState['sortDirection'],
      ];
      updateFilters({ sortBy, sortDirection });
    },
    [updateFilters],
  );

  const handleDateRangeChange = useCallback(
    (field: 'start' | 'end', value: string) => {
      updateFilters({
        dateRange: { ...persistentFilters.dateRange, [field]: value },
      });
    },
    [persistentFilters.dateRange, updateFilters],
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      const newTags = persistentFilters.tags.includes(tag)
        ? persistentFilters.tags.filter((t) => t !== tag)
        : [...persistentFilters.tags, tag];
      updateFilters({ tags: newTags });
    },
    [persistentFilters.tags, updateFilters],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      updateFilters({ tags: persistentFilters.tags.filter((t) => t !== tag) });
    },
    [persistentFilters.tags, updateFilters],
  );

  const handleFileFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateFilters({ fileFilter: e.target.value });
    },
    [updateFilters],
  );

  const clearAllFilters = useCallback(() => {
    setPersistentFilters(DEFAULT_FILTER_STATE);
    setSearchInput('');
    onFilterChange(DEFAULT_FILTER_STATE);
  }, [onFilterChange]);

  const hasActiveFilters = useMemo(() => {
    return (
      persistentFilters.searchTerm ||
      persistentFilters.dateRange.start ||
      persistentFilters.dateRange.end ||
      persistentFilters.tags.length > 0 ||
      persistentFilters.fileFilter
    );
  }, [persistentFilters]);

  const currentSortValue = `${persistentFilters.sortBy}-${persistentFilters.sortDirection}`;

  const handleSortCriterionChange = useCallback(
    (index: number, field: string, value: string) => {
      const updatedCriteria = [...persistentFilters.sortCriteria];
      if (field === 'field' || field === 'direction') {
        (updatedCriteria[index] as any)[field] = value;
      }
      updateFilters({ sortCriteria: updatedCriteria });
    },
    [persistentFilters.sortCriteria, updateFilters],
  );

  const removeSortCriterion = useCallback(
    (index: number) => {
      const updatedCriteria = persistentFilters.sortCriteria.filter((_, i) => i !== index);
      updateFilters({ sortCriteria: updatedCriteria });
    },
    [persistentFilters.sortCriteria, updateFilters],
  );

  const addSortCriterion = useCallback(() => {
    const updatedCriteria = [
      ...persistentFilters.sortCriteria,
      {
        field: persistentFilters.sortBy,
        direction: persistentFilters.sortDirection,
        priority: persistentFilters.sortCriteria.length + 1,
      },
    ];
    updateFilters({ sortCriteria: updatedCriteria });
  }, [
    persistentFilters.sortBy,
    persistentFilters.sortDirection,
    persistentFilters.sortCriteria,
    updateFilters,
  ]);

  return (
    <div
      className={`filter-container ${compact ? 'compact' : ''}`}
      role="search"
      aria-label="Bookmark filters"
    >
      {/* Primary Filter Row */}
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor={`search-input-${viewId}`} className="sr-only">
            Search bookmarks
          </label>
          <input
            id={`search-input-${viewId}`}
            type="text"
            className={`filter-input ${compact ? 'compact' : ''}`}
            placeholder="Search bookmarks..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-describedby={resultsCount !== undefined ? `search-results-${viewId}` : undefined}
          />
          {resultsCount !== undefined && (
            <div id={`search-results-${viewId}`} className="sr-only" aria-live="polite">
              {resultsCount} results found
            </div>
          )}
        </div>

        <div className="filter-group">
          {persistentFilters.enableMultiSort ? (
            <div className="multi-sort-container">
              <div className="multi-sort-header">
                <span>Multi-Sort</span>
                <button
                  onClick={() => updateFilters({ enableMultiSort: false, sortCriteria: [] })}
                  className="disable-multi-sort"
                  title="Disable multi-criteria sorting"
                >
                  ✕
                </button>
              </div>
              <div className="multi-sort-criteria">
                {persistentFilters.sortCriteria.map((criterion, index) => (
                  <div key={index} className="sort-criterion">
                    <span className="criterion-priority">{index + 1}</span>
                    <select
                      value={criterion.field}
                      onChange={(e) => handleSortCriterionChange(index, 'field', e.target.value)}
                      className="criterion-field"
                    >
                      <option value="createdAt">Date Created</option>
                      <option value="title">Title</option>
                      <option value="timestamp">Timestamp</option>
                      <option value="description">Description</option>
                      <option value="tags">Tags</option>
                      <option value="mediaFileName">File Name</option>
                    </select>
                    <select
                      value={criterion.direction}
                      onChange={(e) =>
                        handleSortCriterionChange(index, 'direction', e.target.value)
                      }
                      className="criterion-direction"
                    >
                      <option value="asc">↑ Asc</option>
                      <option value="desc">↓ Desc</option>
                    </select>
                    <button
                      onClick={() => removeSortCriterion(index)}
                      className="remove-criterion"
                      title="Remove this sort criterion"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {persistentFilters.sortCriteria.length < 3 && (
                  <button
                    onClick={addSortCriterion}
                    className="add-criterion"
                    title="Add another sort criterion"
                  >
                    + Add Sort
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="single-sort-container">
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
                <option value="description-asc">Description A-Z</option>
                <option value="description-desc">Description Z-A</option>
                <option value="tags-asc">Tags A-Z</option>
                <option value="tags-desc">Tags Z-A</option>
                <option value="mediaFileName-asc">File Name A-Z</option>
                <option value="mediaFileName-desc">File Name Z-A</option>
              </select>
              <button
                onClick={() =>
                  updateFilters({
                    enableMultiSort: true,
                    sortCriteria: [
                      {
                        field: persistentFilters.sortBy,
                        direction: persistentFilters.sortDirection,
                        priority: 1,
                      },
                    ],
                  })
                }
                className="enable-multi-sort"
                title="Enable multi-criteria sorting"
              >
                ⚡ Multi
              </button>
            </div>
          )}
        </div>

        {availableFiles.length > 0 && (
          <div className="filter-group">
            <select
              className={`filter-select ${compact ? 'compact' : ''}`}
              value={persistentFilters.fileFilter}
              onChange={handleFileFilterChange}
            >
              <option value="">All Files</option>
              {availableFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
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
                  {availableTags.map((tag) => (
                    <div key={tag} className="dropdown-item" onClick={() => handleTagToggle(tag)}>
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
          {persistentFilters.tags.map((tag) => (
            <span key={tag} className="filter-tag">
              {tag}
              <span className="remove-tag" onClick={() => handleRemoveTag(tag)}>
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Advanced Filter Panel */}
      {availableTags.length > 0 && (
        <div className="advanced-filter-panel">
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
            aria-expanded={showAdvancedPanel}
            aria-label={`${showAdvancedPanel ? 'Hide' : 'Show'} advanced filters`}
          >
            <span aria-hidden="true">{showAdvancedPanel ? '▼' : '▶'}</span>
            <span>Advanced Filters</span>
          </button>

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
