import React from 'react';
import { BookmarkData } from '../types';
import { formatDate } from '../utils/formatTime';

interface FileSummaryCardsProps {
  bookmarksByFile: Map<string, BookmarkData[]>;
  currentFile?: string;
  onFileClick: (filepath: string) => void;
  selectedFile?: string;
}

const FileSummaryCards: React.FC<FileSummaryCardsProps> = ({
  bookmarksByFile,
  currentFile,
  onFileClick,
  selectedFile,
}) => {
  const entries = Array.from(bookmarksByFile.entries()).sort(([a], [b]) => {
    if (a === currentFile) return -1;
    if (b === currentFile) return 1;
    return a.localeCompare(b);
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        padding: '4px 2px 8px',
        scrollbarWidth: 'thin',
      }}
    >
      {entries.map(([filepath, bookmarks]) => {
        const isSelected = filepath === selectedFile;
        const isCurrent = filepath === currentFile;
        const fileName = filepath.split('/').pop() || filepath;
        const mostRecent = bookmarks.reduce((latest, b) => {
          const d = new Date(b.createdAt).getTime();
          return d > latest ? d : latest;
        }, 0);
        const allTags = Array.from(new Set(bookmarks.flatMap((b) => b.tags || [])));

        return (
          <div
            key={filepath}
            role="button"
            tabIndex={0}
            onClick={() => onFileClick(filepath)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFileClick(filepath);
              }
            }}
            style={{
              flexShrink: 0,
              minWidth: 160,
              maxWidth: 220,
              padding: '10px 14px',
              background: 'var(--card-bg)',
              border: isSelected
                ? '2px solid var(--accent-color)'
                : isCurrent
                  ? '2px solid var(--success-color)'
                  : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'box-shadow var(--duration-fast)',
            }}
          >
            {/* Filename */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 6,
              }}
              title={filepath}
            >
              {fileName}
            </div>

            {/* Large bookmark count */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--accent-color)',
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {bookmarks.length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
              bookmark{bookmarks.length !== 1 ? 's' : ''}
            </div>

            {/* Most recent date */}
            {mostRecent > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Latest: {formatDate(new Date(mostRecent).toISOString())}
              </div>
            )}

            {/* Top 5 tag pills */}
            {allTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {allTags.slice(0, 5).map((tag) => (
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FileSummaryCards;
