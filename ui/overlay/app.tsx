import React, { useState, useEffect } from "react";
import TextHighlighter from "../components/TextHighlighter";

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
  const [isVisible, setIsVisible] = useState(true); 
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const appWindow = window as unknown as AppWindow;

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

  // Filter bookmarks by current file and search term
  const displayedBookmarks = currentFile 
    ? bookmarks.filter(b => {
        const matchesFile = b.filepath === currentFile;
        const matchesSearch = !searchTerm || 
          b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (b.description && b.description.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFile && matchesSearch;
      })
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
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="overlay-search-input"
          />
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
            <span className="bookmark-time">{new Date((bookmark.timestamp || 0) * 1000).toISOString().substr(11, 8)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App; 