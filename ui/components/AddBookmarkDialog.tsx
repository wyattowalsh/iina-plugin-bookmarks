import React, { useState, useEffect, useCallback } from 'react';
import TagInput from './TagInput';
import { formatTime } from '../utils/formatTime';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useWindowMessage } from '../hooks/useWindowMessage';
import { BookmarkDefaults } from '../types';

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
  postMessage,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  useEffect(() => {
    if (isOpen && postMessage) {
      setLoadingDefaults(true);
      // Request default values from the plugin
      postMessage('REQUEST_BOOKMARK_DEFAULTS');
    }
  }, [isOpen, postMessage]);

  const handleBookmarkDefaults = useCallback((data: any) => {
    const defaults: BookmarkDefaults = data;
    setTitle(defaults.title || '');
    setDescription(defaults.description || '');
    setTags(defaults.tags || []);
    setTimestamp(defaults.timestamp || 0);
    setLoadingDefaults(false);
  }, []);

  useWindowMessage('BOOKMARK_DEFAULTS', handleBookmarkDefaults, isOpen);

  // Escape key handler for dialog a11y
  const handleClose = useCallback(() => {
    onClose();
    setTitle('');
    setDescription('');
    setTags([]);
    setTimestamp(0);
    setLoadingDefaults(false);
  }, [onClose]);

  useEscapeKey(isOpen, handleClose);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      onSave(title.trim(), description.trim(), tags, timestamp);
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setTags([]);
      setTimestamp(0);
    } catch (error) {
      console.error('Error saving bookmark:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div className="dialog-content add-bookmark-dialog">
        <div className="dialog-header">
          <h3>Add New Bookmark</h3>
          <p className="dialog-subtitle">
            Values are auto-populated but can be edited before saving
          </p>
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
                <label htmlFor="bookmark-title">
                  Title
                  <span className="field-hint">✏️ Editable</span>
                </label>
                <input
                  id="bookmark-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bookmark title"
                  disabled={isLoading}
                  maxLength={255}
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
                  <span className="timestamp-note">{timestamp}s</span>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="bookmark-description">
                  Description
                  <span className="field-hint">✏️ Editable</span>
                </label>
                <textarea
                  id="bookmark-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  disabled={isLoading}
                  maxLength={2000}
                />
              </div>

              <div className="form-field">
                <label>
                  Tags
                  <span className="field-hint">✏️ Editable</span>
                </label>
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
            {isLoading ? 'Saving...' : 'Save Bookmark'}
          </button>
          <button onClick={handleClose} className="cancel-btn" disabled={isLoading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBookmarkDialog;
