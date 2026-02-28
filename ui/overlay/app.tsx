import React, { useState, useRef, useCallback, useEffect } from 'react';
import AdvancedSearch, { ParsedSearchQuery } from '../components/AdvancedSearch';
import BookmarkTimeline from '../components/BookmarkTimeline';
import TextHighlighter from '../components/TextHighlighter';
import { ToastContainer } from '../components/Toast';
import useAdvancedBookmarkFilters from '../hooks/useAdvancedBookmarkFilters';
import useToast from '../hooks/useToast';
import { FilterState, DEFAULT_FILTER_STATE } from '../components/FilterComponent';
import { useIinaMessages } from '../hooks/useIinaMessages';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { BookmarkData, PlaybackStatus, ChapterInfo, AppWindow } from '../types';
import { formatTime } from '../utils/formatTime';

const BOTTOM_PROXIMITY_THRESHOLD = 0.7; // Show timeline when cursor is in bottom 30%

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | undefined>();
  const [duration, setDuration] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const appWindow = window as unknown as AppWindow;
  const { toasts, showSuccess, showError, showInfo, dismissToast } = useToast();

  // Stable refs for toast functions used inside message handlers
  const showSuccessRef = useRef(showSuccess);
  showSuccessRef.current = showSuccess;
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const showInfoRef = useRef(showInfo);
  showInfoRef.current = showInfo;

  // Enhanced filtering
  const { filteredBookmarks: allFilteredBookmarks, availableTags } = useAdvancedBookmarkFilters({
    bookmarks,
    filters,
    parsedQuery,
  });

  useIinaMessages(
    {
      BOOKMARKS_UPDATED: (data: BookmarkData[]) => {
        setBookmarks(data);
      },
      CURRENT_FILE_PATH: (data: string) => {
        setCurrentFile(data);
        setFilters((prev) => ({ ...prev, fileFilter: data || '' }));
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
      ERROR: (data: any) => {
        showErrorRef.current('Error', data?.message || 'An unexpected error occurred');
      },
      PLAYBACK_STATUS: (data: PlaybackStatus) => {
        setDuration(data.duration);
        setCurrentPosition(data.position);
        setChapters(data.chapters);
      },
    },
    'overlay',
  );

  const handleBookmarkClick = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
  };

  const handleClose = () => {
    appWindow.iina?.postMessage?.('HIDE_OVERLAY');
    setIsVisible(false);
  };

  useEscapeKey(isVisible, handleClose);

  // Proximity-based timeline visibility: show when cursor is in the bottom 30%
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ratio = e.clientY / window.innerHeight;
      setShowTimeline(ratio >= BOTTOM_PROXIMITY_THRESHOLD);
    };
    const handleMouseLeave = () => setShowTimeline(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleTimelineSeek = useCallback(
    (timestamp: number) => {
      appWindow.iina?.postMessage?.('SEEK_TO_TIMESTAMP', { timestamp });
    },
    [appWindow],
  );

  const handleAdvancedSearchChange = useCallback(
    (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
      setParsedQuery(parsedQuery);
      setFilters((prev) => ({ ...prev, searchTerm, fileFilter: currentFile || '' }));
      setSearchTerm(searchTerm);
    },
    [currentFile],
  );

  // Overlay displays bookmarks for the current file only
  const displayedBookmarks = allFilteredBookmarks;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bookmark-overlay">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
      {bookmarks.length > 0 && (
        <div className="overlay-search">
          <AdvancedSearch
            onSearchChange={handleAdvancedSearchChange}
            availableTags={availableTags}
            placeholder="Search... (try: tag:work)"
            className="overlay-compact"
          />
        </div>
      )}
      {displayedBookmarks.length === 0 ? (
        <p className="empty-state">No bookmarks for this file</p>
      ) : (
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
              <span className="bookmark-time">{formatTime(bookmark.timestamp)}</span>
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
            </li>
          ))}
        </ul>
      )}
      {showTimeline && duration > 0 && bookmarks.length > 0 && (
        <div className="overlay-timeline-strip">
          <BookmarkTimeline
            bookmarks={displayedBookmarks}
            duration={duration}
            currentPosition={currentPosition}
            chapters={chapters}
            onBookmarkClick={handleBookmarkClick}
            onSeek={handleTimelineSeek}
            ultraCompact
          />
        </div>
      )}
    </div>
  );
};

export default App;
