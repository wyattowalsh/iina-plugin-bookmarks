import React, { useState, useCallback, useMemo } from 'react';
import TagInput from './TagInput';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { BookmarkData } from '../types';

interface BatchTagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBookmarks: BookmarkData[];
  availableTags: string[];
  postMessage: (type: string, data?: any) => void;
}

const BatchTagDialog: React.FC<BatchTagDialogProps> = ({
  isOpen,
  onClose,
  selectedBookmarks,
  availableTags,
  postMessage,
}) => {
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [tagsToRemove, setTagsToRemove] = useState<string[]>([]);

  const handleClose = useCallback(() => {
    setTagsToAdd([]);
    setTagsToRemove([]);
    onClose();
  }, [onClose]);

  useEscapeKey(isOpen, handleClose);

  // Tags shared by ALL selected bookmarks (intersection)
  const sharedTags = useMemo(() => {
    if (selectedBookmarks.length === 0) return [];
    const first = new Set(selectedBookmarks[0].tags);
    for (let i = 1; i < selectedBookmarks.length; i++) {
      const current = new Set(selectedBookmarks[i].tags);
      for (const tag of first) {
        if (!current.has(tag)) first.delete(tag);
      }
    }
    return Array.from(first);
  }, [selectedBookmarks]);

  // Tags present in SOME but not all (union minus intersection)
  const partialTags = useMemo(() => {
    if (selectedBookmarks.length <= 1) return [];
    const allTags = new Set<string>();
    for (const bm of selectedBookmarks) {
      for (const tag of bm.tags) allTags.add(tag);
    }
    const shared = new Set(sharedTags);
    return Array.from(allTags).filter((t) => !shared.has(t));
  }, [selectedBookmarks, sharedTags]);

  const handleApply = () => {
    const ids = selectedBookmarks.map((b) => b.id);
    if (tagsToAdd.length > 0) {
      postMessage('BATCH_TAG', { ids, tags: tagsToAdd, action: 'add' });
    }
    if (tagsToRemove.length > 0) {
      postMessage('BATCH_TAG', { ids, tags: tagsToRemove, action: 'remove' });
    }
    handleClose();
  };

  if (!isOpen) return null;

  const previewTitles = selectedBookmarks.slice(0, 3).map((b) => b.title);
  const remaining = selectedBookmarks.length - previewTitles.length;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div className="dialog-content" style={{ maxWidth: '460px' }}>
        <div className="dialog-header">
          <h3>Batch Tag Edit</h3>
          <p className="dialog-subtitle">
            {selectedBookmarks.length} bookmark{selectedBookmarks.length !== 1 ? 's' : ''} selected
          </p>
          <button onClick={handleClose} className="close-btn">
            &times;
          </button>
        </div>

        <div className="dialog-body">
          <div
            style={{
              backgroundColor: 'var(--bg-secondary, #2a2a2a)',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '12px',
              fontSize: '12px',
              color: 'var(--text-secondary, #888)',
            }}
          >
            {previewTitles.map((t, i) => (
              <div
                key={i}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {t}
              </div>
            ))}
            {remaining > 0 && <div>...and {remaining} more</div>}
          </div>

          {sharedTags.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '4px',
                  color: 'var(--text-secondary, #888)',
                }}
              >
                Shared by all ({sharedTags.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {sharedTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--accent-color, #3498db)',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {partialTags.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  marginBottom: '4px',
                  color: 'var(--text-secondary, #888)',
                }}
              >
                Shared by some ({partialTags.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {partialTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-secondary, #444)',
                      color: 'var(--text-primary, #eee)',
                      fontSize: '11px',
                      border: '1px dashed var(--border-color, #666)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="form-field">
            <label>Add tags</label>
            <TagInput
              tags={tagsToAdd}
              onTagsChange={setTagsToAdd}
              availableTags={availableTags}
              placeholder="Tags to add..."
            />
          </div>

          <div className="form-field">
            <label>Remove tags</label>
            <TagInput
              tags={tagsToRemove}
              onTagsChange={setTagsToRemove}
              availableTags={[...sharedTags, ...partialTags]}
              placeholder="Tags to remove..."
            />
          </div>
        </div>

        <div className="dialog-actions">
          <button
            onClick={handleApply}
            className="save-btn"
            disabled={tagsToAdd.length === 0 && tagsToRemove.length === 0}
          >
            Apply to {selectedBookmarks.length} bookmark{selectedBookmarks.length !== 1 ? 's' : ''}
          </button>
          <button onClick={handleClose} className="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchTagDialog;
