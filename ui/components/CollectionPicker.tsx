import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BookmarkCollection, BookmarkColor } from '../types';

interface CollectionPickerProps {
  collections: BookmarkCollection[];
  bookmarkId: string;
  currentCollectionIds: string[];
  postMessage: (type: string, data?: any) => void;
}

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

const CollectionPicker: React.FC<CollectionPickerProps> = ({
  collections,
  bookmarkId,
  currentCollectionIds,
  postMessage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  const handleToggle = (collectionId: string, isInCollection: boolean) => {
    if (isInCollection) {
      postMessage('REMOVE_FROM_COLLECTION', {
        bookmarkIds: [bookmarkId],
        collectionId,
      });
    } else {
      postMessage('ADD_TO_COLLECTION', {
        bookmarkIds: [bookmarkId],
        collectionId,
      });
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: '1px solid var(--border-color, #555)',
          borderRadius: '4px',
          padding: '4px 8px',
          color: 'var(--text-primary, #eee)',
          cursor: 'pointer',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        aria-label="Assign to collection"
        title="Collections"
      >
        <span style={{ fontSize: '14px' }}>&#128193;</span>
        {currentCollectionIds.length > 0 && (
          <span
            style={{
              backgroundColor: 'var(--accent-color, #3498db)',
              color: '#fff',
              borderRadius: '8px',
              padding: '0 5px',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            {currentCollectionIds.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            minWidth: '200px',
            backgroundColor: 'var(--bg-primary, #1e1e1e)',
            border: '1px solid var(--border-color, #444)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '4px 0',
            marginTop: '4px',
          }}
        >
          {collections.length === 0 ? (
            <div
              style={{
                padding: '12px',
                fontSize: '12px',
                color: 'var(--text-secondary, #888)',
                textAlign: 'center',
              }}
            >
              No collections
            </div>
          ) : (
            collections.map((col) => {
              const isInCollection = currentCollectionIds.includes(col.id);
              return (
                <label
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-primary, #eee)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isInCollection}
                    onChange={() => handleToggle(col.id, isInCollection)}
                  />
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: COLOR_HEX[col.color || 'blue'],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.icon ? `${col.icon} ` : ''}
                    {col.name}
                  </span>
                </label>
              );
            })
          )}

          <div
            style={{
              borderTop: '1px solid var(--border-color, #444)',
              marginTop: '4px',
              paddingTop: '4px',
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                postMessage('OPEN_COLLECTION_MANAGER', {});
              }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '6px 12px',
                color: 'var(--accent-color, #3498db)',
                cursor: 'pointer',
                fontSize: '12px',
                textAlign: 'left',
              }}
            >
              New...
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionPicker;
