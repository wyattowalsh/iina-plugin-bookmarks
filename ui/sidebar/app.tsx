import React, { useState, useEffect, useMemo } from "react";

interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"timestamp" | "title" | "createdAt">("createdAt");
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const appWindow = window as unknown as AppWindow;

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
  
  const filteredAndSortedBookmarks = useMemo(() => {
    return bookmarks // Bookmarks are already filtered by path by the plugin for sidebar
      .filter(b => 
         (b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (b.description || "").toLowerCase().includes(searchTerm.toLowerCase())))
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "timestamp") return a.timestamp - b.timestamp;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [bookmarks, searchTerm, sortBy]); // Removed currentFile dependency as plugin sends filtered data

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  return (
    <div className="bookmark-sidebar">
      <div className="sidebar-header">
        <h2>Bookmarks (Current File)</h2>
        <button onClick={handleAddBookmark} className="add-bookmark-btn">Add Bookmark</button>
      </div>
      <div className="controls">
        <input 
          type="text" 
          placeholder="Search current file bookmarks..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="search-input"
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="sort-select">
          <option value="createdAt">Sort by Date</option>
          <option value="title">Sort by Title</option>
          <option value="timestamp">Sort by Time</option>
        </select>
      </div>
      <ul className="bookmark-list">
        {filteredAndSortedBookmarks.map(bookmark => (
          <li key={bookmark.id} className="bookmark-item">
            <div className="bookmark-content" onClick={() => handleJumpToBookmark(bookmark.id)}>
              <h4 className="bookmark-title">{bookmark.title}</h4>
              <p className="bookmark-description">{bookmark.description}</p>
              <div className="bookmark-meta">
                <span className="timestamp">{new Date((bookmark.timestamp || 0) * 1000).toISOString().substr(11, 8)}</span>
                <span className="created-date">{formatDate(bookmark.createdAt)}</span>
              </div>
            </div>
            <button onClick={() => handleDeleteBookmark(bookmark.id)} className="delete-btn">&times;</button>
          </li>
        ))}
        {filteredAndSortedBookmarks.length === 0 && <p className="empty-state">No bookmarks for this file, or none match your search.</p>}
      </ul>
    </div>
  );
};

export default App; 