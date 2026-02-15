import React, { useState, useRef, useCallback } from 'react';
import FilterComponent, { FilterState, DEFAULT_FILTER_STATE } from '../components/FilterComponent';
import AdvancedSearch, { ParsedSearchQuery } from '../components/AdvancedSearch';
import TextHighlighter from '../components/TextHighlighter';
import ExportDialog from '../components/ExportDialog';
import ImportDialog from '../components/ImportDialog';
import CloudSyncDialog from '../components/CloudSyncDialog';
import FileReconciliationDialog from '../components/FileReconciliationDialog';
import { ToastContainer } from '../components/Toast';
import Loading from '../components/Loading';
import useAdvancedBookmarkFilters from '../hooks/useAdvancedBookmarkFilters';
import useFilterHistory from '../hooks/useFilterHistory';
import useToast from '../hooks/useToast';
import { useIinaMessages } from '../hooks/useIinaMessages';
import { BookmarkData, AppWindow } from '../types';
import { formatTime, formatDate } from '../utils/formatTime';

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | undefined>();
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCloudSyncDialog, setShowCloudSyncDialog] = useState(false);
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [movedFiles, setMovedFiles] = useState<BookmarkData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const appWindow = window as unknown as AppWindow;
  const { toasts, showSuccess, showError, showInfo, dismissToast } = useToast();

  const { filteredBookmarks, resultsCount, availableTags } = useAdvancedBookmarkFilters({
    bookmarks,
    filters,
    parsedQuery: useAdvancedSearch ? parsedQuery : undefined,
  });

  const { recentSearches, addRecentSearch } = useFilterHistory();

  // Stable refs for values used inside the message handler
  const showSuccessRef = useRef(showSuccess);
  showSuccessRef.current = showSuccess;
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const showInfoRef = useRef(showInfo);
  showInfoRef.current = showInfo;

  useIinaMessages(
    {
      BOOKMARKS_UPDATED: (data: BookmarkData[]) => {
        setBookmarks(data);
      },
      CURRENT_FILE_PATH: (data: string) => {
        setCurrentFile(data);
      },
      BOOKMARK_ADDED: () => {
        showSuccessRef.current('Bookmark Added', 'New bookmark created successfully');
      },
      BOOKMARK_DELETED: () => {
        showSuccessRef.current('Bookmark Deleted', 'Bookmark removed successfully');
      },
      BOOKMARK_JUMPED: () => {
        showInfoRef.current('Jumped to Bookmark', 'Playback position updated');
      },
      EXPORT_RESULT: (data: any) => {
        setIsLoading(false);
        showSuccessRef.current(
          'Export Complete',
          `Bookmarks exported as ${data?.format || 'file'}`,
        );
        window.postMessage({ type: 'EXPORT_RESULT', data }, window.location.origin);
      },
      IMPORT_RESULT: (data: any) => {
        setIsLoading(false);
        if (data?.success) {
          showSuccessRef.current(
            'Import Complete',
            `Successfully imported ${data.importedCount} bookmarks`,
          );
          if (data.skippedCount > 0) {
            showInfoRef.current(
              'Import Info',
              `${data.skippedCount} bookmarks were skipped as duplicates`,
            );
          }
        } else {
          showErrorRef.current('Import Failed', data?.errors?.[0] || 'Failed to import bookmarks');
        }
        window.postMessage({ type: 'IMPORT_RESULT', data }, window.location.origin);
      },
      IMPORT_STARTED: () => {
        setIsLoading(true);
        setLoadingMessage('Importing bookmarks...');
      },
      SHOW_CLOUD_SYNC_DIALOG: () => {
        setShowCloudSyncDialog(true);
      },
      SHOW_FILE_RECONCILIATION_DIALOG: (data: any) => {
        if (data?.movedFiles) {
          setMovedFiles(data.movedFiles);
          setShowReconciliationDialog(true);
        }
      },
      ERROR: (data: any) => {
        showErrorRef.current('Error', data?.message || 'An unexpected error occurred');
      },
      CLOUD_SYNC_RESULT: (data: any) => {
        window.postMessage({ type: 'CLOUD_SYNC_RESULT', data }, window.location.origin);
      },
      FILE_RECONCILIATION_RESULT: (data: any) => {
        window.postMessage({ type: 'FILE_RECONCILIATION_RESULT', data }, window.location.origin);
      },
    },
    'sidebar',
  );

  const handleAddBookmark = () => {
    appWindow.iina?.postMessage?.('ADD_BOOKMARK', {});
  };

  const postMessage = (type: string, data?: any) => {
    appWindow.iina?.postMessage?.(type, data);
  };

  const handleDeleteBookmark = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      appWindow.iina?.postMessage?.('DELETE_BOOKMARK', { id: pendingDeleteId });
      setPendingDeleteId(null);
    }
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
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

  return (
    <div className="bookmark-sidebar">
      {isLoading && <Loading message={loadingMessage} overlay={true} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="sidebar-header">
        <h2 id="bookmarks-heading">Bookmarks (Current File)</h2>
        <div className="sidebar-actions" role="group" aria-labelledby="bookmarks-heading">
          <button
            onClick={handleAddBookmark}
            className="add-bookmark-btn"
            aria-label="Add new bookmark at current time"
            title="Add new bookmark at current time"
          >
            Add Bookmark
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="import-btn"
            aria-label="Import bookmarks from file"
            title="Import bookmarks from file"
          >
            Import
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            className="export-btn"
            aria-label="Export bookmarks to file"
            title="Export bookmarks to file"
          >
            Export
          </button>
          <button
            onClick={() => setShowCloudSyncDialog(true)}
            className="cloud-sync-btn"
            aria-label="Sync bookmarks with cloud storage"
            title="Sync bookmarks with cloud storage"
          >
            Cloud
          </button>
          <button
            onClick={() => {
              appWindow.iina?.postMessage?.('RECONCILE_FILES');
            }}
            className="reconcile-btn"
            aria-label="Check for moved files"
            title="Check for moved files and reconcile bookmarks"
          >
            Check Files
          </button>
        </div>
      </div>

      <div className="filter-row">
        <button
          className="advanced-search-toggle"
          onClick={() => setUseAdvancedSearch(!useAdvancedSearch)}
          aria-expanded={useAdvancedSearch}
          aria-controls="search-content"
          aria-label={`${useAdvancedSearch ? 'Hide' : 'Show'} advanced search options`}
        >
          <span className={`toggle-icon ${useAdvancedSearch ? 'expanded' : ''}`} aria-hidden="true">
            &#9654;
          </span>
          <span>Advanced</span>
        </button>
      </div>

      <div id="search-content" role="region" aria-label="Search and filter controls">
        {useAdvancedSearch ? (
          <AdvancedSearch
            onSearchChange={handleAdvancedSearchChange}
            availableTags={availableTags}
            recentSearches={recentSearches}
            placeholder="Search... (try: tag:work)"
            className="compact"
          />
        ) : (
          <FilterComponent
            onFilterChange={setFilters}
            availableTags={availableTags}
            resultsCount={resultsCount}
            compact={true}
            initialFilters={filters}
          />
        )}
      </div>

      <ul className="bookmark-list" role="list" aria-label="Bookmarks for current file">
        {filteredBookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="bookmark-item"
            role="listitem"
            tabIndex={0}
            onClick={() => handleJumpToBookmark(bookmark.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleJumpToBookmark(bookmark.id);
              }
            }}
            aria-label={`Jump to bookmark: ${bookmark.title} at ${formatTime(bookmark.timestamp)}`}
          >
            <div className="bookmark-header">
              <div
                className="bookmark-time"
                aria-label={`Timestamp: ${formatTime(bookmark.timestamp)}`}
              >
                {formatTime(bookmark.timestamp)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteBookmark(bookmark.id);
                  }
                }}
                className="delete-btn"
                aria-label={`Delete bookmark: ${bookmark.title}`}
                title={`Delete bookmark: ${bookmark.title}`}
              >
                &times;
              </button>
            </div>
            <h4 className="bookmark-title">
              <TextHighlighter
                text={bookmark.title}
                searchTerms={filters.searchTerm}
                caseSensitive={false}
              />
            </h4>
            <p className="bookmark-description">
              <TextHighlighter
                text={bookmark.description || ''}
                searchTerms={filters.searchTerm}
                caseSensitive={false}
              />
            </p>
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="bookmark-tags" role="group" aria-label="Tags">
                {bookmark.tags.map((tag) => (
                  <span key={tag} className="bookmark-tag" aria-label={`Tag: ${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="bookmark-meta">
              <span
                className="created-date"
                aria-label={`Created: ${formatDate(bookmark.createdAt)}`}
              >
                {formatDate(bookmark.createdAt)}
              </span>
            </div>
          </li>
        ))}
        {filteredBookmarks.length === 0 && (
          <p className="empty-state">No bookmarks match your current filters.</p>
        )}
      </ul>

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

      <CloudSyncDialog
        isOpen={showCloudSyncDialog}
        onClose={() => setShowCloudSyncDialog(false)}
        postMessage={postMessage}
        bookmarkCount={bookmarks.length}
        onBookmarksReceived={setBookmarks}
      />

      <FileReconciliationDialog
        isOpen={showReconciliationDialog}
        onClose={() => setShowReconciliationDialog(false)}
        postMessage={postMessage}
        movedFiles={movedFiles}
      />

      {pendingDeleteId && (
        <div
          className="confirm-dialog-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="confirm-dialog">
            <p>Delete this bookmark?</p>
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

export default App;
