// Cloud Sync Handler
// Handles cloud sync operations (upload, download, merge) with concurrency guard

import {
  errorMessage,
  type BookmarkData,
  type CloudCredentials,
  type IINAConsole,
  type IINAUIAPI,
} from './types';
import type { CloudStorageManager } from './cloud-storage';

export class CloudSyncHandler {
  private isSyncing = false;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly SYNC_TIMEOUT_MS = 60_000; // 60 seconds

  constructor(
    private cloudStorage: CloudStorageManager,
    private console: IINAConsole,
  ) {}

  async handleSync(
    payload: { action: string; provider: string; credentials: CloudCredentials },
    bookmarks: BookmarkData[],
    target: IINAUIAPI,
  ): Promise<BookmarkData[] | null> {
    if (this.isSyncing) {
      target.postMessage('CLOUD_SYNC_RESULT', {
        success: false,
        action: payload.action,
        error: 'A sync operation is already in progress',
      });
      return null;
    }

    this.isSyncing = true;
    this.syncTimeout = setTimeout(() => {
      this.console.warn('Cloud sync timed out after 60s, resetting lock');
      this.isSyncing = false;
      this.syncTimeout = null;
      target.postMessage('CLOUD_SYNC_RESULT', {
        success: false,
        action: payload.action,
        error: 'Cloud sync timed out after 60 seconds',
      });
    }, CloudSyncHandler.SYNC_TIMEOUT_MS);

    try {
      this.console.log(`Handling cloud sync: ${payload.action}`);

      switch (payload.action) {
        case 'upload':
          await this.uploadBookmarks(payload.provider, payload.credentials, bookmarks, target);
          return null;
        case 'download':
          return await this.downloadBookmarks(payload.provider, payload.credentials, target);
        case 'sync':
          return await this.syncBookmarks(payload.provider, payload.credentials, bookmarks, target);
        default:
          this.console.warn(`Unknown cloud sync action: ${payload.action}`);
          return null;
      }
    } catch (error) {
      const msg = errorMessage(error);
      this.console.error(`Error handling cloud sync: ${msg}`);
      target.postMessage('CLOUD_SYNC_RESULT', {
        success: false,
        action: payload.action,
        error: msg,
      });
      return null;
    } finally {
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
      }
      this.isSyncing = false;
    }
  }

  private async uploadBookmarks(
    provider: string,
    credentials: CloudCredentials,
    bookmarks: BookmarkData[],
    target: IINAUIAPI,
  ): Promise<void> {
    this.console.log(`Uploading bookmarks to ${provider}...`);

    const success = await this.cloudStorage.setProvider(provider, credentials);
    if (!success) {
      throw new Error('Failed to authenticate with cloud provider');
    }

    const backupId = await this.cloudStorage.uploadBookmarks(bookmarks);

    target.postMessage('CLOUD_SYNC_RESULT', {
      success: true,
      action: 'upload',
      message: `Successfully uploaded ${bookmarks.length} bookmarks to ${provider}`,
      backupId: backupId,
    });
  }

  private async downloadBookmarks(
    provider: string,
    credentials: CloudCredentials,
    target: IINAUIAPI,
  ): Promise<BookmarkData[] | null> {
    this.console.log(`Downloading bookmarks from ${provider}...`);

    const success = await this.cloudStorage.setProvider(provider, credentials);
    if (!success) {
      throw new Error('Failed to authenticate with cloud provider');
    }

    const backups = await this.cloudStorage.listBackups();
    if (backups.length === 0) {
      throw new Error('No backups found in cloud storage');
    }

    const latestBackup = backups.sort().reverse()[0];
    const backup = await this.cloudStorage.downloadBookmarks(latestBackup);

    target.postMessage('CLOUD_SYNC_RESULT', {
      success: true,
      action: 'download',
      bookmarks: backup.bookmarks,
      message: `Downloaded ${backup.bookmarks.length} bookmarks from ${provider}`,
      metadata: backup.metadata,
    });

    // Download sends bookmarks to UI but doesn't replace local -- return null
    return null;
  }

  private async syncBookmarks(
    provider: string,
    credentials: CloudCredentials,
    bookmarks: BookmarkData[],
    target: IINAUIAPI,
  ): Promise<BookmarkData[]> {
    this.console.log(`Syncing bookmarks with ${provider}...`);

    const success = await this.cloudStorage.setProvider(provider, credentials);
    if (!success) {
      throw new Error('Failed to authenticate with cloud provider');
    }

    const result = await this.cloudStorage.syncBookmarks(bookmarks);

    target.postMessage('CLOUD_SYNC_RESULT', {
      success: true,
      action: 'sync',
      message: `Sync complete: ${result.added} added, ${result.updated} updated`,
      syncStats: {
        added: result.added,
        updated: result.updated,
        conflicts: result.conflicts.length,
        total: result.merged.length,
      },
    });

    return result.merged;
  }
}
