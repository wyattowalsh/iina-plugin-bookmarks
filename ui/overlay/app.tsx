import React, { useState, useEffect } from "react";
import AdvancedSearch, { ParsedSearchQuery } from "../components/AdvancedSearch";
import TextHighlighter from "../components/TextHighlighter";
import useAdvancedBookmarkFilters from "../hooks/useAdvancedBookmarkFilters";
import { FilterState } from "../components/FilterComponent";

interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  tags?: string[];
}

interface AppWindow extends Window {
  iina?: {
    postMessage: (type: string, data?: any) => void;
    onMessage: (event: string, callback: (data: any) => void) => void;
    log: (message: string) => void;
  };
}

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
    sortCriteria: [
      { field: 'createdAt', direction: 'desc', priority: 1 }
    ],
    enableMultiSort: false
  });
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | undefined>();
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const appWindow = window as unknown as AppWindow;

  // Enhanced filtering
  const { filteredBookmarks: allFilteredBookmarks, availableTags } = useAdvancedBookmarkFilters({
    bookmarks,
    filters,
    parsedQuery: useAdvancedSearch ? parsedQuery : undefined
  });

  useEffect(() => {
    const handleMessage = (event: any) => {
      let messageData = event.data;
      if (typeof event.data === 'string') {
        try { messageData = JSON.parse(event.data); } catch (e) { 
          return; 
        }
      }

      if (messageData?.type === "BOOKMARKS_UPDATED" && messageData.data) {
        setBookmarks(currentFile ? messageData.data.filter((b: BookmarkData) => b.filepath === currentFile) : messageData.data);
      } else if (messageData?.type === "CURRENT_FILE_PATH" && messageData.data) {
        setCurrentFile(messageData.data);
        setBookmarks(prevBookmarks => messageData.data ? prevBookmarks.filter((b: BookmarkData) => b.filepath === messageData.data) : prevBookmarks);
      }
    };

    if (appWindow.iina?.onMessage) {
      appWindow.iina.onMessage("message", handleMessage);
    } else {
      window.addEventListener("message", handleMessage);
    }
    
    if (appWindow.iina?.postMessage) {
      appWindow.iina.postMessage("UI_READY", { uiType: "overlay" });
      appWindow.iina.postMessage("REQUEST_FILE_PATH"); 
    }

    return () => {
      if (appWindow.iina?.onMessage) { /* no specific remove */ } 
      else { window.removeEventListener("message", handleMessage); }
    };
  }, [currentFile]);

  const handleBookmarkClick = (id: string) => {
    appWindow.iina?.postMessage?.("JUMP_TO_BOOKMARK", { id });
  };

  const handleClose = () => {
    appWindow.iina?.postMessage?.("HIDE_OVERLAY");
    setIsVisible(false); 
  };

  const handleAdvancedSearchChange = (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
    setParsedQuery(parsedQuery);
    setFilters(prev => ({ ...prev, searchTerm, fileFilter: currentFile || '' }));
    setSearchTerm(searchTerm);
  };

  // Filter bookmarks by current file and search term
  const displayedBookmarks = currentFile 
    ? allFilteredBookmarks.filter(b => b.filepath === currentFile)
    : []; // Show empty if no currentFile to avoid showing all

  if (!isVisible || displayedBookmarks.length === 0) {
    return null;
  }

  return (
    <div className="bookmark-overlay">
      <div className="bookmark-overlay-header">
        <h3>Bookmarks ({displayedBookmarks.length})</h3>
        <button onClick={handleClose} className="close-btn" data-clickable="true">&times;</button>
      </div>
      {bookmarks.filter(b => b.filepath === currentFile).length > 3 && (
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
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFilters(prev => ({ ...prev, searchTerm: e.target.value, fileFilter: currentFile || '' }));
                }}
                className="overlay-search-input"
              />
              <button 
                onClick={() => setUseAdvancedSearch(true)} 
                className="advanced-toggle-btn"
                title="Enable advanced search"
              >
                🔍+
              </button>
            </div>
          )}
        </div>
      )}
      <ul className="bookmark-list">
        {displayedBookmarks.map((bookmark) => (
          <li 
            key={bookmark.id} 
            className="bookmark-item"
            onClick={() => handleBookmarkClick(bookmark.id)} 
            title={`Click to jump to ${bookmark.title}`}
            data-clickable="true"
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
                {bookmark.tags.map(tag => (
                  <span key={tag} className="bookmark-tag">{tag}</span>
                ))}
              </div>
            )}
            <span className="bookmark-time">{new Date((bookmark.timestamp || 0) * 1000).toISOString().substr(11, 8)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App; 