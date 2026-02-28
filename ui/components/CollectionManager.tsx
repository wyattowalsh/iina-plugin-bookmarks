import React, { useState, useCallback } from 'react';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type {
  BookmarkCollection,
  SmartCollection,
  SmartCollectionFilters,
  BookmarkColor,
} from '../types';

interface CollectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  collections: BookmarkCollection[];
  smartCollections: SmartCollection[];
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

type ActiveTab = 'collections' | 'smart';

interface EditingCollection {
  id: string;
  name: string;
  description: string;
  color: BookmarkColor;
  icon: string;
}

function summarizeFilters(filters: SmartCollectionFilters): string {
  const parts: string[] = [];
  if (filters.searchTerm) parts.push(`search: "${filters.searchTerm}"`);
  if (filters.fileFilter) parts.push(`file: "${filters.fileFilter}"`);
  if (filters.tags && filters.tags.length > 0) parts.push(`tags: ${filters.tags.join(', ')}`);
  if (filters.showOnlyUntagged) parts.push('untagged');
  if (filters.showOnlyPinned) parts.push('pinned');
  if (filters.showOnlyRangeBookmarks) parts.push('ranges');
  if (filters.showOnlyScratchpad) parts.push('scratchpad');
  if (filters.dateRange) parts.push(`${filters.dateRange.start} - ${filters.dateRange.end}`);
  return parts.length > 0 ? parts.join(' + ') : 'No filters';
}

const CollectionManager: React.FC<CollectionManagerProps> = ({
  isOpen,
  onClose,
  collections,
  smartCollections,
  postMessage,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('collections');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState<BookmarkColor>('blue');
  const [newIcon, setNewIcon] = useState('');
  const [editing, setEditing] = useState<EditingCollection | null>(null);

  // Smart collection form
  const [showNewSmartForm, setShowNewSmartForm] = useState(false);
  const [smartName, setSmartName] = useState('');
  const [smartDescription, setSmartDescription] = useState('');
  const [smartColor, setSmartColor] = useState<BookmarkColor>('purple');
  const [smartIcon, setSmartIcon] = useState('');
  const [smartFilters, setSmartFilters] = useState<SmartCollectionFilters>({});

  const handleClose = useCallback(() => {
    setShowNewForm(false);
    setShowNewSmartForm(false);
    setEditing(null);
    onClose();
  }, [onClose]);

  useEscapeKey(isOpen, handleClose);

  const resetNewForm = () => {
    setNewName('');
    setNewDescription('');
    setNewColor('blue');
    setNewIcon('');
    setShowNewForm(false);
  };

  const resetSmartForm = () => {
    setSmartName('');
    setSmartDescription('');
    setSmartColor('purple');
    setSmartIcon('');
    setSmartFilters({});
    setShowNewSmartForm(false);
  };

  const handleCreateCollection = () => {
    if (!newName.trim()) return;
    postMessage('CREATE_COLLECTION', {
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      color: newColor,
      icon: newIcon.trim() || undefined,
    });
    resetNewForm();
  };

  const handleUpdateCollection = () => {
    if (!editing || !editing.name.trim()) return;
    postMessage('UPDATE_COLLECTION', {
      id: editing.id,
      data: {
        name: editing.name.trim(),
        description: editing.description.trim() || undefined,
        color: editing.color,
        icon: editing.icon.trim() || undefined,
      },
    });
    setEditing(null);
  };

  const handleDeleteCollection = (id: string) => {
    postMessage('DELETE_COLLECTION', { id });
  };

  const handleCreateSmartCollection = () => {
    if (!smartName.trim()) return;
    postMessage('CREATE_SMART_COLLECTION', {
      name: smartName.trim(),
      description: smartDescription.trim() || undefined,
      filters: smartFilters,
      color: smartColor,
      icon: smartIcon.trim() || undefined,
    });
    resetSmartForm();
  };

  const handleDeleteSmartCollection = (id: string) => {
    postMessage('DELETE_SMART_COLLECTION', { id });
  };

  const startEditing = (col: BookmarkCollection) => {
    setEditing({
      id: col.id,
      name: col.name,
      description: col.description || '',
      color: col.color || 'blue',
      icon: col.icon || '',
    });
  };

  const renderColorSwatches = (selected: BookmarkColor, onChange: (c: BookmarkColor) => void) => (
    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
      {BOOKMARK_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: COLOR_HEX[c],
            border: selected === c ? '2px solid #fff' : '2px solid transparent',
            outline: selected === c ? `2px solid ${COLOR_HEX[c]}` : 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      ))}
    </div>
  );

  if (!isOpen) return null;

  const tabStyle = (tab: ActiveTab): React.CSSProperties => ({
    padding: '8px 16px',
    border: 'none',
    borderBottom:
      activeTab === tab ? '2px solid var(--accent-color, #3498db)' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: activeTab === tab ? 'var(--accent-color, #3498db)' : 'var(--text-secondary, #888)',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: '13px',
  });

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div className="dialog-content" style={{ maxWidth: '520px' }}>
        <div className="dialog-header">
          <h3>Manage Collections</h3>
          <button onClick={handleClose} className="close-btn">
            &times;
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color, #333)',
            marginBottom: '12px',
          }}
        >
          <button style={tabStyle('collections')} onClick={() => setActiveTab('collections')}>
            Collections
          </button>
          <button style={tabStyle('smart')} onClick={() => setActiveTab('smart')}>
            Smart Collections
          </button>
        </div>

        <div className="dialog-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {activeTab === 'collections' && (
            <>
              {collections.map((col) => (
                <div
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-color, #333)',
                    gap: '8px',
                  }}
                >
                  {editing?.id === col.id ? (
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        style={{ width: '100%', marginBottom: '6px' }}
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editing.description}
                        onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                        placeholder="Description (optional)"
                        style={{ width: '100%', marginBottom: '6px' }}
                      />
                      <input
                        type="text"
                        value={editing.icon}
                        onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                        placeholder="Icon emoji (optional)"
                        style={{ width: '60px', marginBottom: '6px' }}
                        maxLength={2}
                      />
                      {renderColorSwatches(editing.color, (c) =>
                        setEditing({ ...editing, color: c }),
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          className="save-btn"
                          onClick={handleUpdateCollection}
                          disabled={!editing.name.trim()}
                        >
                          Save
                        </button>
                        <button className="cancel-btn" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: COLOR_HEX[col.color || 'blue'],
                          flexShrink: 0,
                        }}
                      />
                      {col.icon && <span style={{ fontSize: '16px' }}>{col.icon}</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{col.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)' }}>
                          {col.bookmarkIds.length} bookmark{col.bookmarkIds.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => startEditing(col)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-secondary, #888)',
                          padding: '4px',
                        }}
                        aria-label={`Edit ${col.name}`}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCollection(col.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#e74c3c',
                          padding: '4px',
                        }}
                        aria-label={`Delete ${col.name}`}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}

              {collections.length === 0 && !showNewForm && (
                <p
                  style={{
                    color: 'var(--text-secondary, #888)',
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '16px 0',
                  }}
                >
                  No collections yet. Create one to get started.
                </p>
              )}

              {showNewForm ? (
                <div style={{ padding: '12px 0' }}>
                  <div className="form-field">
                    <label htmlFor="new-collection-name">Name</label>
                    <input
                      id="new-collection-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Collection name"
                      autoFocus
                      maxLength={100}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="new-collection-desc">Description</label>
                    <input
                      id="new-collection-desc"
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Optional description"
                      maxLength={500}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="new-collection-icon">Icon</label>
                    <input
                      id="new-collection-icon"
                      type="text"
                      value={newIcon}
                      onChange={(e) => setNewIcon(e.target.value)}
                      placeholder="Emoji (optional)"
                      style={{ width: '60px' }}
                      maxLength={2}
                    />
                  </div>
                  <div className="form-field">
                    <label>Color</label>
                    {renderColorSwatches(newColor, setNewColor)}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button
                      className="save-btn"
                      onClick={handleCreateCollection}
                      disabled={!newName.trim()}
                    >
                      Create
                    </button>
                    <button className="cancel-btn" onClick={resetNewForm}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewForm(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '8px',
                    border: '1px dashed var(--border-color, #555)',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: 'var(--accent-color, #3498db)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  + New Collection
                </button>
              )}
            </>
          )}

          {activeTab === 'smart' && (
            <>
              {smartCollections.map((sc) => (
                <div
                  key={sc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-color, #333)',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: COLOR_HEX[sc.color || 'purple'],
                      flexShrink: 0,
                    }}
                  />
                  {sc.icon && <span style={{ fontSize: '16px' }}>{sc.icon}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>
                      {sc.name}
                      {sc.builtin && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary, #888)',
                            marginLeft: '6px',
                          }}
                        >
                          built-in
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)' }}>
                      {summarizeFilters(sc.filters)}
                    </div>
                  </div>
                  {!sc.builtin && (
                    <button
                      onClick={() => handleDeleteSmartCollection(sc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#e74c3c',
                        padding: '4px',
                      }}
                      aria-label={`Delete ${sc.name}`}
                      title="Delete"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}

              {smartCollections.length === 0 && !showNewSmartForm && (
                <p
                  style={{
                    color: 'var(--text-secondary, #888)',
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '16px 0',
                  }}
                >
                  No smart collections yet.
                </p>
              )}

              {showNewSmartForm ? (
                <div style={{ padding: '12px 0' }}>
                  <div className="form-field">
                    <label htmlFor="smart-name">Name</label>
                    <input
                      id="smart-name"
                      type="text"
                      value={smartName}
                      onChange={(e) => setSmartName(e.target.value)}
                      placeholder="Smart collection name"
                      autoFocus
                      maxLength={100}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="smart-desc">Description</label>
                    <input
                      id="smart-desc"
                      type="text"
                      value={smartDescription}
                      onChange={(e) => setSmartDescription(e.target.value)}
                      placeholder="Optional description"
                      maxLength={500}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="smart-icon">Icon</label>
                    <input
                      id="smart-icon"
                      type="text"
                      value={smartIcon}
                      onChange={(e) => setSmartIcon(e.target.value)}
                      placeholder="Emoji (optional)"
                      style={{ width: '60px' }}
                      maxLength={2}
                    />
                  </div>
                  <div className="form-field">
                    <label>Color</label>
                    {renderColorSwatches(smartColor, setSmartColor)}
                  </div>
                  <div className="form-field">
                    <label htmlFor="smart-search">Search term filter</label>
                    <input
                      id="smart-search"
                      type="text"
                      value={smartFilters.searchTerm || ''}
                      onChange={(e) =>
                        setSmartFilters({
                          ...smartFilters,
                          searchTerm: e.target.value || undefined,
                        })
                      }
                      placeholder="Match bookmark titles/descriptions"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="smart-file">File path filter</label>
                    <input
                      id="smart-file"
                      type="text"
                      value={smartFilters.fileFilter || ''}
                      onChange={(e) =>
                        setSmartFilters({
                          ...smartFilters,
                          fileFilter: e.target.value || undefined,
                        })
                      }
                      placeholder="Match file paths"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="smart-tags">Tags filter (comma-separated)</label>
                    <input
                      id="smart-tags"
                      type="text"
                      value={(smartFilters.tags || []).join(', ')}
                      onChange={(e) => {
                        const tags = e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean);
                        setSmartFilters({
                          ...smartFilters,
                          tags: tags.length > 0 ? tags : undefined,
                        });
                      }}
                      placeholder="tag1, tag2"
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                    <label
                      style={{
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={smartFilters.showOnlyPinned || false}
                        onChange={(e) =>
                          setSmartFilters({
                            ...smartFilters,
                            showOnlyPinned: e.target.checked || undefined,
                          })
                        }
                      />
                      Pinned only
                    </label>
                    <label
                      style={{
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={smartFilters.showOnlyUntagged || false}
                        onChange={(e) =>
                          setSmartFilters({
                            ...smartFilters,
                            showOnlyUntagged: e.target.checked || undefined,
                          })
                        }
                      />
                      Untagged only
                    </label>
                    <label
                      style={{
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={smartFilters.showOnlyRangeBookmarks || false}
                        onChange={(e) =>
                          setSmartFilters({
                            ...smartFilters,
                            showOnlyRangeBookmarks: e.target.checked || undefined,
                          })
                        }
                      />
                      Range bookmarks
                    </label>
                    <label
                      style={{
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={smartFilters.showOnlyScratchpad || false}
                        onChange={(e) =>
                          setSmartFilters({
                            ...smartFilters,
                            showOnlyScratchpad: e.target.checked || undefined,
                          })
                        }
                      />
                      Scratchpad
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                    <button
                      className="save-btn"
                      onClick={handleCreateSmartCollection}
                      disabled={!smartName.trim()}
                    >
                      Create
                    </button>
                    <button className="cancel-btn" onClick={resetSmartForm}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewSmartForm(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '8px',
                    border: '1px dashed var(--border-color, #555)',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: 'var(--accent-color, #3498db)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  + New Smart Collection
                </button>
              )}
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button onClick={handleClose} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionManager;
