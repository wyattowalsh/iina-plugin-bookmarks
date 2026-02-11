import React, { useState, useEffect, useRef } from 'react';
import FilterComponent, { FilterState } from '../components/FilterComponent';
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
import { BookmarkData, AppWindow } from '../types';

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateRange: { start: '', end: '' },
    tags: [],
    sortBy: 'createdAt',
    sortDirection: 'desc',
    fileFilter: '',
    sortCriteria: [{ field: 'createdAt', direction: 'desc', priority: 1 }],
    enableMultiSort: false,
  });
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | undefined>();
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCloudSyncDialog, setShowCloudSyncDialog] = useState(false);
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [movedFiles, setMovedFiles] = useState<BookmarkData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const appWindow = window as unknown as AppWindow;
  const { toasts, showSuccess, showError, showWarning, showInfo, dismissToast } = useToast();

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
  const handlerRegistered = useRef(false);

  useEffect(() => {
    if (handlerRegistered.current) return;
    handlerRegistered.current = true;

    const handleMessage = (event: any) => {
      let messageData = event.data;
      if (typeof event.data === 'string') {
        try {
          messageData = JSON.parse(event.data);
        } catch (e) {
          return;
        }
      }

      if (messageData?.type === 'BOOKMARKS_UPDATED' && messageData.data) {
        setBookmarks(messageData.data);
      } else if (messageData?.type === 'CURRENT_FILE_PATH' && messageData.data) {
        setCurrentFile(messageData.data);
      } else if (messageData?.type === 'BOOKMARK_ADDED') {
        showSuccessRef.current('Bookmark Added', 'New bookmark created successfully');
      } else if (messageData?.type === 'BOOKMARK_DELETED') {
        showSuccessRef.current('Bookmark Deleted', 'Bookmark removed successfully');
      } else if (messageData?.type === 'BOOKMARK_JUMPED') {
        showInfoRef.current('Jumped to Bookmark', 'Playback position updated');
      } else if (messageData?.type === 'EXPORT_SUCCESS') {
        setIsLoading(false);
        showSuccessRef.current(
          'Export Complete',
          `Bookmarks exported to ${messageData.data?.filename || 'file'}`,
        );
      } else if (messageData?.type === 'EXPORT_ERROR') {
        setIsLoading(false);
        showErrorRef.current(
          'Export Failed',
          messageData.data?.error || 'Failed to export bookmarks',
        );
      } else if (messageData?.type === 'EXPORT_STARTED') {
        setIsLoading(true);
        setLoadingMessage('Exporting bookmarks...');
      } else if (messageData?.type === 'IMPORT_RESULT') {
        setIsLoading(false);
        if (messageData.data?.success) {
          showSuccessRef.current(
            'Import Complete',
            `Successfully imported ${messageData.data.importedCount} bookmarks`,
          );
          if (messageData.data.skippedCount > 0) {
            showInfoRef.current(
              'Import Info',
              `${messageData.data.skippedCount} bookmarks were skipped as duplicates`,
            );
          }
        } else {
          showErrorRef.current(
            'Import Failed',
            messageData.data?.errors?.[0] || 'Failed to import bookmarks',
          );
        }
      } else if (messageData?.type === 'IMPORT_STARTED') {
        setIsLoading(true);
        setLoadingMessage('Importing bookmarks...');
      } else if (messageData?.type === 'SHOW_CLOUD_SYNC_DIALOG') {
        setShowCloudSyncDialog(true);
      } else if (
        messageData?.type === 'SHOW_FILE_RECONCILIATION_DIALOG' &&
        messageData.data?.movedFiles
      ) {
        setMovedFiles(messageData.data.movedFiles);
        setShowReconciliationDialog(true);
      } else if (messageData?.type === 'ERROR') {
        showErrorRef.current('Error', messageData.data?.message || 'An unexpected error occurred');
      }
    };

    if (appWindow.iina?.onMessage) {
      appWindow.iina.onMessage('message', handleMessage);
    } else {
      window.addEventListener('message', handleMessage);
    }

    if (appWindow.iina?.postMessage) {
      appWindow.iina.postMessage('UI_READY', { uiType: 'sidebar' });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (!currentFile && appWindow.iina?.postMessage) {
      appWindow.iina.postMessage('REQUEST_FILE_PATH');
    }
  }, [currentFile]);

  const handleAddBookmark = () => {
    appWindow.iina?.postMessage?.('ADD_BOOKMARK', {
      title: `New Sidebar Bookmark ${new Date().toLocaleTimeString()}`,
      timestamp: null,
      description: 'Added from sidebar',
    });
  };

  const postMessage = (type: string, data?: any) => {
    appWindow.iina?.postMessage?.(type, data);
  };

  const handleDeleteBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('DELETE_BOOKMARK', { id });
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const formatTime = (seconds: number) =>
    new Date((seconds || 0) * 1000).toISOString().substring(11, 19);

  const handleAdvancedSearchChange = (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
    setParsedQuery(parsedQuery);
    setFilters((prev) => ({ ...prev, searchTerm }));
    if (searchTerm.trim()) {
      addRecentSearch(searchTerm);
    }
  };

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
                  <span key={tag} className="bookmark-tag" role="tag" aria-label={`Tag: ${tag}`}>
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
      />

      <FileReconciliationDialog
        isOpen={showReconciliationDialog}
        onClose={() => setShowReconciliationDialog(false)}
        postMessage={postMessage}
        movedFiles={movedFiles}
      />
    </div>
  );
};

export default App;
