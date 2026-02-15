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

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Persist to localStorage outside of React state flow */
function persistToStorage(data: FilterHistoryData): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving filter history:', error);
    }
  }, 500);
}

export const useFilterHistory = () => {
  const [historyData, setHistoryData] = useState<FilterHistoryData>({
    recentSearches: [],
    customPresets: [],
    filterUsageStats: {},
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
          filterUsageStats: parsed.filterUsageStats || {},
        });
      }
    } catch (error) {
      console.error('Error loading filter history:', error);
    }
  }, []);

  // Add a search term to recent searches
  const addRecentSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;

    const trimmedTerm = searchTerm.trim();
    setHistoryData((prev) => {
      const newRecentSearches = [
        trimmedTerm,
        ...prev.recentSearches.filter((term) => term !== trimmedTerm),
      ].slice(0, MAX_RECENT_SEARCHES);

      const updated = { ...prev, recentSearches: newRecentSearches };
      persistToStorage(updated);
      return updated;
    });
  }, []);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setHistoryData((prev) => {
      const updated = { ...prev, recentSearches: [] };
      persistToStorage(updated);
      return updated;
    });
  }, []);

  // Save current filters as a custom preset
  const saveFilterPreset = useCallback(
    (name: string, description: string, filters: FilterState): string => {
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
          fileFilter: filters.fileFilter,
        },
        createdAt: new Date().toISOString(),
        usageCount: 0,
      };

      setHistoryData((prev) => {
        const newCustomPresets = [
          newPreset,
          ...prev.customPresets.filter((preset) => preset.name !== name.trim()),
        ].slice(0, MAX_CUSTOM_PRESETS);

        const updated = { ...prev, customPresets: newCustomPresets };
        persistToStorage(updated);
        return updated;
      });

      return newPreset.id;
    },
    [],
  );

  // Delete a custom preset
  const deleteFilterPreset = useCallback((presetId: string) => {
    setHistoryData((prev) => {
      const newCustomPresets = prev.customPresets.filter((preset) => preset.id !== presetId);
      const updated = { ...prev, customPresets: newCustomPresets };
      persistToStorage(updated);
      return updated;
    });
  }, []);

  // Update preset usage count
  const incrementPresetUsage = useCallback((presetId: string) => {
    setHistoryData((prev) => {
      const newCustomPresets = prev.customPresets.map((preset) =>
        preset.id === presetId ? { ...preset, usageCount: preset.usageCount + 1 } : preset,
      );
      const updated = { ...prev, customPresets: newCustomPresets };
      persistToStorage(updated);
      return updated;
    });
  }, []);

  return {
    recentSearches: historyData.recentSearches,
    customPresets: historyData.customPresets,
    addRecentSearch,
    clearRecentSearches,
    saveFilterPreset,
    deleteFilterPreset,
    incrementPresetUsage,
  };
};

export default useFilterHistory;
