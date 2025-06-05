import { useState, useCallback, useEffect } from 'react';
import { FilterState } from '../components/FilterComponent';

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<FilterState>;
  createdAt: string;
  usageCount: number;
}

interface FilterHistoryData {
  recentSearches: string[];
  customPresets: FilterPreset[];
  filterUsageStats: Record<string, number>;
}

const STORAGE_KEY = 'bookmark-filter-history';
const MAX_RECENT_SEARCHES = 10;
const MAX_CUSTOM_PRESETS = 20;

export const useFilterHistory = () => {
  const [historyData, setHistoryData] = useState<FilterHistoryData>({
    recentSearches: [],
    customPresets: [],
    filterUsageStats: {}
  });

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FilterHistoryData;
        setHistoryData({
          recentSearches: parsed.recentSearches || [],
          customPresets: parsed.customPresets || [],
          filterUsageStats: parsed.filterUsageStats || {}
        });
      }
    } catch (error) {
      console.error('Error loading filter history:', error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((newData: FilterHistoryData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setHistoryData(newData);
    } catch (error) {
      console.error('Error saving filter history:', error);
    }
  }, []);

  // Add a search term to recent searches
  const addRecentSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;

    const trimmedTerm = searchTerm.trim();
    const newRecentSearches = [
      trimmedTerm,
      ...historyData.recentSearches.filter(term => term !== trimmedTerm)
    ].slice(0, MAX_RECENT_SEARCHES);

    saveHistory({
      ...historyData,
      recentSearches: newRecentSearches
    });
  }, [historyData, saveHistory]);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    saveHistory({
      ...historyData,
      recentSearches: []
    });
  }, [historyData, saveHistory]);

  // Save current filters as a custom preset
  const saveFilterPreset = useCallback((name: string, description: string, filters: FilterState) => {
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      filters: {
        searchTerm: filters.searchTerm,
        dateRange: filters.dateRange,
        tags: [...filters.tags],
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
        fileFilter: filters.fileFilter
      },
      createdAt: new Date().toISOString(),
      usageCount: 0
    };

    const newCustomPresets = [
      newPreset,
      ...historyData.customPresets.filter(preset => preset.name !== name.trim())
    ].slice(0, MAX_CUSTOM_PRESETS);

    saveHistory({
      ...historyData,
      customPresets: newCustomPresets
    });

    return newPreset.id;
  }, [historyData, saveHistory]);

  // Delete a custom preset
  const deleteFilterPreset = useCallback((presetId: string) => {
    const newCustomPresets = historyData.customPresets.filter(preset => preset.id !== presetId);
    
    saveHistory({
      ...historyData,
      customPresets: newCustomPresets
    });
  }, [historyData, saveHistory]);

  // Update preset usage count
  const incrementPresetUsage = useCallback((presetId: string) => {
    const newCustomPresets = historyData.customPresets.map(preset => 
      preset.id === presetId 
        ? { ...preset, usageCount: preset.usageCount + 1 }
        : preset
    );

    saveHistory({
      ...historyData,
      customPresets: newCustomPresets
    });
  }, [historyData, saveHistory]);

  // Track filter usage for analytics
  const trackFilterUsage = useCallback((filterType: string) => {
    const newStats = {
      ...historyData.filterUsageStats,
      [filterType]: (historyData.filterUsageStats[filterType] || 0) + 1
    };

    saveHistory({
      ...historyData,
      filterUsageStats: newStats
    });
  }, [historyData, saveHistory]);

  // Get most used filters for suggestions
  const getMostUsedFilters = useCallback(() => {
    return Object.entries(historyData.filterUsageStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([filter, count]) => ({ filter, count }));
  }, [historyData.filterUsageStats]);

  // Get popular custom presets (by usage count)
  const getPopularPresets = useCallback(() => {
    return [...historyData.customPresets]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
  }, [historyData.customPresets]);

  // Export filter history for backup
  const exportHistory = useCallback(() => {
    const exportData = {
      ...historyData,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmark-filter-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [historyData]);

  // Import filter history from backup
  const importHistory = useCallback((file: File) => {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target?.result as string);
          
          // Validate imported data structure
          if (importData.recentSearches && importData.customPresets) {
            const mergedData: FilterHistoryData = {
              recentSearches: [
                ...historyData.recentSearches,
                ...(importData.recentSearches || [])
              ].slice(0, MAX_RECENT_SEARCHES),
              customPresets: [
                ...historyData.customPresets,
                ...(importData.customPresets || [])
              ].slice(0, MAX_CUSTOM_PRESETS),
              filterUsageStats: {
                ...historyData.filterUsageStats,
                ...(importData.filterUsageStats || {})
              }
            };
            
            saveHistory(mergedData);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          console.error('Error importing filter history:', error);
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }, [historyData, saveHistory]);

  // Clear all history data
  const clearAllHistory = useCallback(() => {
    const emptyData: FilterHistoryData = {
      recentSearches: [],
      customPresets: [],
      filterUsageStats: {}
    };
    saveHistory(emptyData);
  }, [saveHistory]);

  return {
    // Data
    recentSearches: historyData.recentSearches,
    customPresets: historyData.customPresets,
    filterUsageStats: historyData.filterUsageStats,
    
    // Search history actions
    addRecentSearch,
    clearRecentSearches,
    
    // Preset actions
    saveFilterPreset,
    deleteFilterPreset,
    incrementPresetUsage,
    
    // Analytics actions
    trackFilterUsage,
    getMostUsedFilters,
    getPopularPresets,
    
    // Import/Export
    exportHistory,
    importHistory,
    clearAllHistory
  };
};

export default useFilterHistory; 