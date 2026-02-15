import React, { useState, useCallback } from 'react';
import { formatTime } from '../utils/formatTime';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useWindowMessage } from '../hooks/useWindowMessage';

interface FileReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  postMessage: (type: string, data?: any) => void;
  movedFiles: MovedFile[];
}

interface MovedFile {
  id: string;
  title: string;
  filepath: string;
  timestamp: number;
  createdAt: string;
}

interface SimilarFile {
  path: string;
  name: string;
  similarity: number;
}

const FileReconciliationDialog: React.FC<FileReconciliationDialogProps> = ({
  isOpen,
  onClose,
  postMessage,
  movedFiles,
}) => {
  const [selectedFile, setSelectedFile] = useState<MovedFile | null>(null);
  const [newPath, setNewPath] = useState('');
  const [similarFiles, setSimilarFiles] = useState<SimilarFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvedFiles, setResolvedFiles] = useState<string[]>([]);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [confirmingRemoveAll, setConfirmingRemoveAll] = useState(false);

  useEscapeKey(isOpen, onClose);

  const handleReconciliationResult = useCallback((data: any) => {
    const { success, action, bookmarkId, similarFiles: foundFiles } = data;

    if (success) {
      if (action === 'search_similar' && foundFiles) {
        setSimilarFiles(
          foundFiles.map((path: string) => ({
            path,
            name: path.split('/').pop() || path,
            similarity: 0,
          })),
        );
        setIsSearching(false);
      } else if (action === 'update_path') {
        setResolvedFiles((prev) => [...prev, bookmarkId]);
        setSelectedFile(null);
        setNewPath('');
        setSimilarFiles([]);
      }
    }
  }, []);

  useWindowMessage('FILE_RECONCILIATION_RESULT', handleReconciliationResult, isOpen);

  const handleSearchSimilar = (file: MovedFile) => {
    setSelectedFile(file);
    setIsSearching(true);
    setSimilarFiles([]);

    postMessage('FILE_RECONCILIATION_REQUEST', {
      action: 'search_similar',
      bookmarkId: file.id,
      originalPath: file.filepath,
    });
  };

  const handleUpdatePath = (bookmarkId: string, newPath: string) => {
    postMessage('FILE_RECONCILIATION_REQUEST', {
      action: 'update_path',
      bookmarkId,
      newPath,
    });
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    postMessage('FILE_RECONCILIATION_REQUEST', {
      action: 'remove_bookmark',
      bookmarkId,
    });
    setResolvedFiles((prev) => [...prev, bookmarkId]);
    setConfirmingRemoveId(null);
  };

  const handleRemoveAll = (files: MovedFile[]) => {
    files.forEach((file) => {
      postMessage('FILE_RECONCILIATION_REQUEST', {
        action: 'remove_bookmark',
        bookmarkId: file.id,
      });
    });
    setResolvedFiles((prev) => [...prev, ...files.map((f) => f.id)]);
    setConfirmingRemoveAll(false);
  };

  const handleManualPath = () => {
    if (selectedFile && newPath.trim()) {
      handleUpdatePath(selectedFile.id, newPath.trim());
    }
  };

  const getDirectoryPath = (path: string) => {
    const parts = path.split('/');
    return parts.slice(0, -1).join('/');
  };

  const unresolvedFiles = movedFiles.filter((file) => !resolvedFiles.includes(file.id));

  if (!isOpen) return null;

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      onKeyDown={handleDialogKeyDown}
    >
      <div className="dialog-content file-reconciliation-dialog">
        <div className="dialog-header">
          <h3>File Reconciliation</h3>
          <button className="close-button" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <div className="dialog-body">
          {unresolvedFiles.length === 0 ? (
            <div className="no-issues">
              <h4>All Files Resolved</h4>
              <p>All bookmarks are pointing to accessible files.</p>
            </div>
          ) : (
            <>
              <div className="info-section">
                <p>
                  Found {unresolvedFiles.length} bookmarks pointing to files that may have been
                  moved or renamed.
                </p>
              </div>

              <div className="moved-files-list">
                {unresolvedFiles.map((file) => (
                  <div key={file.id} className="moved-file-item">
                    <div className="file-info">
                      <h4 className="file-title">{file.title}</h4>
                      <p className="file-path">
                        <span className="label">Original path:</span>
                        <code>{file.filepath}</code>
                      </p>
                      <p className="file-meta">
                        <span className="timestamp">{formatTime(file.timestamp)}</span>
                        <span className="created">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </span>
                      </p>
                    </div>

                    <div className="file-actions">
                      <button
                        className="button-small button-primary"
                        onClick={() => handleSearchSimilar(file)}
                        disabled={isSearching}
                      >
                        Find Similar
                      </button>
                      <button
                        className="button-small button-secondary"
                        onClick={() => {
                          setSelectedFile(file);
                          setNewPath('');
                          setSimilarFiles([]);
                        }}
                      >
                        Update Path
                      </button>
                      {confirmingRemoveId === file.id ? (
                        <>
                          <span style={{ fontSize: '12px', color: 'var(--danger-color)' }}>
                            Are you sure?
                          </span>
                          <button
                            className="button-small button-danger"
                            onClick={() => handleRemoveBookmark(file.id)}
                          >
                            Yes, Remove
                          </button>
                          <button
                            className="button-small button-secondary"
                            onClick={() => setConfirmingRemoveId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="button-small button-danger"
                          onClick={() => setConfirmingRemoveId(file.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {selectedFile?.id === file.id && (
                      <div className="file-resolution-panel">
                        {isSearching ? (
                          <div className="searching">
                            <p>Searching for similar files...</p>
                          </div>
                        ) : similarFiles.length > 0 ? (
                          <div className="similar-files">
                            <h5>Similar Files Found:</h5>
                            <div className="similar-files-list">
                              {similarFiles.map((similar, index) => (
                                <div key={index} className="similar-file">
                                  <div className="similar-file-info">
                                    <span className="file-name">{similar.name}</span>
                                    <span className="file-path">
                                      {getDirectoryPath(similar.path)}
                                    </span>
                                    <span className="similarity-score">
                                      {Math.round(similar.similarity * 100)}% match
                                    </span>
                                  </div>
                                  <button
                                    className="button-small button-primary"
                                    onClick={() => handleUpdatePath(file.id, similar.path)}
                                  >
                                    Use This File
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="no-similar-files">
                            <p>No similar files found automatically.</p>
                          </div>
                        )}

                        <div className="manual-path-input">
                          <h5>Or specify new path manually:</h5>
                          <div className="path-input-group">
                            <input
                              type="text"
                              value={newPath}
                              onChange={(e) => setNewPath(e.target.value)}
                              placeholder="Enter the new file path..."
                              className="path-input"
                            />
                            <button
                              className="button-small button-primary"
                              onClick={handleManualPath}
                              disabled={!newPath.trim()}
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="button-secondary" onClick={onClose}>
            {unresolvedFiles.length === 0 ? 'Close' : 'Done for Now'}
          </button>
          {unresolvedFiles.length > 0 && (
            <>
              {confirmingRemoveAll ? (
                <>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--danger-color)',
                      alignSelf: 'center',
                    }}
                  >
                    Remove all {unresolvedFiles.length} bookmarks?
                  </span>
                  <button
                    className="button-danger"
                    onClick={() => handleRemoveAll(unresolvedFiles)}
                  >
                    Yes, Remove All
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => setConfirmingRemoveAll(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button className="button-danger" onClick={() => setConfirmingRemoveAll(true)}>
                  Remove All Missing
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileReconciliationDialog;
