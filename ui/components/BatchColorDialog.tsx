import React, { useState, useCallback } from 'react';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { BookmarkColor } from '../types';

interface BatchColorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  postMessage: (type: string, data?: any) => void;
}

const BOOKMARK_COLORS: BookmarkColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'grey',
];

const COLOR_HEX: Record<BookmarkColor, string> = {
  red: '#e74c3c',
  orange: '#e67e22',
  yellow: '#f1c40f',
  green: '#2ecc71',
  blue: '#3498db',
  purple: '#9b59b6',
  pink: '#e91e8a',
  grey: '#95a5a6',
};

const COLOR_LABELS: Record<BookmarkColor, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  grey: 'Grey',
};

const BatchColorDialog: React.FC<BatchColorDialogProps> = ({
  isOpen,
  onClose,
  selectedCount,
  postMessage,
}) => {
  const [selectedColor, setSelectedColor] = useState<BookmarkColor | null>(null);

  const handleClose = useCallback(() => {
    setSelectedColor(null);
    onClose();
  }, [onClose]);

  useEscapeKey(isOpen, handleClose);

  const handleApply = () => {
    if (!selectedColor) return;
    postMessage('BATCH_COLOR', { color: selectedColor });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div className="dialog-content" style={{ maxWidth: '360px' }}>
        <div className="dialog-header">
          <h3>Set Color</h3>
          <p className="dialog-subtitle">
            Choose a color for {selectedCount} bookmark{selectedCount !== 1 ? 's' : ''}
          </p>
          <button onClick={handleClose} className="close-btn">
            &times;
          </button>
        </div>

        <div className="dialog-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              padding: '8px 0',
            }}
          >
            {BOOKMARK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                aria-label={`Select ${color}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border:
                    selectedColor === color
                      ? `2px solid ${COLOR_HEX[color]}`
                      : '2px solid transparent',
                  backgroundColor:
                    selectedColor === color ? 'var(--bg-secondary, #2a2a2a)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: COLOR_HEX[color],
                    boxShadow:
                      selectedColor === color
                        ? `0 0 0 3px var(--bg-primary, #1e1e1e), 0 0 0 5px ${COLOR_HEX[color]}`
                        : 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color:
                      selectedColor === color
                        ? 'var(--text-primary, #eee)'
                        : 'var(--text-secondary, #888)',
                    fontWeight: selectedColor === color ? 600 : 400,
                  }}
                >
                  {COLOR_LABELS[color]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-actions">
          <button onClick={handleApply} className="save-btn" disabled={!selectedColor}>
            Apply to {selectedCount} bookmark{selectedCount !== 1 ? 's' : ''}
          </button>
          <button onClick={handleClose} className="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchColorDialog;
