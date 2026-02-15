/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { FilterComponent } from '../FilterComponent';

// Mock localStorage for usePersistentState
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('FilterComponent', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onFilterChange: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onFilterChange = vi.fn();
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container.remove();
    vi.useRealTimers();
  });

  it('should render the search input', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} />);
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.placeholder).toBe('Search bookmarks...');
  });

  it('should render the sort select', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} />);
    });

    const select = container.querySelector('.single-sort-container select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    // Default sort is createdAt-desc
    expect(select.value).toBe('createdAt-desc');
  });

  it('should call onFilterChange on mount with persistent filters', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} />);
    });

    // The mount effect fires and sends current filters to parent
    expect(onFilterChange).toHaveBeenCalled();
    const filters = onFilterChange.mock.calls[0][0];
    expect(filters.searchTerm).toBe('');
    expect(filters.sortBy).toBe('createdAt');
    expect(filters.sortDirection).toBe('desc');
  });

  it('should debounce search input changes', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} />);
    });

    onFilterChange.mockClear();

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    // Type a search term
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      nativeInputValueSetter.call(input, 'test query');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Before debounce fires, onFilterChange should not have been called with search term
    const callsBeforeDebounce = onFilterChange.mock.calls.filter(
      (call: any[]) => call[0].searchTerm === 'test query',
    );
    expect(callsBeforeDebounce).toHaveLength(0);

    // Advance timers past debounce delay (300ms)
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const callsAfterDebounce = onFilterChange.mock.calls.filter(
      (call: any[]) => call[0].searchTerm === 'test query',
    );
    expect(callsAfterDebounce.length).toBeGreaterThanOrEqual(1);
  });

  it('should render tag dropdown when availableTags provided', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <FilterComponent
          onFilterChange={onFilterChange}
          availableTags={['action', 'drama', 'comedy']}
        />,
      );
    });

    const tagButton = container.querySelector('.dropdown-toggle');
    expect(tagButton).not.toBeNull();
    expect(tagButton!.textContent).toContain('Tags (0)');
  });

  it('should toggle tag dropdown open/closed', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <FilterComponent onFilterChange={onFilterChange} availableTags={['action', 'drama']} />,
      );
    });

    const tagButton = container.querySelector('.dropdown-toggle') as HTMLButtonElement;

    // Dropdown should be closed initially
    expect(container.querySelector('.dropdown-menu')).toBeNull();

    // Click to open
    act(() => {
      tagButton.click();
    });

    expect(container.querySelector('.dropdown-menu')).not.toBeNull();
    const items = container.querySelectorAll('.dropdown-item');
    expect(items).toHaveLength(2);

    // Click to close
    act(() => {
      tagButton.click();
    });

    expect(container.querySelector('.dropdown-menu')).toBeNull();
  });

  it('should render file filter when availableFiles provided', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <FilterComponent
          onFilterChange={onFilterChange}
          availableFiles={['movie.mp4', 'show.mkv']}
        />,
      );
    });

    const fileSelect = container.querySelectorAll('select');
    // Should have sort select + file filter select
    const options = Array.from(fileSelect).flatMap((s) => Array.from(s.options));
    const fileOptions = options.filter((o) => o.value === 'movie.mp4' || o.value === 'show.mkv');
    expect(fileOptions).toHaveLength(2);
  });

  it('should show results count when provided', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} resultsCount={42} />);
    });

    const resultsDiv = container.querySelector('.filter-results-count');
    expect(resultsDiv).not.toBeNull();
    expect(resultsDiv!.textContent).toContain('42 bookmarks found');
  });

  it('should apply compact class when compact prop is true', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} compact={true} />);
    });

    const filterContainer = container.querySelector('.filter-container');
    expect(filterContainer!.classList.contains('compact')).toBe(true);
  });

  it('should have role="search" for a11y', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} />);
    });

    const searchRegion = container.querySelector('[role="search"]');
    expect(searchRegion).not.toBeNull();
    expect(searchRegion!.getAttribute('aria-label')).toBe('Bookmark filters');
  });

  it('should render clear all filters button when tags are selected', () => {
    // Pre-seed localStorage with a tag filter
    localStorageMock.getItem.mockReturnValueOnce(
      JSON.stringify({
        searchTerm: '',
        dateRange: { start: '', end: '' },
        tags: ['action'],
        sortBy: 'createdAt',
        sortDirection: 'desc',
        fileFilter: '',
        sortCriteria: [],
        enableMultiSort: false,
      }),
    );

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <FilterComponent onFilterChange={onFilterChange} availableTags={['action', 'drama']} />,
      );
    });

    const clearButton = container.querySelector('.filter-clear');
    expect(clearButton).not.toBeNull();
    expect(clearButton!.textContent).toContain('Clear all filters');
  });

  it('should toggle advanced filters panel', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} availableTags={['action']} />);
    });

    const toggleButton = container.querySelector('.advanced-toggle') as HTMLButtonElement;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

    // Click to open
    act(() => {
      toggleButton.click();
    });

    expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
  });

  it('should enable multi-sort mode', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<FilterComponent onFilterChange={onFilterChange} />);
    });

    const multiSortButton = container.querySelector('.enable-multi-sort') as HTMLButtonElement;
    expect(multiSortButton).not.toBeNull();

    act(() => {
      multiSortButton.click();
    });

    // Should now show multi-sort container
    const multiSortContainer = container.querySelector('.multi-sort-container');
    expect(multiSortContainer).not.toBeNull();
  });
});
