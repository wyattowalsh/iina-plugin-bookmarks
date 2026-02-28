import React, { useState, useRef, useCallback, useMemo } from 'react';
import { FilterState, DEFAULT_FILTER_STATE } from '../components/FilterComponent';
import AdvancedSearch, { ParsedSearchQuery } from '../components/AdvancedSearch';
import TextHighlighter from '../components/TextHighlighter';
import AddBookmarkDialog from '../components/AddBookmarkDialog';
import ExportDialog from '../components/ExportDialog';
import ImportDialog from '../components/ImportDialog';
import FileReconciliationDialog from '../components/FileReconciliationDialog';
import BookmarkTimeline from '../components/BookmarkTimeline';
import { ToastContainer } from '../components/Toast';
import Loading from '../components/Loading';
import useAdvancedBookmarkFilters from '../hooks/useAdvancedBookmarkFilters';
import { useEscapeKey } from '../hooks/useEscapeKey';
import useFilterHistory from '../hooks/useFilterHistory';
import useToast from '../hooks/useToast';
import { useIinaMessages } from '../hooks/useIinaMessages';
import { BookmarkData, PlaybackStatus, ChapterInfo, AppWindow } from '../types';
import { formatTime, formatDate, formatRelativeTime } from '../utils/formatTime';

// ---------------------------------------------------------------------------
// Tag hierarchy helpers
// ---------------------------------------------------------------------------

interface TagNode {
  name: string;
  fullPath: string;
  count: number;
  children: TagNode[];
}

function buildTagTree(tags: string[]): TagNode[] {
  const root: TagNode[] = [];
  const nodeMap = new Map<string, TagNode>();

  // Count occurrences of each tag
  const tagCounts = new Map<string, number>();
  for (const tag of tags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  // Get unique tags sorted
  const uniqueTags = Array.from(new Set(tags)).sort();

  for (const tag of uniqueTags) {
    const parts = tag.split('/');
    // Limit tree depth to 3 levels, flatten deeper tags
    const limitedParts =
      parts.length > 3 ? [...parts.slice(0, 2), parts.slice(2).join('/')] : parts;

    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < limitedParts.length; i++) {
      const part = limitedParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let existing = nodeMap.get(currentPath);
      if (!existing) {
        existing = {
          name: part,
          fullPath: currentPath,
          count: 0,
          children: [],
        };
        nodeMap.set(currentPath, existing);
        currentLevel.push(existing);
      }

      // Only count at the leaf level matching an actual tag
      if (i === limitedParts.length - 1) {
        existing.count = tagCounts.get(tag) || 0;
      }

      currentLevel = existing.children;
    }
  }

  return root;
}

// ---------------------------------------------------------------------------
// Tag tree component
// ---------------------------------------------------------------------------

const TagTreeNode: React.FC<{
  node: TagNode;
  level: number;
  onSelect: (fullPath: string) => void;
  activeTags: string[];
}> = ({ node, level, onSelect, activeTags }) => {
  const [expanded, setExpanded] = useState(level === 0);
  const hasChildren = node.children.length > 0;
  const isActive = activeTags.some((t) => t === node.fullPath || t.startsWith(node.fullPath + '/'));

  return (
    <div className="tag-tree-node">
      <div
        className={`tag-tree-label ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={() => onSelect(node.fullPath)}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={isActive}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.fullPath);
          }
          if (hasChildren && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
            e.preventDefault();
            setExpanded(e.key === 'ArrowRight');
          }
        }}
      >
        {hasChildren && (
          <span
            className="tag-tree-arrow"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            aria-hidden="true"
          >
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
        )}
        {!hasChildren && <span className="tag-tree-arrow spacer" aria-hidden="true" />}
        <span className="tag-tree-name">{node.name}</span>
        {node.count > 0 && <span className="tag-tree-count">{node.count}</span>}
      </div>
      {hasChildren && expanded && (
        <div className="tag-tree-children" role="group">
          {node.children.map((child) => (
            <TagTreeNode
              key={child.fullPath}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              activeTags={activeTags}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

const App: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [currentFile, setCurrentFile] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | undefined>();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [movedFiles, setMovedFiles] = useState<BookmarkData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Scope toggle state
  const [scope, setScope] = useState<'file' | 'all'>('file');

  // Playback status state
  const [duration, setDuration] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);

  // Tag tree expanded state
  const [showTagTree, setShowTagTree] = useState(false);

  const appWindow = window as unknown as AppWindow;
  const { toasts, showToast, showSuccess, showError, showInfo, dismissToast } = useToast();

  const { filteredBookmarks, availableTags } = useAdvancedBookmarkFilters({
    bookmarks,
    filters,
    parsedQuery,
  });

  const { recentSearches, addRecentSearch } = useFilterHistory();

  // Compute current file bookmarks for the timeline
  const currentFileBookmarks = useMemo(
    () => (currentFile ? bookmarks.filter((b) => b.filepath === currentFile) : []),
    [bookmarks, currentFile],
  );

  // Compute counts for scope toggle
  const currentFileCount = currentFileBookmarks.length;
  const allFilesCount = bookmarks.length;

  // Extract filename from filepath
  const extractFileName = useCallback((filepath: string) => {
    const parts = filepath.split('/');
    return parts[parts.length - 1] || filepath;
  }, []);

  // Build tag tree from all tags on visible bookmarks
  const allBookmarkTags = useMemo(
    () => filteredBookmarks.flatMap((b) => b.tags || []),
    [filteredBookmarks],
  );
  const tagTree = useMemo(() => buildTagTree(allBookmarkTags), [allBookmarkTags]);

  // Stable refs for values used inside the message handler
  const showSuccessRef = useRef(showSuccess);
  showSuccessRef.current = showSuccess;
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const showInfoRef = useRef(showInfo);
  showInfoRef.current = showInfo;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const deletedSnapshotRef = useRef<BookmarkData | null>(null);

  useIinaMessages(
    {
      BOOKMARKS_UPDATED: (data: BookmarkData[]) => {
        if (Array.isArray(data)) {
          setBookmarks(data);
        }
      },
      CURRENT_FILE_PATH: (data: string) => {
        setCurrentFile(data);
        // When in "file" scope, update the file filter
        setFilters((prev) => {
          if (scope === 'file' || !prev.fileFilter) {
            return { ...prev, fileFilter: data };
          }
          return prev;
        });
      },
      PLAYBACK_STATUS: (data: PlaybackStatus) => {
        setDuration(data.duration);
        setCurrentPosition(data.position);
        setChapters(data.chapters);
      },
      BOOKMARK_ADDED: () => {
        showSuccessRef.current('Bookmark Added', 'New bookmark created successfully');
      },
      BOOKMARK_DELETED: () => {
        const snapshot = deletedSnapshotRef.current;
        deletedSnapshotRef.current = null;
        if (snapshot) {
          showToastRef.current({
            type: 'success',
            title: 'Bookmark Deleted',
            message: 'Bookmark removed successfully',
            duration: 6000,
            action: {
              label: 'Undo',
              onClick: () => {
                appWindow.iina?.postMessage?.('ADD_BOOKMARK', {
                  title: snapshot.title,
                  description: snapshot.description,
                  tags: snapshot.tags,
                  timestamp: snapshot.timestamp,
                  ...(snapshot.color ? { color: snapshot.color } : {}),
                  ...(snapshot.endTimestamp !== undefined
                    ? { endTimestamp: snapshot.endTimestamp }
                    : {}),
                });
              },
            },
          });
        } else {
          showSuccessRef.current('Bookmark Deleted', 'Bookmark removed successfully');
        }
      },
      BOOKMARK_JUMPED: () => {
        showInfoRef.current('Jumped to Bookmark', 'Playback position updated');
      },
      EXPORT_RESULT: (data: any) => {
        setIsLoading(false);
        showSuccessRef.current(
          'Export Complete',
          `Bookmarks exported as ${data?.format || 'file'}`,
        );
        window.postMessage({ type: 'EXPORT_RESULT', data }, window.location.origin);
      },
      IMPORT_RESULT: (data: any) => {
        setIsLoading(false);
        if (data?.success) {
          showSuccessRef.current(
            'Import Complete',
            `Successfully imported ${data.importedCount} bookmarks`,
          );
          if (data.skippedCount > 0) {
            showInfoRef.current(
              'Import Info',
              `${data.skippedCount} bookmarks were skipped as duplicates`,
            );
          }
        } else {
          showErrorRef.current('Import Failed', data?.errors?.[0] || 'Failed to import bookmarks');
        }
        window.postMessage({ type: 'IMPORT_RESULT', data }, window.location.origin);
      },
      IMPORT_STARTED: () => {
        setIsLoading(true);
        setLoadingMessage('Importing bookmarks...');
      },
      SHOW_FILE_RECONCILIATION_DIALOG: (data: any) => {
        if (data?.movedFiles) {
          setMovedFiles(data.movedFiles);
          setShowReconciliationDialog(true);
        }
      },
      ERROR: (data: any) => {
        showErrorRef.current('Error', data?.message || 'An unexpected error occurred');
      },
      FILE_RECONCILIATION_RESULT: (data: any) => {
        window.postMessage({ type: 'FILE_RECONCILIATION_RESULT', data }, window.location.origin);
      },
      BOOKMARK_DEFAULTS: (data: any) => {
        window.postMessage({ type: 'BOOKMARK_DEFAULTS', data }, window.location.origin);
      },
      QUICK_BOOKMARK_CREATED: (data: any) => {
        if (data?.bookmarkId) {
          showSuccessRef.current(
            'Quick Bookmark',
            `Bookmarked at ${data.timestamp !== undefined ? formatTime(data.timestamp) : 'current position'}`,
          );
        }
      },
    },
    'sidebar',
  );

  useEscapeKey(!!pendingDeleteId, () => setPendingDeleteId(null));

  // ---------------------------------------------------------------------------
  // Scope toggle handler
  // ---------------------------------------------------------------------------

  const handleScopeChange = useCallback(
    (newScope: 'file' | 'all') => {
      setScope(newScope);
      if (newScope === 'file' && currentFile) {
        setFilters((prev) => ({ ...prev, fileFilter: currentFile }));
      } else if (newScope === 'all') {
        setFilters((prev) => ({ ...prev, fileFilter: '' }));
      }
    },
    [currentFile],
  );

  // ---------------------------------------------------------------------------
  // Tag filter handlers
  // ---------------------------------------------------------------------------

  const handleTagFilterAdd = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: [...new Set([...prev.tags, tag])],
    }));
  }, []);

  const handleTagFilterRemove = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  const handleClearAllTagFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, tags: [] }));
  }, []);

  // Handle tag tree selection — prefix match: selecting "project" also matches "project/research"
  const handleTagTreeSelect = useCallback(
    (fullPath: string) => {
      // Toggle: if already in filters, remove; otherwise add
      if (filters.tags.includes(fullPath)) {
        handleTagFilterRemove(fullPath);
      } else {
        handleTagFilterAdd(fullPath);
      }
    },
    [filters.tags, handleTagFilterAdd, handleTagFilterRemove],
  );

  const handleAddBookmark = () => {
    setShowAddDialog(true);
  };

  const handleSaveBookmark = (
    title: string,
    description: string,
    tags: string[],
    timestamp: number,
    color?: string,
    endTimestamp?: number,
  ) => {
    appWindow.iina?.postMessage?.('ADD_BOOKMARK', {
      title,
      description,
      tags,
      timestamp,
      ...(color ? { color } : {}),
      ...(endTimestamp !== undefined ? { endTimestamp } : {}),
    });
  };

  const postMessage = (type: string, data?: any) => {
    appWindow.iina?.postMessage?.(type, data);
  };

  const handleDeleteBookmark = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deletedSnapshotRef.current = bookmarks.find((b) => b.id === pendingDeleteId) ?? null;
      appWindow.iina?.postMessage?.('DELETE_BOOKMARK', { id: pendingDeleteId });
      setPendingDeleteId(null);
    }
  };

  const handleJumpToBookmark = (id: string) => {
    appWindow.iina?.postMessage?.('JUMP_TO_BOOKMARK', { id });
  };

  const handleAdvancedSearchChange = useCallback(
    (searchTerm: string, parsedQuery: ParsedSearchQuery) => {
      setParsedQuery(parsedQuery);
      setFilters((prev) => ({ ...prev, searchTerm }));
      if (searchTerm.trim()) {
        addRecentSearch(searchTerm);
      }
    },
    [addRecentSearch],
  );

  return (
    <div className="bookmark-sidebar">
      {isLoading && <Loading message={loadingMessage} overlay={true} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="sidebar-header">
        <h2 id="bookmarks-heading">Bookmarks</h2>
        <div className="sidebar-actions" role="group" aria-labelledby="bookmarks-heading">
          <button
            onClick={handleAddBookmark}
            className="add-bookmark-btn"
            aria-label="Add new bookmark at current time"
            title="Add new bookmark at current time"
          >
            Add Bookmark
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="import-btn"
            aria-label="Import bookmarks from file"
            title="Import bookmarks from file"
          >
            Import
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            className="export-btn"
            aria-label="Export bookmarks to file"
            title="Export bookmarks to file"
          >
            Export
          </button>
          <button
            onClick={() => {
              appWindow.iina?.postMessage?.('RECONCILE_FILES');
            }}
            className="reconcile-btn"
            aria-label="Check for moved files"
            title="Check for moved files and reconcile bookmarks"
          >
            Check Files
          </button>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="scope-toggle" role="radiogroup" aria-label="Bookmark scope">
        <button
          className={`scope-toggle-btn ${scope === 'file' ? 'active' : ''}`}
          role="radio"
          aria-checked={scope === 'file'}
          onClick={() => handleScopeChange('file')}
        >
          This File ({currentFileCount})
        </button>
        <button
          className={`scope-toggle-btn ${scope === 'all' ? 'active' : ''}`}
          role="radio"
          aria-checked={scope === 'all'}
          onClick={() => handleScopeChange('all')}
        >
          All Files ({allFilesCount})
        </button>
      </div>

      <div id="search-content" role="region" aria-label="Search and filter controls">
        <AdvancedSearch
          onSearchChange={handleAdvancedSearchChange}
          availableTags={availableTags}
          recentSearches={recentSearches}
          placeholder="Search... (try: tag:work)"
          className="compact"
        />
      </div>

      {/* Sidebar timeline */}
      {duration > 0 && (
        <div className="sidebar-timeline">
          <BookmarkTimeline
            bookmarks={currentFileBookmarks}
            duration={duration}
            currentPosition={currentPosition}
            chapters={chapters}
            onBookmarkClick={handleJumpToBookmark}
            compact
            showChapterLanes
          />
        </div>
      )}

      {/* Tag hierarchy tree */}
      {tagTree.length > 0 && (
        <div className="tag-tree-container">
          <button
            className="tag-tree-toggle"
            onClick={() => setShowTagTree(!showTagTree)}
            aria-expanded={showTagTree}
            aria-label={showTagTree ? 'Hide tag tree' : 'Show tag tree'}
          >
            <span className="tag-tree-toggle-arrow" aria-hidden="true">
              {showTagTree ? '\u25BC' : '\u25B6'}
            </span>
            Tags
          </button>
          {showTagTree && (
            <div className="tag-tree" role="tree" aria-label="Tag hierarchy">
              {tagTree.map((node) => (
                <TagTreeNode
                  key={node.fullPath}
                  node={node}
                  level={0}
                  onSelect={handleTagTreeSelect}
                  activeTags={filters.tags}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {filters.tags.length > 0 && (
        <div className="active-tag-filters" role="region" aria-label="Active tag filters">
          {filters.tags.map((tag) => (
            <span key={tag} className="filter-chip">
              <span className="filter-chip-label">{tag}</span>
              <button
                className="filter-chip-remove"
                onClick={() => handleTagFilterRemove(tag)}
                aria-label={`Remove filter: ${tag}`}
                title={`Remove filter: ${tag}`}
              >
                &times;
              </button>
            </span>
          ))}
          {filters.tags.length > 1 && (
            <button className="clear-all-filters" onClick={handleClearAllTagFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      <ul
        className="bookmark-list"
        role="list"
        aria-label={scope === 'file' ? 'Bookmarks for current file' : 'All bookmarks'}
      >
        {filteredBookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="bookmark-item"
            role="listitem"
            tabIndex={0}
            onClick={() => handleJumpToBookmark(bookmark.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleJumpToBookmark(bookmark.id);
              }
            }}
            aria-label={`Jump to bookmark: ${bookmark.title} at ${formatTime(bookmark.timestamp)}`}
          >
            <div className="bookmark-header">
              <div
                className="bookmark-time"
                aria-label={`Timestamp: ${formatTime(bookmark.timestamp)}`}
              >
                {formatTime(bookmark.timestamp)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteBookmark(bookmark.id);
                  }
                }}
                className="delete-btn"
                aria-label={`Delete bookmark: ${bookmark.title}`}
                title={`Delete bookmark: ${bookmark.title}`}
              >
                &times;
              </button>
            </div>
            <h4 className="bookmark-title">
              <TextHighlighter
                text={bookmark.title}
                searchTerms={filters.searchTerm}
                caseSensitive={false}
              />
            </h4>
            {/* File badge in all-files mode */}
            {scope === 'all' && (
              <div className="file-badge">
                {bookmark.filepath === currentFile && (
                  <span
                    className="now-playing-indicator"
                    aria-label="Now playing"
                    title="Currently playing"
                  >
                    &#9654;
                  </span>
                )}
                <span className="file-badge-name" title={bookmark.filepath}>
                  {extractFileName(bookmark.filepath)}
                </span>
              </div>
            )}
            <p className="bookmark-description">
              <TextHighlighter
                text={bookmark.description || ''}
                searchTerms={filters.searchTerm}
                caseSensitive={false}
              />
            </p>
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="bookmark-tags" role="group" aria-label="Tags">
                {bookmark.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bookmark-tag clickable"
                    aria-label={`Tag: ${tag}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagFilterAdd(tag);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTagFilterAdd(tag);
                      }
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="bookmark-meta">
              <span
                className="created-date"
                aria-label={`Created: ${formatDate(bookmark.createdAt)}`}
                title={formatDate(bookmark.createdAt)}
              >
                {formatRelativeTime(bookmark.createdAt)}
              </span>
            </div>
          </li>
        ))}
        {filteredBookmarks.length === 0 && (
          <p className="empty-state">
            {bookmarks.length === 0
              ? 'No bookmarks yet -- click Add Bookmark to get started.'
              : 'No bookmarks match your current filters.'}
          </p>
        )}
      </ul>

      <AddBookmarkDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleSaveBookmark}
        availableTags={availableTags}
        postMessage={postMessage}
      />

      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        postMessage={postMessage}
      />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        availableTags={availableTags}
        postMessage={postMessage}
      />

      <FileReconciliationDialog
        isOpen={showReconciliationDialog}
        onClose={() => setShowReconciliationDialog(false)}
        postMessage={postMessage}
        movedFiles={movedFiles}
      />

      {pendingDeleteId && (
        <div
          className="confirm-dialog-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="confirm-dialog">
            <p>
              Delete &ldquo;
              {bookmarks.find((b) => b.id === pendingDeleteId)?.title ?? 'this bookmark'}
              &rdquo;?
            </p>
            <div className="confirm-dialog-actions">
              <button className="confirm-btn" onClick={confirmDelete}>
                Confirm
              </button>
              <button className="cancel-btn" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
