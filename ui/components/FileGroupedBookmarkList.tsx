import React, { useState, useEffect, useMemo } from 'react';
import { BookmarkData } from '../types';
import { formatTime, formatRelativeTime } from '../utils/formatTime';
import { getColorHex } from './BookmarkColorPicker';
import TextHighlighter from './TextHighlighter';

interface FileGroupedBookmarkListProps {
  bookmarksByFile: Map<string, BookmarkData[]>;
  currentFile?: string;
  onBookmarkClick: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  selectedBookmarkId?: string;
  searchTerm?: string;
}

const FileGroupedBookmarkList: React.FC<FileGroupedBookmarkListProps> = ({
  bookmarksByFile,
  currentFile,
  onBookmarkClick,
  onDeleteBookmark,
  selectedBookmarkId,
  searchTerm,
}) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Expand current file section by default when it changes
  useEffect(() => {
    if (currentFile) {
      setExpandedFiles((prev) => {
        const next = new Set(prev);
        next.add(currentFile);
        return next;
      });
    }
  }, [currentFile]);

  const sortedEntries = useMemo(() => {
    const entries = Array.from(bookmarksByFile.entries());
    // Current file first, then alphabetical
    return entries.sort(([a], [b]) => {
      if (a === currentFile) return -1;
      if (b === currentFile) return 1;
      return a.localeCompare(b);
    });
  }, [bookmarksByFile, currentFile]);

  const toggleFile = (filepath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filepath)) {
        next.delete(filepath);
      } else {
        next.add(filepath);
      }
      return next;
    });
  };

  const fileName = (filepath: string) => {
    const parts = filepath.split('/');
    const name = parts[parts.length - 1] || filepath;
    return name.length > 40 ? name.slice(0, 37) + '...' : name;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sortedEntries.map(([filepath, bookmarks]) => {
        const isExpanded = expandedFiles.has(filepath);
        const isCurrent = filepath === currentFile;

        return (
          <div key={filepath} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {/* File section header */}
            <button
              type="button"
              onClick={() => toggleFile(filepath)}
              aria-expanded={isExpanded}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'var(--surface-secondary)',
                border: 'none',
                borderRadius: isExpanded
                  ? 'var(--radius-md) var(--radius-md) 0 0'
                  : 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform var(--duration-fast) var(--ease-out)',
                  fontSize: 10,
                }}
              >
                &#9654;
              </span>

              {isCurrent && (
                <span
                  title="Now Playing"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--success-color)',
                    flexShrink: 0,
                  }}
                />
              )}

              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fileName(filepath)}
              </span>

              <span
                style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 10,
                  flexShrink: 0,
                }}
              >
                {bookmarks.length}
              </span>
            </button>

            {/* Bookmark items */}
            {isExpanded && (
              <div
                style={{
                  borderLeft: '1px solid var(--border-color)',
                  borderRight: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                }}
              >
                {bookmarks.map((bookmark) => {
                  const isSelected = bookmark.id === selectedBookmarkId;
                  const isRange =
                    bookmark.endTimestamp !== undefined &&
                    bookmark.endTimestamp > bookmark.timestamp;
                  const isScratchpad = bookmark.scratchpad;
                  const colorHex = bookmark.color ? getColorHex(bookmark.color) : undefined;

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
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                        borderBottom: '1px solid var(--border-subtle)',
                        opacity: isScratchpad ? 0.6 : 1,
                        borderLeft: isScratchpad ? '2px dashed var(--text-muted)' : 'none',
                        transition: 'background var(--duration-fast)',
                      }}
                    >
                      {/* Color dot */}
                      {colorHex && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: colorHex,
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {bookmark.pinned && (
                            <span
                              style={{ fontSize: 11, color: 'var(--warning-color)' }}
                              title="Pinned"
                            >
                              &#x1F4CC;
                            </span>
                          )}
                          <span
                            style={{
                              fontWeight: 500,
                              fontSize: 13,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <TextHighlighter
                              text={bookmark.title}
                              searchTerms={searchTerm || ''}
                              caseSensitive={false}
                            />
                          </span>
                        </div>

                        {/* Timestamp + range */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--timestamp-color)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatTime(bookmark.timestamp)}
                          </span>
                          {isRange && bookmark.endTimestamp !== undefined && (
                            <span
                              style={{
                                fontSize: 11,
                                background: 'var(--timestamp-bg)',
                                color: 'var(--timestamp-color)',
                                padding: '0 6px',
                                borderRadius: 4,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {formatTime(bookmark.timestamp)} &rarr;{' '}
                              {formatTime(bookmark.endTimestamp)} (
                              {Math.round(bookmark.endTimestamp - bookmark.timestamp)}s)
                            </span>
                          )}
                          <span
                            style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}
                          >
                            {formatRelativeTime(bookmark.createdAt)}
                          </span>
                        </div>

                        {/* Tags */}
                        {bookmark.tags && bookmark.tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {bookmark.tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: 'var(--accent-light)',
                                  color: 'var(--accent-color)',
                                  fontWeight: 500,
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Scratchpad promote chip */}
                        {isScratchpad && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 4,
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              border: '1px dashed var(--text-muted)',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Promotion handled by parent via PROMOTE_SCRATCHPAD message
                            }}
                          >
                            Promote
                          </span>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBookmark(bookmark.id);
                        }}
                        title="Delete bookmark"
                        aria-label={`Delete ${bookmark.title}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: 14,
                          lineHeight: 1,
                          opacity: 0.5,
                          flexShrink: 0,
                        }}
                      >
                        &#10005;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FileGroupedBookmarkList;
