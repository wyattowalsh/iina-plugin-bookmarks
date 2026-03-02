import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import FilterComponent, { FilterState, DEFAULT_FILTER_STATE } from '../components/FilterComponent';
import AdvancedSearch, { ParsedSearchQuery } from '../components/AdvancedSearch';
import FilterPresets from '../components/FilterPresets';
import TextHighlighter from '../components/TextHighlighter';
import TagInput from '../components/TagInput';
import AddBookmarkDialog from '../components/AddBookmarkDialog';
import ExportDialog from '../components/ExportDialog';
import ImportDialog from '../components/ImportDialog';
import { ToastContainer } from '../components/Toast';
import FileGroupedBookmarkList from '../components/FileGroupedBookmarkList';
import BookmarkGallery from '../components/BookmarkGallery';
import FileSummaryCards from '../components/FileSummaryCards';
import StatsDashboard from '../components/StatsDashboard';
import BookmarkThumbnail from '../components/BookmarkThumbnail';
import BookmarkTimeline from '../components/BookmarkTimeline';
import { getColorHex } from '../components/BookmarkColorPicker';
import KeyboardShortcuts from '../components/KeyboardShortcuts';
import useAdvancedBookmarkFilters, {
  groupBookmarksByFile,
} from '../hooks/useAdvancedBookmarkFilters';
import useFilterHistory from '../hooks/useFilterHistory';
import useToast from '../hooks/useToast';
import { useIinaMessages } from '../hooks/useIinaMessages';
import { useEscapeKey } from '../hooks/useEscapeKey';
import {
  BookmarkData,
  BookmarkColor,
  BookmarkCollection,
  SmartCollection,
  PlaybackStatus,
  AppWindow,
  normalizeExportResult,
} from '../types';
import { formatTime, formatDate, formatRelativeTime } from '../utils/formatTime';

type ViewMode = 'grouped' | 'flat' | 'gallery' | 'timeline';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  grouped: 'Grouped',
  flat: 'List',
  gallery: 'Gallery',
  timeline: 'Timeline',
};

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | undefined>();
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // New state for multi-view hub
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [showStats, setShowStats] = useState(false);
  const [fileFilter, setFileFilter] = useState<string | undefined>();
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus | null>(null);
  const [currentFile, setCurrentFile] = useState<string | undefined>();
  const [_collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [_smartCollections, setSmartCollections] = useState<SmartCollection[]>([]);

  // Multi-select / batch mode
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const appWindow = window as unknown as AppWindow;
  const { toasts, showToast, showError, dismissToast } = useToast();

  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const deletedSnapshotRef = useRef<BookmarkData | null>(null);

  const { filteredBookmarks, resultsCount, availableFiles, availableTags, analytics } =
    useAdvancedBookmarkFilters({
      bookmarks,
      filters,
      parsedQuery: useAdvancedSearch ? parsedQuery : undefined,
    });

  // Apply file filter from FileSummaryCards
  const displayedBookmarks = useMemo(() => {
    if (!fileFilter) return filteredBookmarks;
    return filteredBookmarks.filter((b) => b.filepath === fileFilter);
  }, [filteredBookmarks, fileFilter]);

  const bookmarksByFile = useMemo(
    () => groupBookmarksByFile(displayedBookmarks),
    [displayedBookmarks],
  );

  const { recentSearches, customPresets, addRecentSearch, clearRecentSearches, saveFilterPreset } =
    useFilterHistory();

  // Use refs for mutable state accessed inside the message handler
  const selectedBookmarkRef = useRef(selectedBookmark);
  selectedBookmarkRef.current = selectedBookmark;

  useIinaMessages(
    {
      BOOKMARKS_UPDATED: (data: BookmarkData[]) => {
        setBookmarks(data);
        const current = selectedBookmarkRef.current;
        if (current && !data.find((b: BookmarkData) => b.id === current.id)) {
          setSelectedBookmark(null);
          setIsEditing(false);
        }
      },

      BOOKMARK_DELETED: () => {
        const snapshot = deletedSnapshotRef.current;
        deletedSnapshotRef.current = null;
        if (snapshot) {
          showToastRef.current({
            type: 'success',
            title: 'Bookmark Deleted',
            message: 'Bookmark removed successfully',
            duration: 6000,
            action: {
              label: 'Undo',
              onClick: () => {
                appWindow.iina?.postMessage?.('ADD_BOOKMARK', {
                  title: snapshot.title,
                  description: snapshot.description,
                  tags: snapshot.tags,
                  timestamp: snapshot.timestamp,
                  ...(snapshot.color ? { color: snapshot.color } : {}),
                  ...(snapshot.endTimestamp !== undefined
                    ? { endTimestamp: snapshot.endTimestamp }
                    : {}),
                });
              },
            },
          });
        }
      },

      PLAYBACK_STATUS: (data: PlaybackStatus) => {
        setPlaybackStatus(data);
      },

      CURRENT_FILE_PATH: (data: string) => {
        setCurrentFile(data);
      },

      COLLECTIONS_UPDATED: (data: BookmarkCollection[]) => {
        setCollections(data);
      },

      SMART_COLLECTIONS_UPDATED: (data: SmartCollection[]) => {
        setSmartCollections(data);
      },

      BOOKMARK_NEAR_DUPLICATE: (data: any) => {
        window.postMessage({ type: 'BOOKMARK_NEAR_DUPLICATE', data }, window.location.origin);
      },

      IMPORT_RESULT: (data: any) => {
        window.postMessage({ type: 'IMPORT_RESULT', data }, window.location.origin);
      },
      EXPORT_RESULT: (data: unknown) => {
        const result = normalizeExportResult(data);
        if (!result.success) {
          showErrorRef.current('Export Failed', result.error);
        }
        window.postMessage({ type: 'EXPORT_RESULT', data: result }, window.location.origin);
      },
      BOOKMARK_DEFAULTS: (data: any) => {
        window.postMessage({ type: 'BOOKMARK_DEFAULTS', data }, window.location.origin);
      },
      ERROR: (data: any) => {
        showErrorRef.current('Error', data?.message || 'An unexpected error occurred');
      },
      FILE_RECONCILIATION_RESULT: (data: any) => {
        window.postMessage({ type: 'FILE_RECONCILIATION_RESULT', data }, window.location.origin);
      },
    },
    'window',
  );

  useEscapeKey(!!pendingDeleteId, () => setPendingDeleteId(null));

  // Exit batch mode on escape
  useEscapeKey(batchMode && selectedIds.size > 0, () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isDialog = showAddDialog || showExportDialog || showImportDialog || showShortcuts;
      const metaOrCtrl = e.metaKey || e.ctrlKey;

      // Meta/Ctrl shortcuts work even in inputs
      if (metaOrCtrl && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          '#advanced-search-content input, .advanced-search input',
        );
        searchInput?.focus();
        return;
      }
      if (metaOrCtrl && e.key === 'n') {
        e.preventDefault();
        setShowAddDialog(true);
        return;
      }
      if (metaOrCtrl && e.key === 'a' && batchMode) {
        e.preventDefault();
        setSelectedIds(new Set(displayedBookmarks.map((b) => b.id)));
        return;
      }

      // Skip non-meta shortcuts when input is focused or dialog is open
      if (isInput || isDialog) return;

      // View mode switches (Shift+1..4)
      const viewModes: ViewMode[] = ['grouped', 'flat', 'gallery', 'timeline'];
      if (e.key === '!' || (e.shiftKey && e.key === '1')) {
        setViewMode(viewModes[0]);
        return;
      }
      if (e.key === '@' || (e.shiftKey && e.key === '2')) {
        setViewMode(viewModes[1]);
        return;
      }
      if (e.key === '#' || (e.shiftKey && e.key === '3')) {
        setViewMode(viewModes[2]);
        return;
      }
      if (e.key === '$' || (e.shiftKey && e.key === '4')) {
        setViewMode(viewModes[3]);
        return;
      }

      // Help
      if (e.key === '?') {
        setShowShortcuts(true);
        return;
      }

      // Number keys 1-9: jump to bookmark by index
      if (!e.shiftKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < displayedBookmarks.length) {
          const bm = displayedBookmarks[idx];
          setSelectedBookmark(bm);
          appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id: bm.id });
        }
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = selectedBookmark
          ? displayedBookmarks.findIndex((b) => b.id === selectedBookmark.id)
          : -1;
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(currentIdx + 1, displayedBookmarks.length - 1)
            : Math.max(currentIdx - 1, 0);
        if (nextIdx >= 0 && nextIdx < displayedBookmarks.length) {
          setSelectedBookmark(displayedBookmarks[nextIdx]);
        }
        return;
      }

      // Enter: jump to selected
      if (e.key === 'Enter' && selectedBookmark) {
        appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id: selectedBookmark.id });
        return;
      }

      // Space: toggle selection in batch mode
      if (e.key === ' ' && batchMode && selectedBookmark) {
        e.preventDefault();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(selectedBookmark.id)) {
            next.delete(selectedBookmark.id);
          } else {
            next.add(selectedBookmark.id);
          }
          return next;
        });
        return;
      }

      // P: toggle pin
      if (e.key === 'p' && selectedBookmark) {
        appWindow.iina?.postMessage?.('UPDATE_BOOKMARK', {
          id: selectedBookmark.id,
          data: { pinned: !selectedBookmark.pinned },
        });
        return;
      }

      // E: edit selected
      if (e.key === 'e' && selectedBookmark) {
        handleEditBookmark(selectedBookmark);
        return;
      }

      // T: tag dialog (simplified: prompt)
      if (e.key === 't' && selectedBookmark) {
        const tag = prompt('Enter tag to add:');
        if (tag) {
          appWindow.iina?.postMessage?.('UPDATE_BOOKMARK', {
            id: selectedBookmark.id,
            data: { tags: [...(selectedBookmark.tags || []), tag] },
          });
        }
        return;
      }

      // C: color picker (simplified: prompt)
      if (e.key === 'c' && selectedBookmark) {
        const color = prompt('Enter color (red, orange, yellow, green, blue, purple, pink, grey):');
        if (color) {
          appWindow.iina?.postMessage?.('UPDATE_BOOKMARK', {
            id: selectedBookmark.id,
            data: { color },
          });
        }
        return;
      }

      // L: loop range bookmark
      if (e.key === 'l' && selectedBookmark?.endTimestamp) {
        appWindow.iina?.postMessage?.('SET_AB_LOOP', { bookmarkId: selectedBookmark.id });
        return;
      }

      // Delete/Backspace: delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBookmark) {
        handleDeleteBookmark(selectedBookmark.id);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    selectedBookmark,
    displayedBookmarks,
    batchMode,
    showAddDialog,
    showExportDialog,
    showImportDialog,
    showShortcuts,
    appWindow,
  ]);

  const handleAddBookmark = () => {
    setShowAddDialog(true);
  };

  const handleSaveBookmark = (
    title: string,
    description: string,
    tags: string[],
    timestamp: number,
    color?: string,
    endTimestamp?: number,
  ) => {
    appWindow.iina?.postMessage?.('ADD_BOOKMARK', {
      title,
      description,
      tags,
      timestamp,
      ...(color ? { color } : {}),
      ...(endTimestamp !== undefined ? { endTimestamp } : {}),
    });
  };

  const handleDeleteBookmark = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deletedSnapshotRef.current = bookmarks.find((b) => b.id === pendingDeleteId) ?? null;
      appWindow.iina?.postMessage?.('DELETE_BOOKMARK', { id: pendingDeleteId });
      setPendingDeleteId(null);
    }
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
  };

  const handleBookmarkClick = (id: string) => {
    if (batchMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      const bm = displayedBookmarks.find((b) => b.id === id);
      if (bm) setSelectedBookmark(bm);
    }
  };

  const handleEditBookmark = (bookmark: BookmarkData) => {
    setSelectedBookmark(bookmark);
    setEditTitle(bookmark.title);
    setEditDescription(bookmark.description || '');
    setEditTags(bookmark.tags || []);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (selectedBookmark) {
      appWindow.iina?.postMessage?.('UPDATE_BOOKMARK', {
        id: selectedBookmark.id,
        data: { title: editTitle, description: editDescription, tags: editTags },
      });
      setIsEditing(false);
    }
  };

  const handleAdvancedSearchChange = useCallback(
    (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
      setParsedQuery(parsedQuery);
      setFilters((prev) => ({ ...prev, searchTerm }));
      if (searchTerm.trim()) {
        addRecentSearch(searchTerm);
      }
    },
    [addRecentSearch],
  );

  const handleApplyPreset = (presetFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...presetFilters }));
  };

  const handleSavePreset = (name: string, description: string) => {
    saveFilterPreset(name, description, filters);
  };

  const handleGenerateThumbnail = (id: string) => {
    appWindow.iina?.postMessage?.('REQUEST_THUMBNAIL', { bookmarkId: id });
  };

  const handleNavigateBookmark = (direction: 'prev' | 'next') => {
    if (!selectedBookmark) return;
    const msgType = direction === 'next' ? 'NEXT_BOOKMARK' : 'PREV_BOOKMARK';
    appWindow.iina?.postMessage?.(msgType, {
      currentId: selectedBookmark.id,
      scope: 'all',
    });
  };

  // Batch actions
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    appWindow.iina?.postMessage?.('BATCH_DELETE', { ids: Array.from(selectedIds) });
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const handleBatchTag = (tags: string[], action: 'add' | 'remove') => {
    if (selectedIds.size === 0) return;
    appWindow.iina?.postMessage?.('BATCH_TAG', {
      ids: Array.from(selectedIds),
      tags,
      action,
    });
  };

  const handleBatchColor = (color: BookmarkColor) => {
    if (selectedIds.size === 0) return;
    appWindow.iina?.postMessage?.('BATCH_COLOR', {
      ids: Array.from(selectedIds),
      color,
    });
  };

  const handleBatchPin = () => {
    if (selectedIds.size === 0) return;
    appWindow.iina?.postMessage?.('BATCH_PIN', {
      ids: Array.from(selectedIds),
      pinned: true,
    });
  };

  const postMessage = useCallback(
    (type: string, data?: any) => {
      appWindow.iina?.postMessage?.(type, data);
    },
    [appWindow],
  );

  // Find adjacent bookmarks for navigation
  const adjacentBookmarks = useMemo(() => {
    if (!selectedBookmark) return { prev: null, next: null };
    const idx = displayedBookmarks.findIndex((b) => b.id === selectedBookmark.id);
    return {
      prev: idx > 0 ? displayedBookmarks[idx - 1] : null,
      next: idx < displayedBookmarks.length - 1 ? displayedBookmarks[idx + 1] : null,
    };
  }, [selectedBookmark, displayedBookmarks]);

  return (
    <div className="bookmark-window">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="window-header">
        <h1>All Bookmarks</h1>
        <div className="header-actions">
          <button
            onClick={handleAddBookmark}
            className="add-bookmark-btn"
            aria-label="Add new bookmark at current time"
          >
            Add Bookmark to Current Video
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="import-btn"
            aria-label="Import bookmarks from file"
          >
            Import Bookmarks
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            className="export-btn"
            aria-label="Export bookmarks to file"
          >
            Export Bookmarks
          </button>
        </div>
      </div>

      <AddBookmarkDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleSaveBookmark}
        availableTags={availableTags}
        postMessage={postMessage}
      />

      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        postMessage={postMessage}
      />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        availableTags={availableTags}
        postMessage={postMessage}
      />

      <FilterPresets
        onApplyPreset={handleApplyPreset}
        onSaveCurrentAsPreset={handleSavePreset}
        currentFilters={filters}
        customPresets={customPresets}
        recentSearches={recentSearches}
        onClearHistory={clearRecentSearches}
      />

      {/* View mode segmented control + batch toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0 8px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 2,
            border: '1px solid var(--border-color)',
          }}
          role="tablist"
          aria-label="View mode"
        >
          {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: viewMode === mode ? 600 : 400,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: viewMode === mode ? 'var(--accent-color)' : 'transparent',
                color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
              }}
            >
              {VIEW_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowStats((s) => !s)}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: showStats ? 'var(--accent-light)' : 'transparent',
            color: showStats ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Stats
        </button>

        <button
          onClick={() => {
            setBatchMode((b) => !b);
            if (batchMode) setSelectedIds(new Set());
          }}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: batchMode ? 'var(--accent-light)' : 'transparent',
            color: batchMode ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          {batchMode ? 'Exit Select' : 'Select'}
        </button>
      </div>

      {/* File breadcrumb when filter is active */}
      {fileFilter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0 8px',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{ cursor: 'pointer', color: 'var(--accent-color)' }}
            onClick={() => setFileFilter(undefined)}
          >
            All Files
          </span>
          <span>&rsaquo;</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {fileFilter.split('/').pop()}
          </span>
          <button
            type="button"
            onClick={() => setFileFilter(undefined)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 4px',
            }}
            aria-label="Clear file filter"
          >
            &#10005;
          </button>
        </div>
      )}

      <div className="filter-row">
        <button
          className="advanced-search-toggle"
          onClick={() => setUseAdvancedSearch(!useAdvancedSearch)}
          aria-expanded={useAdvancedSearch}
          aria-controls="advanced-search-content"
          aria-label={`${useAdvancedSearch ? 'Hide' : 'Show'} advanced search`}
        >
          <span className={`toggle-icon ${useAdvancedSearch ? 'expanded' : ''}`} aria-hidden="true">
            &#9654;
          </span>
          <span>Advanced Search</span>
        </button>
        {analytics.hasActiveFilters && (
          <div className="filter-analytics" aria-label="Filter statistics">
            <div className="analytics-item">
              <span className="analytics-icon" aria-hidden="true">
                &#128202;
              </span>
              <span className="analytics-value">{analytics.filteredCount}</span>
              <span>of {analytics.totalBookmarks}</span>
            </div>
            {analytics.reductionPercentage > 0 && (
              <div
                className={`analytics-item reduction-percentage ${analytics.reductionPercentage > 75 ? 'high-reduction' : ''}`}
              >
                <span className="analytics-icon" aria-hidden="true">
                  &#128201;
                </span>
                <span className="analytics-value">{analytics.reductionPercentage}%</span>
                <span>filtered out</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div id="advanced-search-content">
        {useAdvancedSearch ? (
          <AdvancedSearch
            onSearchChange={handleAdvancedSearchChange}
            availableTags={availableTags}
            availableFiles={availableFiles}
            recentSearches={recentSearches}
          />
        ) : (
          <FilterComponent
            onFilterChange={setFilters}
            availableTags={availableTags}
            availableFiles={availableFiles}
            resultsCount={resultsCount}
            showAdvanced={true}
            initialFilters={filters}
          />
        )}
      </div>

      {/* Stats dashboard */}
      <StatsDashboard
        bookmarks={displayedBookmarks}
        isExpanded={showStats}
        onToggle={() => setShowStats((s) => !s)}
      />

      {/* File summary cards - show when 2+ files have bookmarks */}
      {bookmarksByFile.size >= 2 && !fileFilter && (
        <FileSummaryCards
          bookmarksByFile={bookmarksByFile}
          currentFile={currentFile}
          onFileClick={(fp) => setFileFilter(fp)}
          selectedFile={fileFilter}
        />
      )}

      <div className="content-area">
        <div className="bookmark-list-panel" role="list" aria-label="Bookmark list">
          {displayedBookmarks.length === 0 ? (
            bookmarks.length === 0 ? (
              <div
                style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}
              >
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: 'var(--text-primary)',
                  }}
                >
                  No bookmarks yet
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Open a video and press{' '}
                  <kbd
                    style={{
                      fontFamily: "'SF Mono', Monaco, monospace",
                      fontSize: 11,
                      padding: '1px 5px',
                      borderRadius: 3,
                      border: '1px solid var(--border-color)',
                      background: 'var(--surface-secondary)',
                    }}
                  >
                    Ctrl+B
                  </kbd>{' '}
                  to mark your first moment, or click &ldquo;Add Bookmark&rdquo; above.
                </p>
                <div style={{ fontSize: 12, textAlign: 'left', maxWidth: 300, margin: '0 auto' }}>
                  <p style={{ marginBottom: 4 }}>
                    <strong>Quick tips:</strong>
                  </p>
                  <p style={{ marginBottom: 2 }}>
                    <kbd
                      style={{
                        fontFamily: "'SF Mono', Monaco, monospace",
                        fontSize: 10,
                        padding: '0 3px',
                        borderRadius: 2,
                        border: '1px solid var(--border-color)',
                        background: 'var(--surface-secondary)',
                      }}
                    >
                      Ctrl+B
                    </kbd>{' '}
                    &mdash; quick bookmark (no dialog)
                  </p>
                  <p style={{ marginBottom: 2 }}>
                    <kbd
                      style={{
                        fontFamily: "'SF Mono', Monaco, monospace",
                        fontSize: 10,
                        padding: '0 3px',
                        borderRadius: 2,
                        border: '1px solid var(--border-color)',
                        background: 'var(--surface-secondary)',
                      }}
                    >
                      I
                    </kbd>{' '}
                    then{' '}
                    <kbd
                      style={{
                        fontFamily: "'SF Mono', Monaco, monospace",
                        fontSize: 10,
                        padding: '0 3px',
                        borderRadius: 2,
                        border: '1px solid var(--border-color)',
                        background: 'var(--surface-secondary)',
                      }}
                    >
                      O
                    </kbd>{' '}
                    then{' '}
                    <kbd
                      style={{
                        fontFamily: "'SF Mono', Monaco, monospace",
                        fontSize: 10,
                        padding: '0 3px',
                        borderRadius: 2,
                        border: '1px solid var(--border-color)',
                        background: 'var(--surface-secondary)',
                      }}
                    >
                      B
                    </kbd>{' '}
                    &mdash; mark a scene range
                  </p>
                  <p>
                    <kbd
                      style={{
                        fontFamily: "'SF Mono', Monaco, monospace",
                        fontSize: 10,
                        padding: '0 3px',
                        borderRadius: 2,
                        border: '1px solid var(--border-color)',
                        background: 'var(--surface-secondary)',
                      }}
                    >
                      ?
                    </kbd>{' '}
                    &mdash; see all keyboard shortcuts
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}
              >
                <p style={{ fontSize: 14, marginBottom: 8 }}>
                  No bookmarks match your current filters.
                </p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTER_STATE)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--accent-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 12px',
                    fontSize: 12,
                    color: 'var(--accent-color)',
                    cursor: 'pointer',
                  }}
                >
                  Clear all filters
                </button>
              </div>
            )
          ) : viewMode === 'grouped' ? (
            <FileGroupedBookmarkList
              bookmarksByFile={bookmarksByFile}
              currentFile={currentFile}
              onBookmarkClick={handleBookmarkClick}
              onDeleteBookmark={handleDeleteBookmark}
              selectedBookmarkId={batchMode ? undefined : selectedBookmark?.id}
              searchTerm={filters.searchTerm}
            />
          ) : viewMode === 'gallery' ? (
            <BookmarkGallery
              bookmarks={displayedBookmarks}
              onBookmarkClick={handleBookmarkClick}
              onGenerateThumbnail={handleGenerateThumbnail}
              selectedBookmarkId={batchMode ? undefined : selectedBookmark?.id}
              searchTerm={filters.searchTerm}
            />
          ) : viewMode === 'timeline' ? (
            <BookmarkTimeline
              bookmarks={displayedBookmarks}
              duration={playbackStatus?.duration ?? 0}
              currentPosition={playbackStatus?.position}
              chapters={playbackStatus?.chapters}
              onBookmarkClick={handleBookmarkClick}
              onSeek={(ts) => appWindow.iina?.postMessage?.('SEEK_TO_TIMESTAMP', { timestamp: ts })}
              selectedBookmarkId={batchMode ? undefined : selectedBookmark?.id}
            />
          ) : (
            /* flat view - original list */
            displayedBookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className={`bookmark-item ${selectedBookmark?.id === bookmark.id ? 'selected' : ''} ${batchMode && selectedIds.has(bookmark.id) ? 'selected' : ''}`}
                onClick={() => handleBookmarkClick(bookmark.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBookmarkClick(bookmark.id);
                  }
                }}
                role="listitem"
                tabIndex={0}
                aria-current={selectedBookmark?.id === bookmark.id ? 'true' : undefined}
                aria-label={`Bookmark: ${bookmark.title}`}
              >
                {batchMode && (
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: selectedIds.has(bookmark.id)
                        ? '2px solid var(--accent-color)'
                        : '2px solid var(--border-color)',
                      background: selectedIds.has(bookmark.id)
                        ? 'var(--accent-color)'
                        : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginRight: 8,
                      color: '#fff',
                      fontSize: 12,
                    }}
                  >
                    {selectedIds.has(bookmark.id) ? '\u2713' : ''}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>
                    <TextHighlighter
                      text={bookmark.title}
                      searchTerms={filters.searchTerm}
                      caseSensitive={false}
                    />
                  </h4>
                  <p className="filepath" title={bookmark.filepath}>
                    {bookmark.filepath.split('/').pop()} ({formatTime(bookmark.timestamp)})
                  </p>
                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div className="bookmark-tags-small">
                      {bookmark.tags.map((tag) => (
                        <span key={tag} className="bookmark-tag-small">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="created-date-small">Added: {formatDate(bookmark.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Enhanced detail panel */}
        {selectedBookmark && !batchMode && (
          <div className="bookmark-detail-panel">
            {isEditing ? (
              <div className="edit-form">
                <h3>Edit Bookmark</h3>
                <label htmlFor="edit-title" className="sr-only">
                  Title
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Title"
                  maxLength={255}
                />
                <label htmlFor="edit-description" className="sr-only">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                  aria-label="Description"
                  maxLength={2000}
                ></textarea>
                <TagInput
                  tags={editTags}
                  onTagsChange={setEditTags}
                  availableTags={availableTags}
                />
                <div className="edit-actions">
                  <button onClick={handleSaveEdit} className="save-btn">
                    Save Changes
                  </button>
                  <button onClick={() => setIsEditing(false)} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="details-view">
                {/* Navigation arrows */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (adjacentBookmarks.prev) {
                        setSelectedBookmark(adjacentBookmarks.prev);
                      }
                      handleNavigateBookmark('prev');
                    }}
                    disabled={!adjacentBookmarks.prev}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 8px',
                      fontSize: 12,
                      color: adjacentBookmarks.prev ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: adjacentBookmarks.prev ? 'pointer' : 'default',
                      opacity: adjacentBookmarks.prev ? 1 : 0.5,
                    }}
                    aria-label="Previous bookmark"
                  >
                    &#8592; Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (adjacentBookmarks.next) {
                        setSelectedBookmark(adjacentBookmarks.next);
                      }
                      handleNavigateBookmark('next');
                    }}
                    disabled={!adjacentBookmarks.next}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 8px',
                      fontSize: 12,
                      color: adjacentBookmarks.next ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: adjacentBookmarks.next ? 'pointer' : 'default',
                      opacity: adjacentBookmarks.next ? 1 : 0.5,
                    }}
                    aria-label="Next bookmark"
                  >
                    Next &#8594;
                  </button>
                </div>

                {/* Thumbnail */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <BookmarkThumbnail
                    bookmark={selectedBookmark}
                    size="large"
                    onGenerateThumbnail={handleGenerateThumbnail}
                  />
                </div>

                <h3>
                  <TextHighlighter
                    text={selectedBookmark.title}
                    searchTerms={filters.searchTerm}
                    caseSensitive={false}
                  />
                </h3>
                <p>
                  <strong>File:</strong>{' '}
                  <span title={selectedBookmark.filepath}>{selectedBookmark.filepath}</span>
                </p>
                <p>
                  <strong>Time:</strong> {formatTime(selectedBookmark.timestamp)}
                </p>

                {/* Range indicator */}
                {selectedBookmark.endTimestamp !== undefined &&
                  selectedBookmark.endTimestamp > selectedBookmark.timestamp && (
                    <p>
                      <strong>Range:</strong>{' '}
                      <span
                        style={{
                          background: 'var(--timestamp-bg)',
                          color: 'var(--timestamp-color)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {formatTime(selectedBookmark.timestamp)} &rarr;{' '}
                        {formatTime(selectedBookmark.endTimestamp)} (
                        {Math.round(selectedBookmark.endTimestamp - selectedBookmark.timestamp)}s)
                      </span>
                    </p>
                  )}

                {/* Color display */}
                {selectedBookmark.color && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong>Color:</strong>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: getColorHex(selectedBookmark.color),
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {selectedBookmark.color}
                    </span>
                  </p>
                )}

                {/* Chapter context */}
                {selectedBookmark.chapterTitle && (
                  <p>
                    <strong>Chapter:</strong> {selectedBookmark.chapterTitle}
                  </p>
                )}

                {/* Subtitle context */}
                {selectedBookmark.subtitleText && (
                  <p>
                    <strong>Subtitle:</strong>{' '}
                    <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      {selectedBookmark.subtitleText}
                    </span>
                  </p>
                )}

                {selectedBookmark.description && (
                  <p>
                    <strong>Description:</strong>
                    <TextHighlighter
                      text={selectedBookmark.description}
                      searchTerms={filters.searchTerm}
                      caseSensitive={false}
                    />
                  </p>
                )}
                {selectedBookmark.tags && selectedBookmark.tags.length > 0 && (
                  <p>
                    <strong>Tags:</strong> {selectedBookmark.tags.join(', ')}
                  </p>
                )}
                <p>
                  <strong>Created:</strong> {formatDate(selectedBookmark.createdAt)}{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    ({formatRelativeTime(selectedBookmark.createdAt)})
                  </span>
                </p>
                <div className="detail-actions">
                  <button
                    onClick={() => handleJumpToBookmark(selectedBookmark.id)}
                    className="jump-btn"
                    aria-label={`Jump to bookmark: ${selectedBookmark.title}`}
                  >
                    Jump To
                  </button>
                  <button
                    onClick={() => handleEditBookmark(selectedBookmark)}
                    className="edit-btn"
                    aria-label={`Edit bookmark: ${selectedBookmark.title}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(selectedBookmark.id)}
                    className="delete-btn-detail"
                    aria-label={`Delete bookmark: ${selectedBookmark.title}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!selectedBookmark && !batchMode && displayedBookmarks.length > 0 && (
          <div className="bookmark-detail-panel placeholder-panel">
            <p>Select a bookmark from the list to view or edit its details.</p>
          </div>
        )}
      </div>

      {/* Floating action bar for batch mode */}
      {batchMode && selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
          <BatchButton
            label="Tag"
            onClick={() => {
              const tag = prompt('Enter tag to add:');
              if (tag) handleBatchTag([tag], 'add');
            }}
          />
          <BatchButton
            label="Color"
            onClick={() => {
              const color = prompt(
                'Enter color (red, orange, yellow, green, blue, purple, pink, grey):',
              );
              if (color) handleBatchColor(color as BookmarkColor);
            }}
          />
          <BatchButton label="Pin" onClick={handleBatchPin} />
          <BatchButton label="Delete" onClick={handleBatchDelete} danger />
          <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
          <BatchButton
            label="Cancel"
            onClick={() => {
              setBatchMode(false);
              setSelectedIds(new Set());
            }}
          />
        </div>
      )}

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Footer shortcut hint */}
      <div
        style={{
          textAlign: 'center',
          padding: '8px 0 4px',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        Press{' '}
        <kbd
          style={{
            fontFamily: "'SF Mono', Monaco, monospace",
            fontSize: 10,
            padding: '1px 4px',
            borderRadius: 3,
            border: '1px solid var(--border-color)',
            background: 'var(--surface-secondary)',
          }}
        >
          ?
        </kbd>{' '}
        for keyboard shortcuts
      </div>

      {pendingDeleteId && (
        <div
          className="confirm-dialog-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="confirm-dialog">
            <p>
              Delete &ldquo;
              {bookmarks.find((b) => b.id === pendingDeleteId)?.title ?? 'this bookmark'}
              &rdquo;?
            </p>
            <div className="confirm-dialog-actions">
              <button className="confirm-btn" onClick={confirmDelete}>
                Confirm
              </button>
              <button className="cancel-btn" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BatchButton: React.FC<{
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ label, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 500,
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      background: danger ? 'var(--danger-light)' : 'var(--surface-secondary)',
      color: danger ? 'var(--danger-color)' : 'var(--text-primary)',
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);

export default App;
