import React, { useState, useEffect, useCallback, useRef } from 'react';
import TagInput from './TagInput';
import Loading from './Loading';
import BookmarkColorPicker from './BookmarkColorPicker';
import { formatTime } from '../utils/formatTime';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useWindowMessage } from '../hooks/useWindowMessage';
import { BookmarkDefaults } from '../types';

interface AddBookmarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    tags: string[],
    timestamp: number,
    color?: string,
    endTimestamp?: number,
  ) => void;
  availableTags: string[];
  postMessage?: (type: string, data?: any) => void;
}

/** Parse a time string like "1:23:45" or "12:34" or "45" into seconds, or return null. */
function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map(Number);
  if (parts.some(isNaN)) return null;

  let seconds: number;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    seconds = parts[0];
  } else {
    return null;
  }

  return seconds >= 0 ? seconds : null;
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
  const [color, setColor] = useState<string | undefined>(undefined);
  const [endTimeInput, setEndTimeInput] = useState('');
  const [chapterTitle, setChapterTitle] = useState<string | undefined>(undefined);
  const [subtitleText, setSubtitleText] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const postMessageRef = useRef(postMessage);
  const requestedDefaultsForOpenRef = useRef(false);

  useEffect(() => {
    postMessageRef.current = postMessage;

    if (!isOpen) {
      requestedDefaultsForOpenRef.current = false;
      setLoadingDefaults(false);
      return;
    }

    if (!requestedDefaultsForOpenRef.current && postMessageRef.current) {
      requestedDefaultsForOpenRef.current = true;
      setLoadingDefaults(true);
      postMessageRef.current('REQUEST_BOOKMARK_DEFAULTS');
    }
  }, [isOpen, postMessage]);

  const handleBookmarkDefaults = useCallback((data: any) => {
    const defaults: BookmarkDefaults = data;
    setTitle(defaults.title || '');
    setDescription(defaults.description || '');
    setTags(defaults.tags || []);
    setTimestamp(defaults.timestamp || 0);
    // Pick up chapter/subtitle context if provided by backend
    if ((data as any).chapterTitle) setChapterTitle((data as any).chapterTitle);
    if ((data as any).subtitleText) setSubtitleText((data as any).subtitleText);
    setLoadingDefaults(false);
  }, []);

  useWindowMessage('BOOKMARK_DEFAULTS', handleBookmarkDefaults, isOpen);

  const handleClose = useCallback(() => {
    requestedDefaultsForOpenRef.current = false;
    onClose();
    setTitle('');
    setDescription('');
    setTags([]);
    setTimestamp(0);
    setColor(undefined);
    setEndTimeInput('');
    setChapterTitle(undefined);
    setSubtitleText(undefined);
    setLoadingDefaults(false);
  }, [onClose]);

  useEscapeKey(isOpen, handleClose);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const parsedEnd = parseTimeInput(endTimeInput);
      // Extract inline #hashtags from the description and merge with explicit tags
      const hashtagRegex = /#(\w[\w/-]*)/g;
      const extractedTags: string[] = [];
      let match;
      while ((match = hashtagRegex.exec(description)) !== null) {
        extractedTags.push(match[1]);
      }
      const allTags = [...new Set([...tags, ...extractedTags])];
      onSave(title.trim(), description.trim(), allTags, timestamp, color, parsedEnd ?? undefined);
      onClose();
      setTitle('');
      setDescription('');
      setTags([]);
      setTimestamp(0);
      setColor(undefined);
      setEndTimeInput('');
      setChapterTitle(undefined);
      setSubtitleText(undefined);
    } catch (error) {
      console.error('Error saving bookmark:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const parsedEnd = parseTimeInput(endTimeInput);
  const endTimeValid = endTimeInput.trim() === '' || parsedEnd !== null;

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
            <Loading size="small" message="Loading metadata..." />
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
                <label htmlFor="bookmark-end-time">End Time (optional)</label>
                <div className="timestamp-field">
                  <input
                    id="bookmark-end-time"
                    type="text"
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    placeholder="e.g. 1:30 or 90"
                    disabled={isLoading}
                    style={!endTimeValid ? { borderColor: '#FF3B30', outline: 'none' } : undefined}
                  />
                  {parsedEnd !== null && (
                    <span className="timestamp-note">{formatTime(parsedEnd)}</span>
                  )}
                </div>
                {!endTimeValid && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#FF3B30',
                      marginTop: '2px',
                    }}
                  >
                    Invalid format. Use H:MM:SS, MM:SS, or seconds.
                  </span>
                )}
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
                  maxLength={2000}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary, #888)',
                    marginTop: '2px',
                    display: 'block',
                  }}
                >
                  Tip: Use #tagname in the description to auto-add tags.
                </span>
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

              <div className="form-field">
                <label>Color</label>
                <BookmarkColorPicker selectedColor={color} onColorChange={setColor} />
              </div>

              {/* Chapter context */}
              {chapterTitle && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary, #666)',
                    padding: '6px 8px',
                    background: 'var(--background-secondary, #f5f5f5)',
                    borderRadius: '4px',
                    marginTop: '4px',
                  }}
                >
                  Chapter: {chapterTitle}
                </div>
              )}

              {/* Subtitle context */}
              {subtitleText && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary, #666)',
                    padding: '6px 8px',
                    background: 'var(--background-secondary, #f5f5f5)',
                    borderRadius: '4px',
                    marginTop: '4px',
                    fontStyle: 'italic',
                  }}
                >
                  Subtitle: {subtitleText}
                </div>
              )}
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button
            onClick={handleSave}
            className="save-btn"
            disabled={!title.trim() || !endTimeValid || isLoading || loadingDefaults}
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
