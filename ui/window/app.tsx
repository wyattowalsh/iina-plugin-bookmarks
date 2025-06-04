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
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const appWindow = window as unknown as AppWindow;

  useEffect(() => {
    const handleMessage = (event: any) => {
      let messageData = event.data;
      if (typeof event.data === 'string') {
        try { messageData = JSON.parse(event.data); } catch (e) { return; }
      }

      if (messageData?.type === "BOOKMARKS_UPDATED" && messageData.data) {
        setBookmarks(messageData.data); // Window UI receives all bookmarks from plugin
        if (selectedBookmark && !messageData.data.find((b: BookmarkData) => b.id === selectedBookmark.id)) {
            setSelectedBookmark(null);
            setIsEditing(false);
        }
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
      appWindow.iina.postMessage("UI_READY", { uiType: "window" });
      // Request current file path for context (e.g., for new bookmarks)
      appWindow.iina.postMessage("REQUEST_FILE_PATH"); 
    }

    return () => {
      if (appWindow.iina?.onMessage) { /* no specific remove */ } 
      else { window.removeEventListener("message", handleMessage); }
    };
  }, [selectedBookmark]);

  // No separate useEffect for REQUEST_FILE_PATH for window as it primarily shows all bookmarks.
  // currentFile is mostly for context if needed.

  const handleAddBookmark = () => {
    // When adding from main window, it should ideally add to the *currently active* video in IINA
    // The plugin's addBookmark method already uses core.status.path for this.
    appWindow.iina?.postMessage?.("ADD_BOOKMARK", { 
      title: `New Bookmark ${new Date().toLocaleTimeString()}`,
      timestamp: null, // Plugin will use current time of active video
      description: "Added from bookmark manager window"
    });
  };

  const handleDeleteBookmark = (id: string) => {
    appWindow.iina?.postMessage?.("DELETE_BOOKMARK", { id });
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.("JUMP_TO_BOOKMARK", { id });
  };

  const handleEditBookmark = (bookmark: BookmarkData) => {
    setSelectedBookmark(bookmark);
    setEditTitle(bookmark.title);
    setEditDescription(bookmark.description || "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (selectedBookmark) {
      appWindow.iina?.postMessage?.("UPDATE_BOOKMARK", {
        id: selectedBookmark.id,
        data: { title: editTitle, description: editDescription }
      });
      setIsEditing(false);
      // Optimistically update UI, or wait for BOOKMARKS_UPDATED from plugin
      setSelectedBookmark(prev => prev ? {...prev, title: editTitle, description: editDescription} : null);
      setBookmarks(prevBks => prevBks.map(b => b.id === selectedBookmark.id ? {...b, title: editTitle, description: editDescription} : b));
    }
  };

  const filteredAndSortedBookmarks = useMemo(() => {
    return bookmarks // Window UI receives all bookmarks, filtering is client-side
      .filter(b => 
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (b.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.filepath.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "timestamp") { // Timestamp sort is less meaningful without file context unless comparing within same file
            if (a.filepath === b.filepath) return a.timestamp - b.timestamp;
            return 0; // Or sort by filepath first, then timestamp
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [bookmarks, searchTerm, sortBy]);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substr(11, 8);

  return (
    <div className="bookmark-window">
      <div className="window-header">
        <h1>Manage All Bookmarks</h1>
        <div className="header-actions">
          <button onClick={handleAddBookmark} className="add-bookmark-btn">Add Bookmark to Current Video</button>
        </div>
      </div>

      <div className="controls-main">
        <input 
          type="text" 
          placeholder="Search all bookmarks (title, description, path)..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="search-input-large"
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="sort-select-large">
          <option value="createdAt">Sort by Date Added</option>
          <option value="title">Sort by Title</option>
          <option value="timestamp">Sort by Timestamp (within file)</option>
        </select>
      </div>

      <div className="content-area">
        <div className="bookmark-list-panel">
          {filteredAndSortedBookmarks.length === 0 ? (
            <p className="empty-state-text">No bookmarks found, or none match your search.</p>
          ) : (
            filteredAndSortedBookmarks.map(bookmark => (
              <div 
                key={bookmark.id} 
                className={`bookmark-entry ${selectedBookmark?.id === bookmark.id ? 'selected' : ''}`}
                onClick={() => setSelectedBookmark(bookmark)}
              >
                <h4>{bookmark.title}</h4>
                <p className="filepath" title={bookmark.filepath}>{bookmark.filepath.split('/').pop()} ({formatTime(bookmark.timestamp)})</p>
                <p className="created-date-small">Added: {new Date(bookmark.createdAt).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>

        {selectedBookmark && (
          <div className="bookmark-detail-panel">
            {isEditing ? (
              <div className="edit-form">
                <h3>Edit Bookmark</h3>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description"></textarea>
                <div className="edit-actions">
                    <button onClick={handleSaveEdit} className="save-btn">Save Changes</button>
                    <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="details-view">
                <h3>{selectedBookmark.title}</h3>
                <p><strong>File:</strong> <span title={selectedBookmark.filepath}>{selectedBookmark.filepath}</span></p>
                <p><strong>Time:</strong> {formatTime(selectedBookmark.timestamp)}</p>
                <p><strong>Description:</strong> {selectedBookmark.description || "N/A"}</p>
                <p><strong>Created:</strong> {formatDate(selectedBookmark.createdAt)}</p>
                <div className="detail-actions">
                    <button onClick={() => handleJumpToBookmark(selectedBookmark.id)} className="jump-btn">Jump To</button>
                    <button onClick={() => handleEditBookmark(selectedBookmark)} className="edit-btn">Edit</button>
                    <button onClick={() => handleDeleteBookmark(selectedBookmark.id)} className="delete-btn-detail">Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
         {!selectedBookmark && filteredAndSortedBookmarks.length > 0 && (
            <div className="bookmark-detail-panel placeholder-panel">
                <p>Select a bookmark from the list to view or edit its details.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default App; 