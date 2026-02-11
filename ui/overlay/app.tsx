import React, { useState, useEffect, useRef } from 'react';
import AdvancedSearch, { ParsedSearchQuery } from '../components/AdvancedSearch';
import TextHighlighter from '../components/TextHighlighter';
import useAdvancedBookmarkFilters from '../hooks/useAdvancedBookmarkFilters';
import { FilterState } from '../components/FilterComponent';
import { BookmarkData, AppWindow } from '../types';

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
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
  const appWindow = window as unknown as AppWindow;

  // Enhanced filtering
  const { filteredBookmarks: allFilteredBookmarks, availableTags } = useAdvancedBookmarkFilters({
    bookmarks,
    filters,
    parsedQuery: useAdvancedSearch ? parsedQuery : undefined,
  });

  // Use refs for mutable state accessed inside the message handler
  const currentFileRef = useRef(currentFile);
  currentFileRef.current = currentFile;
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
        const file = currentFileRef.current;
        setBookmarks(
          file
            ? messageData.data.filter((b: BookmarkData) => b.filepath === file)
            : messageData.data,
        );
      } else if (messageData?.type === 'CURRENT_FILE_PATH' && messageData.data) {
        setCurrentFile(messageData.data);
        setBookmarks((prevBookmarks) =>
          messageData.data
            ? prevBookmarks.filter((b: BookmarkData) => b.filepath === messageData.data)
            : prevBookmarks,
        );
      }
    };

    if (appWindow.iina?.onMessage) {
      appWindow.iina.onMessage('message', handleMessage);
    } else {
      window.addEventListener('message', handleMessage);
    }

    if (appWindow.iina?.postMessage) {
      appWindow.iina.postMessage('UI_READY', { uiType: 'overlay' });
      appWindow.iina.postMessage('REQUEST_FILE_PATH');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleBookmarkClick = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
  };

  const handleClose = () => {
    appWindow.iina?.postMessage?.('HIDE_OVERLAY');
    setIsVisible(false);
  };

  const handleAdvancedSearchChange = (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
    setParsedQuery(parsedQuery);
    setFilters((prev) => ({ ...prev, searchTerm, fileFilter: currentFile || '' }));
    setSearchTerm(searchTerm);
  };

  const formatTime = (seconds: number) =>
    new Date((seconds || 0) * 1000).toISOString().substring(11, 19);

  // Overlay displays bookmarks for the current file only
  const displayedBookmarks = allFilteredBookmarks;

  if (!isVisible || displayedBookmarks.length === 0) {
    return null;
  }

  return (
    <div className="bookmark-overlay">
      <div className="bookmark-overlay-header">
        <h3>Bookmarks ({displayedBookmarks.length})</h3>
        <button
          onClick={handleClose}
          className="close-btn"
          data-clickable="true"
          aria-label="Close bookmark overlay"
        >
          &times;
        </button>
      </div>
      {bookmarks.length > 3 && (
        <div className="overlay-search">
          {useAdvancedSearch ? (
            <AdvancedSearch
              onSearchChange={handleAdvancedSearchChange}
              availableTags={availableTags}
              placeholder="Search... (try: tag:work)"
              className="overlay-compact"
            />
          ) : (
            <div className="search-with-toggle">
              <label htmlFor="overlay-search-input" className="sr-only">
                Search bookmarks
              </label>
              <input
                id="overlay-search-input"
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFilters((prev) => ({
                    ...prev,
                    searchTerm: e.target.value,
                    fileFilter: currentFile || '',
                  }));
                }}
                className="overlay-search-input"
                aria-label="Search bookmarks"
              />
              <button
                onClick={() => setUseAdvancedSearch(true)}
                className="advanced-toggle-btn"
                title="Enable advanced search"
                aria-label="Enable advanced search"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
      <ul className="bookmark-list" role="list" aria-label="Bookmarks">
        {displayedBookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="bookmark-item"
            onClick={() => handleBookmarkClick(bookmark.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBookmarkClick(bookmark.id);
              }
            }}
            title={`Click to jump to ${bookmark.title}`}
            data-clickable="true"
            tabIndex={0}
            role="listitem"
            aria-label={`Jump to ${bookmark.title} at ${formatTime(bookmark.timestamp)}`}
          >
            <span className="bookmark-title">
              <TextHighlighter
                text={bookmark.title}
                searchTerms={searchTerm}
                caseSensitive={false}
              />
            </span>
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="bookmark-tags">
                {bookmark.tags.map((tag) => (
                  <span key={tag} className="bookmark-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <span className="bookmark-time">{formatTime(bookmark.timestamp)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App;
