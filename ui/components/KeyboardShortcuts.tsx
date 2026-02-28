import React from 'react';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: '\u2191 / \u2193', description: 'Navigate bookmark list' },
      { keys: 'Enter', description: 'Jump to selected bookmark' },
      { keys: '1\u20139', description: 'Jump to bookmark by index' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Space', description: 'Toggle selection in batch mode' },
      { keys: '\u2318/Ctrl + A', description: 'Select all bookmarks' },
      { keys: 'Escape', description: 'Clear selection / close dialog' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: 'P', description: 'Toggle pin on selected' },
      { keys: 'T', description: 'Open tag dialog for selected' },
      { keys: 'C', description: 'Open color picker for selected' },
      { keys: 'E', description: 'Edit selected bookmark' },
      { keys: 'Delete / Backspace', description: 'Delete selected bookmark' },
      { keys: 'L', description: 'Loop selected range bookmark' },
    ],
  },
  {
    title: 'Views',
    shortcuts: [
      { keys: '! (Shift+1)', description: 'Grouped view' },
      { keys: '@ (Shift+2)', description: 'List view' },
      { keys: '# (Shift+3)', description: 'Gallery view' },
      { keys: '$ (Shift+4)', description: 'Timeline view' },
      { keys: '?', description: 'Show this help' },
    ],
  },
  {
    title: 'Search & Filter',
    shortcuts: [
      { keys: '\u2318/Ctrl + F', description: 'Focus search' },
      { keys: '\u2318/Ctrl + N', description: 'Add new bookmark' },
    ],
  },
  {
    title: 'Global (IINA)',
    shortcuts: [
      { keys: 'Ctrl + B', description: 'Quick bookmark (no dialog)' },
      { keys: 'Ctrl + ]', description: 'Next bookmark in file' },
      { keys: 'Ctrl + [', description: 'Previous bookmark in file' },
    ],
  },
];

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isOpen, onClose }) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div
        className="dialog-content"
        style={{ maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}
      >
        <div className="dialog-header">
          <h3>Keyboard Shortcuts</h3>
          <button onClick={onClose} className="close-btn" aria-label="Close shortcuts help">
            &times;
          </button>
        </div>
        <div className="dialog-body" style={{ padding: '12px 16px' }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} style={{ marginBottom: 16 }}>
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                {group.title}
              </h4>
              {group.shortcuts.map((sc) => (
                <div
                  key={sc.keys}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {sc.description}
                  </span>
                  <kbd
                    style={{
                      fontFamily: "'SF Mono', Monaco, monospace",
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--surface-secondary)',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sc.keys}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="dialog-actions">
          <button onClick={onClose} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
