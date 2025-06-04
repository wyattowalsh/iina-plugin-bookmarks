import React, { useState, useEffect } from "react";
import FilterComponent, { FilterState } from "../components/FilterComponent";
import TextHighlighter from "../components/TextHighlighter";
import useBookmarkFilters from "../hooks/useBookmarkFilters";

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
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateRange: { start: '', end: '' },
    tags: [],
    sortBy: 'createdAt',
    sortDirection: 'desc',
    fileFilter: ''
  });

  const appWindow = window as unknown as AppWindow;

  const { filteredBookmarks, resultsCount, availableTags } = useBookmarkFilters({
    bookmarks,
    filters
  });

  useEffect(() => {
    const handleMessage = (event: any) => {
      let messageData = event.data;
      if (typeof event.data === 'string') {
        try { messageData = JSON.parse(event.data); } catch (e) { return; }
      }

      if (messageData?.type === "BOOKMARKS_UPDATED" && messageData.data) {
        setBookmarks(messageData.data);
      } else if (messageData?.type === "CURRENT_FILE_PATH" && messageData.data) {
        setCurrentFile(messageData.data);
      }
    };

    if (appWindow.iina?.onMessage) {
      appWindow.iina.onMessage("message", handleMessage);
    } else {
      window.addEventListener("message", handleMessage);
    }

    if (appWindow.iina?.postMessage) {
      appWindow.iina.postMessage("UI_READY", { uiType: "sidebar" });
    }

    return () => {
      if (appWindow.iina?.onMessage) { /* no specific remove */ } 
      else { window.removeEventListener("message", handleMessage); }
    };
  }, []);

  useEffect(() => {
    if (!currentFile && appWindow.iina?.postMessage) {
        appWindow.iina.postMessage("REQUEST_FILE_PATH");
    }
  }, [currentFile]);

  const handleAddBookmark = () => {
    appWindow.iina?.postMessage?.("ADD_BOOKMARK", { 
      title: `New Sidebar Bookmark ${new Date().toLocaleTimeString()}`,
      timestamp: null, 
      description: "Added from sidebar"
    });
  };

  const handleDeleteBookmark = (id: string) => {
    appWindow.iina?.postMessage?.("DELETE_BOOKMARK", { id });
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.("JUMP_TO_BOOKMARK", { id });
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  return (
    <div className="bookmark-sidebar">
      <div className="sidebar-header">
        <h2>Bookmarks (Current File)</h2>
        <button onClick={handleAddBookmark} className="add-bookmark-btn">Add Bookmark</button>
      </div>

      <FilterComponent
        onFilterChange={setFilters}
        availableTags={availableTags}
        resultsCount={resultsCount}
        compact={true}
        initialFilters={filters}
      />

      <ul className="bookmark-list">
        {filteredBookmarks.map(bookmark => (
          <li key={bookmark.id} className="bookmark-item">
            <div className="bookmark-content" onClick={() => handleJumpToBookmark(bookmark.id)}>
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
                <div className="bookmark-tags">
                  {bookmark.tags.map(tag => (
                    <span key={tag} className="bookmark-tag">{tag}</span>
                  ))}
                </div>
              )}
              <div className="bookmark-meta">
                <span className="timestamp">{new Date((bookmark.timestamp || 0) * 1000).toISOString().substr(11, 8)}</span>
                <span className="created-date">{formatDate(bookmark.createdAt)}</span>
              </div>
            </div>
            <button onClick={() => handleDeleteBookmark(bookmark.id)} className="delete-btn">&times;</button>
          </li>
        ))}
        {filteredBookmarks.length === 0 && <p className="empty-state">No bookmarks match your current filters.</p>}
      </ul>
    </div>
  );
};

export default App; 