import React, { useState, useEffect, useRef, useCallback } from 'react';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useWindowMessage } from '../hooks/useWindowMessage';
import { BookmarkData } from '../types';

interface CloudSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  postMessage: (type: string, data?: any) => void;
  bookmarkCount: number;
  onBookmarksReceived?: (bookmarks: BookmarkData[]) => void;
}

interface CloudProvider {
  id: string;
  name: string;
  icon: string;
  supported: boolean;
}

const CloudSyncDialog: React.FC<CloudSyncDialogProps> = ({
  isOpen,
  onClose,
  postMessage,
  bookmarkCount,
  onBookmarksReceived,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('gdrive');
  const [syncAction, setSyncAction] = useState<'upload' | 'download' | 'sync'>('sync');
  const [isLoading, setIsLoading] = useState(false);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const clientIdRef = useRef<HTMLInputElement>(null);
  const clientSecretRef = useRef<HTMLInputElement>(null);
  const onBookmarksReceivedRef = useRef(onBookmarksReceived);
  onBookmarksReceivedRef.current = onBookmarksReceived;
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cloudProviders: CloudProvider[] = [
    { id: 'gdrive', name: 'Google Drive', icon: '\uD83D\uDCC1', supported: true },
    { id: 'dropbox', name: 'Dropbox', icon: '\uD83D\uDCE6', supported: true },
    { id: 'onedrive', name: 'OneDrive', icon: '\u2601', supported: false },
    { id: 'icloud', name: 'iCloud', icon: '\u2601', supported: false },
  ];

  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) setStatusMessage(null);
  }, [isOpen]);

  const handleCloudSyncResult = useCallback((data: any) => {
    setIsLoading(false);
    const { success, action, message, error, bookmarks } = data;
    const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);

    if (success) {
      setStatusMessage({
        type: 'success',
        text: `${actionLabel} successful: ${message}`,
      });
      if (
        (action === 'download' || action === 'sync') &&
        bookmarks &&
        onBookmarksReceivedRef.current
      ) {
        onBookmarksReceivedRef.current(bookmarks);
      }
    } else {
      setStatusMessage({
        type: 'error',
        text: `${actionLabel} failed: ${error}`,
      });
    }
  }, []);

  useWindowMessage('CLOUD_SYNC_RESULT', handleCloudSyncResult, isOpen);

  const handleSync = () => {
    if (!selectedProvider) return;

    const provider = cloudProviders.find((p) => p.id === selectedProvider);
    if (!provider?.supported) {
      setStatusMessage({
        type: 'error',
        text: `${provider?.name || selectedProvider} is not yet supported`,
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    postMessage('CLOUD_SYNC_REQUEST', {
      action: syncAction,
      provider: selectedProvider,
      credentials: {
        apiKey: apiKeyRef.current?.value || '',
        clientId: clientIdRef.current?.value || '',
        clientSecret: clientSecretRef.current?.value || '',
      },
    });

    // Clear credential inputs after sending
    if (apiKeyRef.current) apiKeyRef.current.value = '';
    if (clientIdRef.current) clientIdRef.current.value = '';
    if (clientSecretRef.current) clientSecretRef.current.value = '';
  };

  const getActionDescription = () => {
    switch (syncAction) {
      case 'upload':
        return `Upload ${bookmarkCount} bookmarks to cloud storage`;
      case 'download':
        return 'Download bookmarks from cloud storage (will not replace existing)';
      case 'sync':
        return 'Synchronize bookmarks (merge local and cloud bookmarks)';
      default:
        return '';
    }
  };

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
      <div className="dialog-content cloud-sync-dialog">
        <div className="dialog-header">
          <h3>Cloud Backup &amp; Sync</h3>
          <button className="close-button" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <div className="dialog-body">
          {statusMessage && (
            <div
              className={`info-section ${statusMessage.type === 'success' ? '' : ''}`}
              role="alert"
              style={{
                borderColor:
                  statusMessage.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
                background:
                  statusMessage.type === 'success'
                    ? 'rgba(30, 126, 52, 0.1)'
                    : 'rgba(220, 53, 69, 0.1)',
              }}
            >
              <p>
                {statusMessage.type === 'success' ? 'Success: ' : 'Error: '}
                {statusMessage.text}
              </p>
            </div>
          )}

          <div className="sync-section">
            <h4>Choose Cloud Provider</h4>
            <div className="provider-grid">
              {cloudProviders.map((provider) => (
                <button
                  key={provider.id}
                  className={`provider-button ${selectedProvider === provider.id ? 'selected' : ''} ${!provider.supported ? 'disabled' : ''}`}
                  onClick={() => provider.supported && setSelectedProvider(provider.id)}
                  disabled={!provider.supported}
                >
                  <span className="provider-icon">{provider.icon}</span>
                  <span className="provider-name">{provider.name}</span>
                  {!provider.supported && <span className="coming-soon">Soon</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="sync-section">
            <h4>Sync Action</h4>
            <div className="action-buttons">
              <label className="action-option">
                <input
                  type="radio"
                  name="syncAction"
                  value="upload"
                  checked={syncAction === 'upload'}
                  onChange={(e) => setSyncAction(e.target.value as any)}
                />
                <span>Upload Only</span>
              </label>
              <label className="action-option">
                <input
                  type="radio"
                  name="syncAction"
                  value="download"
                  checked={syncAction === 'download'}
                  onChange={(e) => setSyncAction(e.target.value as any)}
                />
                <span>Download Only</span>
              </label>
              <label className="action-option">
                <input
                  type="radio"
                  name="syncAction"
                  value="sync"
                  checked={syncAction === 'sync'}
                  onChange={(e) => setSyncAction(e.target.value as any)}
                />
                <span>Two-way Sync</span>
              </label>
            </div>
            <p className="action-description">{getActionDescription()}</p>
          </div>

          {selectedProvider === 'gdrive' && (
            <div className="sync-section">
              <h4>Google Drive Configuration</h4>
              <div className="form-group">
                <label>API Key (optional for basic features):</label>
                <input
                  type="password"
                  ref={apiKeyRef}
                  placeholder="Enter Google Drive API key..."
                />
              </div>
              <p className="help-text">
                For full functionality, obtain API credentials from Google Cloud Console
              </p>
            </div>
          )}

          {selectedProvider === 'dropbox' && (
            <div className="sync-section">
              <h4>Dropbox Configuration</h4>
              <div className="form-group">
                <label>Access Token:</label>
                <input
                  type="password"
                  ref={apiKeyRef}
                  placeholder="Enter Dropbox access token..."
                />
              </div>
              <p className="help-text">Generate an access token from Dropbox Developer Console</p>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="button-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="button-primary"
            onClick={handleSync}
            disabled={isLoading || !selectedProvider}
          >
            {isLoading
              ? 'Processing...'
              : `${syncAction.charAt(0).toUpperCase() + syncAction.slice(1)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloudSyncDialog;
