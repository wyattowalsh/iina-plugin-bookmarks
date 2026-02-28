import React, { useMemo } from 'react';
import { BookmarkData } from '../types';
import { getColorHex, BOOKMARK_COLORS } from './BookmarkColorPicker';

interface StatsDashboardProps {
  bookmarks: BookmarkData[];
  isExpanded: boolean;
  onToggle: () => void;
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({ bookmarks, isExpanded, onToggle }) => {
  const stats = useMemo(() => {
    const files = new Set(bookmarks.map((b) => b.filepath));
    const tagCounts = new Map<string, number>();
    const fileCounts = new Map<string, number>();
    const colorCounts = new Map<string, number>();
    let untagged = 0;
    let rangeCount = 0;

    for (const b of bookmarks) {
      // Tags
      if (!b.tags || b.tags.length === 0) {
        untagged++;
      } else {
        for (const tag of b.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // Files
      const fileName = b.filepath.split('/').pop() || b.filepath;
      fileCounts.set(fileName, (fileCounts.get(fileName) || 0) + 1);

      // Colors
      if (b.color) {
        colorCounts.set(b.color, (colorCounts.get(b.color) || 0) + 1);
      }

      // Ranges
      if (b.endTimestamp !== undefined && b.endTimestamp > b.timestamp) {
        rangeCount++;
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topFiles = Array.from(fileCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxFileCount = topFiles.length > 0 ? topFiles[0][1] : 0;

    return {
      total: bookmarks.length,
      fileCount: files.size,
      topTags,
      topFiles,
      maxFileCount,
      untagged,
      rangeCount,
      colorCounts,
    };
  }, [bookmarks]);

  return (
    <div
      style={{
        background: 'var(--surface-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
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
        <span>Statistics</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
          {stats.total} bookmarks across {stats.fileCount} file{stats.fileCount !== 1 ? 's' : ''}
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: '0 12px 12px' }}>
          {/* Summary row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <StatNumber label="Total" value={stats.total} />
            <StatNumber label="Files" value={stats.fileCount} />
            <StatNumber label="Untagged" value={stats.untagged} />
            <StatNumber label="Range" value={stats.rangeCount} />
          </div>

          {/* Top tags */}
          {stats.topTags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                Top Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {stats.topTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'var(--accent-light)',
                      color: 'var(--accent-color)',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                    <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Most bookmarked files - bar chart */}
          {stats.topFiles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                Most Bookmarked Files
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stats.topFiles.map(([file, count]) => (
                  <div key={file} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        width: 100,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                      title={file}
                    >
                      {file}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 12,
                        background: 'var(--border-subtle)',
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          width: `${stats.maxFileCount > 0 ? (count / stats.maxFileCount) * 100 : 0}%`,
                          height: '100%',
                          background: 'var(--accent-color)',
                          borderRadius: 3,
                          minWidth: 4,
                          transition: 'width var(--duration-normal)',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        width: 24,
                        textAlign: 'right',
                      }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Color distribution */}
          {stats.colorCounts.size > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                Colors
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BOOKMARK_COLORS.filter((c) => stats.colorCounts.has(c.name)).map((c) => (
                  <div
                    key={c.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    title={`${c.name}: ${stats.colorCounts.get(c.name)}`}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: getColorHex(c.name),
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {stats.colorCounts.get(c.name)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatNumber: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-color)', lineHeight: 1 }}>
      {value}
    </div>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
  </div>
);

export default StatsDashboard;
