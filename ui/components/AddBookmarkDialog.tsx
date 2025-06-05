import React, { useState, useEffect } from "react";
import TagInput from "./TagInput";

interface BookmarkDefaults {
  title: string;
  description: string;
  tags: string[];
  timestamp: number;
  filepath: string;
}

interface AddBookmarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, description: string, tags: string[], timestamp: number) => void;
  availableTags: string[];
  postMessage?: (type: string, data?: any) => void;
}

const AddBookmarkDialog: React.FC<AddBookmarkDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  availableTags,
  postMessage
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  useEffect(() => {
    if (isOpen && postMessage) {
      setLoadingDefaults(true);
      // Request default values from the plugin
      postMessage("REQUEST_BOOKMARK_DEFAULTS");
    }
  }, [isOpen, postMessage]);

  useEffect(() => {
    const handleMessage = (event: any) => {
      let messageData = event.data;
      if (typeof event.data === 'string') {
        try {
          messageData = JSON.parse(event.data);
        } catch (e) {
          return;
        }
      }

      if (messageData?.type === "BOOKMARK_DEFAULTS" && messageData.data) {
        const defaults: BookmarkDefaults = messageData.data;
        setTitle(defaults.title || "");
        setDescription(defaults.description || "");
        setTags(defaults.tags || []);
        setTimestamp(defaults.timestamp || 0);
        setLoadingDefaults(false);
      }
    };

    if (isOpen) {
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [isOpen]);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` 
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setIsLoading(true);
    try {
      onSave(title.trim(), description.trim(), tags, timestamp);
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
      setTags([]);
      setTimestamp(0);
    } catch (error) {
      console.error("Error saving bookmark:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form when closing
    setTitle("");
    setDescription("");
    setTags([]);
    setTimestamp(0);
    setLoadingDefaults(false);
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content add-bookmark-dialog">
        <div className="dialog-header">
          <h3>Add New Bookmark</h3>
          <button onClick={handleClose} className="close-btn" disabled={isLoading}>
            &times;
          </button>
        </div>

        <div className="dialog-body">
          {loadingDefaults ? (
            <div className="loading-defaults">
              <span className="loading-spinner">⏳</span>
              <span>Loading metadata...</span>
            </div>
          ) : (
            <>
              <div className="form-field">
                <label htmlFor="bookmark-title">Title</label>
                <input
                  id="bookmark-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bookmark title"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label htmlFor="bookmark-timestamp">Time</label>
                <div className="timestamp-field">
                  <input
                    id="bookmark-timestamp"
                    type="text"
                    value={formatTime(timestamp)}
                    readOnly
                    disabled={isLoading}
                  />
                  <span className="timestamp-note">
                    {timestamp}s
                  </span>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="bookmark-description">Description</label>
                <textarea
                  id="bookmark-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              <div className="form-field">
                <label>Tags</label>
                <TagInput
                  tags={tags}
                  onTagsChange={setTags}
                  availableTags={availableTags}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button
            onClick={handleSave}
            className="save-btn"
            disabled={!title.trim() || isLoading || loadingDefaults}
          >
            {isLoading ? "Saving..." : "Save Bookmark"}
          </button>
          <button
            onClick={handleClose}
            className="cancel-btn"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBookmarkDialog; 