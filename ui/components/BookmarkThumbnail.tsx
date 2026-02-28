import React from 'react';
import { BookmarkData } from '../types';
import { formatTime } from '../utils/formatTime';
import { getColorHex } from './BookmarkColorPicker';

interface BookmarkThumbnailProps {
  bookmark: BookmarkData;
  size: 'small' | 'medium' | 'large';
  onGenerateThumbnail?: (id: string) => void;
}

const SIZE_MAP = { small: 60, medium: 120, large: 200 } as const;

const BookmarkThumbnail: React.FC<BookmarkThumbnailProps> = ({
  bookmark,
  size,
  onGenerateThumbnail,
}) => {
  const px = SIZE_MAP[size];
  const colorHex = bookmark.color ? getColorHex(bookmark.color) : '#8E8E93';

  const containerStyle: React.CSSProperties = {
    width: px,
    height: Math.round(px * 0.5625), // 16:9
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  };

  if (bookmark.thumbnailPath) {
    return (
      <div style={containerStyle}>
        <img
          src={bookmark.thumbnailPath}
          alt={bookmark.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  const placeholderStyle: React.CSSProperties = {
    ...containerStyle,
    background: `${colorHex}22`,
    border: `1px solid ${colorHex}44`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: size === 'small' ? 2 : 6,
  };

  return (
    <div style={placeholderStyle}>
      <span
        style={{
          fontSize: size === 'small' ? 10 : size === 'medium' ? 13 : 16,
          fontWeight: 600,
          color: colorHex,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(bookmark.timestamp)}
      </span>
      {size !== 'small' && onGenerateThumbnail && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onGenerateThumbnail(bookmark.id);
          }}
          style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Generate
        </button>
      )}
    </div>
  );
};

export default BookmarkThumbnail;
