import { useState, useCallback } from 'react';
import { FilterState } from '../components/FilterComponent';
import { AppWindow } from '../types';

/**
 * Custom hook for persisting state in localStorage
 * @param key - localStorage key
 * @param defaultValue - default value if nothing is stored
 * @returns [value, setValue] tuple similar to useState
 */
export function usePersistentState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setValue = (value: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      setState(value);
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [state, setValue];
}

/**
 * Hook specifically for persisting filter states per view
 * @param viewId - unique identifier for the view (e.g., 'sidebar', 'main', 'popup')
 * @param defaultFilters - default filter state
 */
export function usePersistentFilterState<T>(
  viewId: string,
  defaultFilters: T,
): [T, (filters: T) => void] {
  const storageKey = `iina-bookmarks-filters-${viewId}`;
  return usePersistentState(storageKey, defaultFilters);
}

// Add sort preferences persistence
export const usePersistentSortPreferences = (viewId: string) => {
  const [sortPreferences, setSortPreferences] = useState<Partial<FilterState>>({});

  const saveSortPreferences = useCallback(
    (preferences: Partial<FilterState>) => {
      setSortPreferences(preferences);
      // Send to plugin for persistence
      const appWindow = window as unknown as AppWindow;
      if (appWindow.iina?.postMessage) {
        appWindow.iina.postMessage('SAVE_SORT_PREFERENCES', {
          preferences: { viewId, ...preferences },
        });
      }
    },
    [viewId],
  );

  return { sortPreferences, saveSortPreferences };
};

export default usePersistentState;
