import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BookmarkData, ChapterInfo } from '../types';
import { formatTime } from '../utils/formatTime';

const BOOKMARK_COLOR_HEX: Record<string, string> = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  blue: '#007AFF',
  purple: '#AF52DE',
  pink: '#FF2D55',
  grey: '#8E8E93',
};

const ACCENT_COLOR = '#007AFF';
const CLUSTER_THRESHOLD_PCT = 2;

interface BookmarkTimelineProps {
  bookmarks: BookmarkData[];
  duration: number;
  currentPosition?: number;
  chapters?: ChapterInfo[];
  onBookmarkClick: (id: string) => void;
  onSeek?: (timestamp: number) => void;
  compact?: boolean;
  ultraCompact?: boolean;
  selectedBookmarkId?: string;
  showChapterLanes?: boolean;
}

interface Cluster {
  position: number;
  count: number;
  bookmarks: BookmarkData[];
}

function resolveColor(bookmark: BookmarkData): string {
  return bookmark.color ? BOOKMARK_COLOR_HEX[bookmark.color] || ACCENT_COLOR : ACCENT_COLOR;
}

function buildClusters(
  bookmarks: BookmarkData[],
  duration: number,
): { singles: BookmarkData[]; clusters: Cluster[] } {
  if (duration <= 0) return { singles: bookmarks, clusters: [] };

  const points = bookmarks
    .filter((b) => b.endTimestamp == null)
    .map((b) => ({ bookmark: b, pct: (b.timestamp / duration) * 100 }))
    .sort((a, b) => a.pct - b.pct);

  const singles: BookmarkData[] = [];
  const clusters: Cluster[] = [];

  let i = 0;
  while (i < points.length) {
    let j = i + 1;
    while (j < points.length && points[j].pct - points[i].pct <= CLUSTER_THRESHOLD_PCT) {
      j++;
    }
    const groupSize = j - i;
    if (groupSize >= 3) {
      const group = points.slice(i, j);
      const avgPct = group.reduce((s, g) => s + g.pct, 0) / groupSize;
      clusters.push({
        position: avgPct,
        count: groupSize,
        bookmarks: group.map((g) => g.bookmark),
      });
    } else {
      for (let k = i; k < j; k++) {
        singles.push(points[k].bookmark);
      }
    }
    i = j;
  }

  return { singles, clusters };
}

const BookmarkTimeline: React.FC<BookmarkTimelineProps> = ({
  bookmarks,
  duration,
  currentPosition,
  chapters,
  onBookmarkClick,
  onSeek,
  compact,
  ultraCompact,
  selectedBookmarkId,
  showChapterLanes,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredClusterIdx, setHoveredClusterIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const rangeBookmarks = useMemo(
    () => bookmarks.filter((b) => b.endTimestamp != null && b.endTimestamp > b.timestamp),
    [bookmarks],
  );

  const { singles, clusters } = useMemo(
    () => buildClusters(bookmarks, duration),
    [bookmarks, duration],
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!barRef.current || duration <= 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('.timeline-marker') || target.closest('.timeline-cluster')) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek?.(pct * duration);
    },
    [duration, onSeek],
  );

  const handleMarkerHover = useCallback((bookmarkId: string | null, e?: React.MouseEvent) => {
    setHoveredId(bookmarkId);
    setHoveredClusterIdx(null);
    if (bookmarkId && e && barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: rect.top - e.clientY });
    } else {
      setTooltipPos(null);
    }
  }, []);

  const handleClusterHover = useCallback((idx: number | null, e?: React.MouseEvent) => {
    setHoveredClusterIdx(idx);
    setHoveredId(null);
    if (idx != null && e && barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: rect.top - e.clientY });
    } else {
      setTooltipPos(null);
    }
  }, []);

  const hoveredBookmark = useMemo(() => {
    if (!hoveredId) return null;
    return bookmarks.find((b) => b.id === hoveredId) ?? null;
  }, [hoveredId, bookmarks]);

  const chapterForTimestamp = useCallback(
    (ts: number): string | undefined => {
      if (!chapters || chapters.length === 0) return undefined;
      let found: ChapterInfo | undefined;
      for (const ch of chapters) {
        if (ch.time <= ts) found = ch;
        else break;
      }
      return found?.title;
    },
    [chapters],
  );

  if (duration <= 0) return null;

  const sizeClass = ultraCompact ? 'ultra-compact' : compact ? 'compact' : '';

  return (
    <div
      className={`bookmark-timeline ${sizeClass}`}
      ref={barRef}
      onClick={handleBarClick}
      role="slider"
      aria-label="Bookmark timeline"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentPosition ?? 0}
      tabIndex={0}
    >
      {/* Chapter lanes */}
      {showChapterLanes && chapters && chapters.length > 0 && (
        <div className="timeline-chapter-lanes">
          {chapters.map((chapter, idx) => {
            const startPct = (chapter.time / duration) * 100;
            const nextTime = idx < chapters.length - 1 ? chapters[idx + 1].time : duration;
            const widthPct = ((nextTime - chapter.time) / duration) * 100;
            return (
              <div
                key={`ch-${idx}`}
                className={`timeline-chapter-lane ${idx % 2 === 1 ? 'alt' : ''}`}
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                title={chapter.title}
              >
                {!ultraCompact && <span className="chapter-label">{chapter.title}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Range bookmarks */}
      {rangeBookmarks.map((bookmark) => {
        const startPct = (bookmark.timestamp / duration) * 100;
        const endPct = ((bookmark.endTimestamp! - bookmark.timestamp) / duration) * 100;
        const color = resolveColor(bookmark);
        return (
          <div
            key={`range-${bookmark.id}`}
            className={`timeline-range ${selectedBookmarkId === bookmark.id ? 'selected' : ''}`}
            style={{
              left: `${startPct}%`,
              width: `${endPct}%`,
              backgroundColor: color,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkClick(bookmark.id);
            }}
            onMouseEnter={(e) => handleMarkerHover(bookmark.id, e)}
            onMouseLeave={() => handleMarkerHover(null)}
            title={`${bookmark.title}: ${formatTime(bookmark.timestamp)} - ${formatTime(bookmark.endTimestamp!)}`}
          />
        );
      })}

      {/* Point bookmark markers */}
      {singles.map((bookmark) => {
        const pct = (bookmark.timestamp / duration) * 100;
        const color = resolveColor(bookmark);
        const isSelected = selectedBookmarkId === bookmark.id;
        return (
          <div
            key={`marker-${bookmark.id}`}
            className={`timeline-marker ${isSelected ? 'selected' : ''}`}
            style={{ left: `${pct}%`, backgroundColor: color }}
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkClick(bookmark.id);
            }}
            onMouseEnter={(e) => handleMarkerHover(bookmark.id, e)}
            onMouseLeave={() => handleMarkerHover(null)}
            role="button"
            aria-label={`${bookmark.title} at ${formatTime(bookmark.timestamp)}`}
            tabIndex={0}
          />
        );
      })}

      {/* Cluster dots */}
      {clusters.map((cluster, idx) => (
        <div
          key={`cluster-${idx}`}
          className="timeline-cluster"
          style={{ left: `${cluster.position}%` }}
          onClick={(e) => {
            e.stopPropagation();
            // Click the first bookmark in the cluster
            onBookmarkClick(cluster.bookmarks[0].id);
          }}
          onMouseEnter={(e) => handleClusterHover(idx, e)}
          onMouseLeave={() => handleClusterHover(null)}
          role="button"
          aria-label={`${cluster.count} bookmarks clustered`}
          tabIndex={0}
        >
          <span className="cluster-badge">{cluster.count}</span>
        </div>
      ))}

      {/* Playhead */}
      {currentPosition != null && currentPosition >= 0 && (
        <div
          className="timeline-playhead"
          style={{ left: `${(currentPosition / duration) * 100}%` }}
        />
      )}

      {/* Time labels */}
      {!ultraCompact && (
        <div className="timeline-time-labels">
          <span className="time-label-start">0:00</span>
          <span className="time-label-end">{formatTime(duration)}</span>
        </div>
      )}

      {/* Tooltip */}
      {tooltipPos && hoveredBookmark && (
        <div
          className="timeline-tooltip"
          style={{ left: tooltipPos.x, bottom: '100%', marginBottom: 8 }}
        >
          <div className="tooltip-title">{hoveredBookmark.title}</div>
          <div className="tooltip-time">
            {formatTime(hoveredBookmark.timestamp)}
            {hoveredBookmark.endTimestamp != null &&
              ` - ${formatTime(hoveredBookmark.endTimestamp)}`}
          </div>
          {chapterForTimestamp(hoveredBookmark.timestamp) && (
            <div className="tooltip-chapter">{chapterForTimestamp(hoveredBookmark.timestamp)}</div>
          )}
        </div>
      )}

      {/* Cluster tooltip */}
      {tooltipPos && hoveredClusterIdx != null && clusters[hoveredClusterIdx] && (
        <div
          className="timeline-tooltip"
          style={{ left: tooltipPos.x, bottom: '100%', marginBottom: 8 }}
        >
          <div className="tooltip-title">{clusters[hoveredClusterIdx].count} bookmarks</div>
          {clusters[hoveredClusterIdx].bookmarks.slice(0, 5).map((b) => (
            <div key={b.id} className="tooltip-time">
              {b.title} ({formatTime(b.timestamp)})
            </div>
          ))}
          {clusters[hoveredClusterIdx].count > 5 && (
            <div className="tooltip-time">...and {clusters[hoveredClusterIdx].count - 5} more</div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookmarkTimeline;
