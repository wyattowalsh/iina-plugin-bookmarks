import React, { useState, useCallback } from 'react';
import { FilterState } from './FilterComponent';

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<FilterState>;
  icon?: string;
}

interface FilterPresetsProps {
  onApplyPreset: (filters: Partial<FilterState>) => void;
  onSaveCurrentAsPreset: (name: string, description: string) => void;
  currentFilters: FilterState;
  customPresets?: FilterPreset[];
  recentSearches?: string[];
  onClearHistory?: () => void;
  className?: string;
}

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'recent',
    name: 'Recent',
    description: 'Bookmarks created today',
    filters: {
      dateRange: {
        start: new Date().toISOString().split('T')[0],
        end: '',
      },
      sortBy: 'createdAt',
      sortDirection: 'desc',
    },
    icon: '🕒',
  },
  {
    id: 'this-week',
    name: 'This Week',
    description: 'Bookmarks from the past 7 days',
    filters: {
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: '',
      },
      sortBy: 'createdAt',
      sortDirection: 'desc',
    },
    icon: '📅',
  },
  {
    id: 'untagged',
    name: 'Untagged',
    description: 'Bookmarks without any tags',
    filters: {
      showOnlyUntagged: true,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    },
    icon: '🏷️',
  },
  {
    id: 'favorites',
    name: 'Favorites',
    description: 'Bookmarks with favorite tag',
    filters: {
      tags: ['favorite'],
      sortBy: 'createdAt',
      sortDirection: 'desc',
    },
    icon: '⭐',
  },
  {
    id: 'no-description',
    name: 'Need Description',
    description: 'Bookmarks missing descriptions',
    filters: {
      showOnlyNoDescription: true,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    },
    icon: '📝',
  },
];

export const FilterPresets: React.FC<FilterPresetsProps> = ({
  onApplyPreset,
  onSaveCurrentAsPreset,
  currentFilters,
  customPresets = [],
  recentSearches = [],
  onClearHistory,
  className = '',
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [expandedSection, setExpandedSection] = useState<'presets' | 'history' | null>('presets');

  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  const handleApplyPreset = useCallback(
    (preset: FilterPreset) => {
      onApplyPreset(preset.filters);
    },
    [onApplyPreset],
  );

  const handleSavePreset = useCallback(() => {
    if (newPresetName.trim()) {
      onSaveCurrentAsPreset(newPresetName.trim(), newPresetDescription.trim());
      setNewPresetName('');
      setNewPresetDescription('');
      setShowSaveDialog(false);
    }
  }, [newPresetName, newPresetDescription, onSaveCurrentAsPreset]);

  const isActivePreset = useCallback(
    (preset: FilterPreset): boolean => {
      const presetFilters = preset.filters;

      // Check if current filters match preset filters
      if (
        presetFilters.searchTerm !== undefined &&
        presetFilters.searchTerm !== currentFilters.searchTerm
      ) {
        return false;
      }

      if (presetFilters.sortBy && presetFilters.sortBy !== currentFilters.sortBy) {
        return false;
      }

      if (
        presetFilters.sortDirection &&
        presetFilters.sortDirection !== currentFilters.sortDirection
      ) {
        return false;
      }

      if (
        presetFilters.tags &&
        JSON.stringify(presetFilters.tags) !== JSON.stringify(currentFilters.tags)
      ) {
        return false;
      }

      if (
        presetFilters.fileFilter !== undefined &&
        presetFilters.fileFilter !== currentFilters.fileFilter
      ) {
        return false;
      }

      return true;
    },
    [currentFilters],
  );

  const hasActiveFilters = useCallback((): boolean => {
    return (
      currentFilters.searchTerm !== '' ||
      currentFilters.dateRange.start !== '' ||
      currentFilters.dateRange.end !== '' ||
      currentFilters.tags.length > 0 ||
      currentFilters.fileFilter !== '' ||
      currentFilters.sortBy !== 'createdAt' ||
      currentFilters.sortDirection !== 'desc'
    );
  }, [currentFilters]);

  const applyRecentSearch = useCallback(
    (searchTerm: string) => {
      onApplyPreset({ searchTerm });
    },
    [onApplyPreset],
  );

  return (
    <div className={`filter-presets ${className}`}>
      {/* Quick Presets */}
      <div className="presets-section">
        <button
          className="section-header"
          onClick={() => setExpandedSection(expandedSection === 'presets' ? null : 'presets')}
          aria-expanded={expandedSection === 'presets'}
          aria-label={`${expandedSection === 'presets' ? 'Collapse' : 'Expand'} quick filters`}
        >
          <span className="section-icon" aria-hidden="true">
            {expandedSection === 'presets' ? '▼' : '▶'}
          </span>
          <span className="section-title">Quick Filters</span>
          <span className="section-count">({allPresets.length})</span>
        </button>

        {expandedSection === 'presets' && (
          <div className="presets-content">
            <div className="preset-grid">
              {allPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-button ${isActivePreset(preset) ? 'active' : ''}`}
                  onClick={() => handleApplyPreset(preset)}
                  title={preset.description}
                >
                  {preset.icon && <span className="preset-icon">{preset.icon}</span>}
                  <span className="preset-name">{preset.name}</span>
                </button>
              ))}
            </div>

            {hasActiveFilters() && (
              <div className="save-preset-section">
                {!showSaveDialog ? (
                  <button className="save-preset-trigger" onClick={() => setShowSaveDialog(true)}>
                    💾 Save Current Filters as Preset
                  </button>
                ) : (
                  <div className="save-preset-dialog">
                    <input
                      type="text"
                      placeholder="Preset name"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="preset-name-input"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newPresetDescription}
                      onChange={(e) => setNewPresetDescription(e.target.value)}
                      className="preset-description-input"
                    />
                    <div className="dialog-actions">
                      <button
                        onClick={handleSavePreset}
                        className="save-btn"
                        disabled={!newPresetName.trim()}
                      >
                        Save
                      </button>
                      <button onClick={() => setShowSaveDialog(false)} className="cancel-btn">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="history-section">
          <button
            className="section-header"
            onClick={() => setExpandedSection(expandedSection === 'history' ? null : 'history')}
            aria-expanded={expandedSection === 'history'}
            aria-label={`${expandedSection === 'history' ? 'Collapse' : 'Expand'} recent searches`}
          >
            <span className="section-icon" aria-hidden="true">
              {expandedSection === 'history' ? '▼' : '▶'}
            </span>
            <span className="section-title">Recent Searches</span>
            <span className="section-count">({recentSearches.length})</span>
          </button>

          {expandedSection === 'history' && (
            <div className="history-content">
              <div className="history-list">
                {recentSearches.slice(0, 5).map((search, index) => (
                  <button
                    key={index}
                    className="history-item"
                    onClick={() => applyRecentSearch(search)}
                    title={`Apply search: ${search}`}
                  >
                    <span className="history-icon">🔍</span>
                    <span className="history-text">{search}</span>
                  </button>
                ))}
              </div>

              {onClearHistory && (
                <button className="clear-history-btn" onClick={onClearHistory}>
                  🗑️ Clear History
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPresets;
