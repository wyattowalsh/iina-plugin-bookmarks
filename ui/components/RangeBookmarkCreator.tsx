import React from 'react';
import { formatTime } from '../utils/formatTime';

interface RangeBookmarkCreatorProps {
  inPoint: number | null;
  outPoint: number | null;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onCreateRange: () => void;
  onClear: () => void;
}

const RangeBookmarkCreator: React.FC<RangeBookmarkCreatorProps> = ({
  inPoint,
  outPoint,
  onSetInPoint,
  onSetOutPoint,
  onCreateRange,
  onClear,
}) => {
  const bothSet = inPoint !== null && outPoint !== null;
  const duration = bothSet ? Math.abs(outPoint - inPoint) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        background: 'var(--background-secondary, #f5f5f5)',
        borderRadius: '8px',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* In Point */}
        <button
          type="button"
          onClick={onSetInPoint}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #ccc)',
            background:
              inPoint !== null ? 'var(--accent-color, #007AFF)' : 'var(--background-primary, #fff)',
            color: inPoint !== null ? '#fff' : 'var(--text-primary, #333)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
          title="Set range start to current playback time"
        >
          Set In
        </button>

        <span
          style={{
            fontFamily: 'monospace',
            color: 'var(--text-secondary, #666)',
            minWidth: '60px',
            textAlign: 'center',
          }}
        >
          {inPoint !== null ? formatTime(inPoint) : '--:--'}
        </span>

        <span style={{ color: 'var(--text-secondary, #666)' }}>—</span>

        <span
          style={{
            fontFamily: 'monospace',
            color: 'var(--text-secondary, #666)',
            minWidth: '60px',
            textAlign: 'center',
          }}
        >
          {outPoint !== null ? formatTime(outPoint) : '--:--'}
        </span>

        {/* Out Point */}
        <button
          type="button"
          onClick={onSetOutPoint}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #ccc)',
            background:
              outPoint !== null
                ? 'var(--accent-color, #007AFF)'
                : 'var(--background-primary, #fff)',
            color: outPoint !== null ? '#fff' : 'var(--text-primary, #333)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
          title="Set range end to current playback time"
        >
          Set Out
        </button>
      </div>

      {/* Duration display */}
      {duration !== null && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary, #666)',
            textAlign: 'center',
          }}
        >
          Duration: {formatTime(duration)}
        </div>
      )}

      {/* Action row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={onCreateRange}
          disabled={!bothSet}
          style={{
            padding: '5px 14px',
            borderRadius: '6px',
            border: 'none',
            background: bothSet
              ? 'var(--accent-color, #007AFF)'
              : 'var(--background-tertiary, #ddd)',
            color: bothSet ? '#fff' : 'var(--text-secondary, #999)',
            cursor: bothSet ? 'pointer' : 'default',
            fontSize: '12px',
            fontWeight: 600,
            opacity: bothSet ? 1 : 0.6,
          }}
        >
          Create Range Bookmark
        </button>

        {(inPoint !== null || outPoint !== null) && (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #666)',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline',
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default RangeBookmarkCreator;
