import React, { useCallback } from 'react';
import { formatTime } from '../utils/formatTime';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { BookmarkData } from '../types';

interface DuplicateDetectionDialogProps {
  isOpen: boolean;
  existingBookmark: BookmarkData | null;
  newTimestamp: number;
  onMerge: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

const DuplicateDetectionDialog: React.FC<DuplicateDetectionDialogProps> = ({
  isOpen,
  existingBookmark,
  newTimestamp,
  onMerge,
  onCreateNew,
  onCancel,
}) => {
  const handleClose = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useEscapeKey(isOpen, handleClose);

  if (!isOpen || !existingBookmark) return null;

  const distance = Math.abs(newTimestamp - existingBookmark.timestamp);
  const distanceText =
    distance < 1
      ? 'less than 1 second away'
      : distance === 1
        ? '1 second away'
        : `${Math.round(distance)} seconds away`;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div className="dialog-content" style={{ maxWidth: '440px' }}>
        <div className="dialog-header">
          <h3>Near-Duplicate Detected</h3>
          <p className="dialog-subtitle">A bookmark already exists close to this timestamp</p>
          <button onClick={handleClose} className="close-btn">
            &times;
          </button>
        </div>

        <div className="dialog-body">
          <div
            style={{
              backgroundColor: 'var(--bg-secondary, #2a2a2a)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #888)',
                marginBottom: '4px',
              }}
            >
              Existing bookmark
            </div>
            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>
              {existingBookmark.title}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
              {formatTime(existingBookmark.timestamp)}
              {existingBookmark.tags.length > 0 && (
                <span style={{ marginLeft: '8px' }}>Tags: {existingBookmark.tags.join(', ')}</span>
              )}
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              padding: '8px 0',
              fontSize: '13px',
              color: 'var(--text-secondary, #888)',
            }}
          >
            New bookmark at{' '}
            <strong style={{ color: 'var(--text-primary, #eee)' }}>
              {formatTime(newTimestamp)}
            </strong>{' '}
            is <strong style={{ color: '#e67e22' }}>{distanceText}</strong>
          </div>
        </div>

        <div className="dialog-actions" style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onMerge} className="save-btn" style={{ flex: 1 }}>
            Merge into existing
          </button>
          <button onClick={onCreateNew} className="cancel-btn" style={{ flex: 1 }}>
            Create new anyway
          </button>
          <button onClick={onCancel} className="cancel-btn" style={{ flex: 0 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateDetectionDialog;
