import React from 'react';
import { BookmarkData } from '../types';
import { getColorHex } from './BookmarkColorPicker';
import BookmarkThumbnail from './BookmarkThumbnail';
import TextHighlighter from './TextHighlighter';

interface BookmarkGalleryProps {
  bookmarks: BookmarkData[];
  onBookmarkClick: (id: string) => void;
  onGenerateThumbnail?: (id: string) => void;
  selectedBookmarkId?: string;
  searchTerm?: string;
}

const BookmarkGallery: React.FC<BookmarkGalleryProps> = ({
  bookmarks,
  onBookmarkClick,
  onGenerateThumbnail,
  selectedBookmarkId,
  searchTerm,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        padding: 4,
      }}
    >
      {bookmarks.map((bookmark) => {
        const isSelected = bookmark.id === selectedBookmarkId;
        const colorHex = bookmark.color ? getColorHex(bookmark.color) : undefined;
        const fileName = bookmark.filepath.split('/').pop() || bookmark.filepath;

        return (
          <div
            key={bookmark.id}
            role="button"
            tabIndex={0}
            onClick={() => onBookmarkClick(bookmark.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onBookmarkClick(bookmark.id);
              }
            }}
            style={{
              background: 'var(--card-bg)',
              border: isSelected
                ? '2px solid var(--accent-color)'
                : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              cursor: 'pointer',
              transition:
                'transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {/* Color stripe */}
            {colorHex && (
              <div
                style={{
                  height: 3,
                  background: colorHex,
                  width: '100%',
                }}
              />
            )}

            {/* Thumbnail */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 8px 4px' }}>
              <BookmarkThumbnail
                bookmark={bookmark}
                size="medium"
                onGenerateThumbnail={onGenerateThumbnail}
              />
            </div>

            {/* Card content */}
            <div style={{ padding: '4px 10px 10px' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 4,
                }}
              >
                <TextHighlighter
                  text={bookmark.title}
                  searchTerms={searchTerm || ''}
                  caseSensitive={false}
                />
              </div>

              {/* File badge */}
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 6,
                }}
                title={bookmark.filepath}
              >
                {fileName}
              </div>

              {/* Tags */}
              {bookmark.tags && bookmark.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {bookmark.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: 'var(--accent-light)',
                        color: 'var(--accent-color)',
                        fontWeight: 500,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {bookmark.tags.length > 4 && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      +{bookmark.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BookmarkGallery;
