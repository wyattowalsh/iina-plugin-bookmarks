import React, { useState, useEffect, useRef } from 'react';
import FilterComponent, { FilterState } from '../components/FilterComponent';
import AdvancedSearch, { ParsedSearchQuery } from '../components/AdvancedSearch';
import FilterPresets from '../components/FilterPresets';
import TextHighlighter from '../components/TextHighlighter';
import TagInput from '../components/TagInput';
import AddBookmarkDialog from '../components/AddBookmarkDialog';
import ExportDialog from '../components/ExportDialog';
import ImportDialog from '../components/ImportDialog';
import useAdvancedBookmarkFilters from '../hooks/useAdvancedBookmarkFilters';
import useFilterHistory from '../hooks/useFilterHistory';
import { BookmarkData, AppWindow } from '../types';

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const appWindow = window as unknown as AppWindow;

  const { filteredBookmarks, resultsCount, availableFiles, availableTags, analytics } =
    useAdvancedBookmarkFilters({
      bookmarks,
      filters,
      parsedQuery: useAdvancedSearch ? parsedQuery : undefined,
    });

  const {
    recentSearches,
    customPresets,
    addRecentSearch,
    clearRecentSearches,
    saveFilterPreset,
    deleteFilterPreset,
    incrementPresetUsage,
  } = useFilterHistory();

  // Use refs for mutable state accessed inside the message handler
  const selectedBookmarkRef = useRef(selectedBookmark);
  selectedBookmarkRef.current = selectedBookmark;
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
        const current = selectedBookmarkRef.current;
        if (current && !messageData.data.find((b: BookmarkData) => b.id === current.id)) {
          setSelectedBookmark(null);
          setIsEditing(false);
        }
      } else if (messageData?.type === 'CURRENT_FILE_PATH' && messageData.data) {
        setCurrentFile(messageData.data);
      }
    };

    if (appWindow.iina?.onMessage) {
      appWindow.iina.onMessage('message', handleMessage);
    } else {
      window.addEventListener('message', handleMessage);
    }

    if (appWindow.iina?.postMessage) {
      appWindow.iina.postMessage('UI_READY', { uiType: 'window' });
      appWindow.iina.postMessage('REQUEST_FILE_PATH');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAddBookmark = () => {
    setShowAddDialog(true);
  };

  const handleSaveBookmark = (
    title: string,
    description: string,
    tags: string[],
    timestamp: number,
  ) => {
    appWindow.iina?.postMessage?.('ADD_BOOKMARK', {
      title,
      description,
      tags,
      timestamp,
    });
  };

  const handleDeleteBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('DELETE_BOOKMARK', { id });
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
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
      setSelectedBookmark((prev) =>
        prev ? { ...prev, title: editTitle, description: editDescription, tags: editTags } : null,
      );
      setBookmarks((prevBks) =>
        prevBks.map((b) =>
          b.id === selectedBookmark.id
            ? { ...b, title: editTitle, description: editDescription, tags: editTags }
            : b,
        ),
      );
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substring(11, 19);

  const handleAdvancedSearchChange = (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
    setParsedQuery(parsedQuery);
    setFilters((prev) => ({ ...prev, searchTerm }));
    if (searchTerm.trim()) {
      addRecentSearch(searchTerm);
    }
  };

  const handleApplyPreset = (presetFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...presetFilters }));
  };

  const handleSavePreset = (name: string, description: string) => {
    saveFilterPreset(name, description, filters);
  };

  const postMessage = (type: string, data?: any) => {
    appWindow.iina?.postMessage?.(type, data);
  };

  return (
    <div className="bookmark-window">
      <div className="window-header">
        <h1>Manage All Bookmarks</h1>
        <div className="header-actions">
          <button onClick={handleAddBookmark} className="add-bookmark-btn">
            Add Bookmark to Current Video
          </button>
          <button onClick={() => setShowImportDialog(true)} className="import-btn">
            Import Bookmarks
          </button>
          <button onClick={() => setShowExportDialog(true)} className="export-btn">
            Export Bookmarks
          </button>
        </div>
      </div>

      <AddBookmarkDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleSaveBookmark}
        availableTags={availableTags}
        postMessage={appWindow.iina?.postMessage}
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

      <div className="content-area">
        <div className="bookmark-list-panel" role="list" aria-label="Bookmark list">
          {filteredBookmarks.length === 0 ? (
            <p className="empty-state-text">No bookmarks match your current filters.</p>
          ) : (
            filteredBookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className={`bookmark-entry ${selectedBookmark?.id === bookmark.id ? 'selected' : ''}`}
                onClick={() => setSelectedBookmark(bookmark)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedBookmark(bookmark);
                  }
                }}
                role="listitem"
                tabIndex={0}
                aria-selected={selectedBookmark?.id === bookmark.id}
                aria-label={`Bookmark: ${bookmark.title}`}
              >
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
                <p className="created-date-small">
                  Added: {new Date(bookmark.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>

        {selectedBookmark && (
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
                <p>
                  <strong>Description:</strong>
                  <TextHighlighter
                    text={selectedBookmark.description || 'N/A'}
                    searchTerms={filters.searchTerm}
                    caseSensitive={false}
                  />
                </p>
                {selectedBookmark.tags && selectedBookmark.tags.length > 0 && (
                  <p>
                    <strong>Tags:</strong> {selectedBookmark.tags.join(', ')}
                  </p>
                )}
                <p>
                  <strong>Created:</strong> {formatDate(selectedBookmark.createdAt)}
                </p>
                <div className="detail-actions">
                  <button
                    onClick={() => handleJumpToBookmark(selectedBookmark.id)}
                    className="jump-btn"
                  >
                    Jump To
                  </button>
                  <button onClick={() => handleEditBookmark(selectedBookmark)} className="edit-btn">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(selectedBookmark.id)}
                    className="delete-btn-detail"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!selectedBookmark && filteredBookmarks.length > 0 && (
          <div className="bookmark-detail-panel placeholder-panel">
            <p>Select a bookmark from the list to view or edit its details.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
