// Cloud Storage Service for IINA Bookmarks Plugin
// Provides abstraction layer for different cloud storage providers
// Uses injected HttpAdapter (backed by iina.http) -- no fetch(), no navigator, no console

import type { HttpAdapter, IINAConsole } from './types';

interface CloudStorageProvider {
  id: string;
  name: string;
  authenticate(credentials: CloudCredentials): Promise<boolean>;
  upload(data: BookmarkBackup, filename: string): Promise<string>;
  download(filename: string): Promise<BookmarkBackup>;
  list(): Promise<string[]>;
  delete(filename: string): Promise<boolean>;
}

interface CloudCredentials {
  apiKey?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

interface BackupMetadata {
  version: string;
  createdAt: string;
  totalBookmarks: number;
  device: string;
  userAgent: string;
}

interface BookmarkBackup {
  bookmarks: any[];
  metadata: BackupMetadata;
}

/** Validate filename against a strict allowlist to prevent query/path injection */
function isValidFilename(name: string): boolean {
  return /^[a-zA-Z0-9_\-.]+$/.test(name);
}

/** Sanitize a Dropbox path component: strip path traversal sequences */
function sanitizeDropboxPathComponent(component: string): string {
  return component
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/[/\\]/g, '');
}

// Google Drive Provider Implementation
class GoogleDriveProvider implements CloudStorageProvider {
  id = 'gdrive';
  name = 'Google Drive';
  private accessToken: string | null = null;
  private readonly API_BASE = 'https://www.googleapis.com/drive/v3';
  private readonly UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
  private http: HttpAdapter;
  private logger: IINAConsole;

  constructor(http: HttpAdapter, logger: IINAConsole) {
    this.http = http;
    this.logger = logger;
  }

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    try {
      if (credentials.accessToken) {
        this.accessToken = credentials.accessToken;

        const response = await this.http.get(`${this.API_BASE}/about?fields=user`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        return response.statusCode >= 200 && response.statusCode < 300;
      }

      this.logger.warn('Google Drive authentication requires proper OAuth setup');
      return false;
    } catch (error) {
      this.logger.error(
        `Google Drive authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async upload(data: BookmarkBackup, filename: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    if (!isValidFilename(filename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }

    try {
      const metadata = {
        name: filename,
        parents: await this.getOrCreateAppFolder(),
      };

      const createResponse = await this.http.post(`${this.API_BASE}/files`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: metadata,
      });

      if (createResponse.statusCode < 200 || createResponse.statusCode >= 300) {
        throw new Error(`Failed to create file: status ${createResponse.statusCode}`);
      }

      const fileInfo = JSON.parse(createResponse.text);

      const uploadResponse = await this.http.patch(
        `${this.UPLOAD_BASE}/files/${fileInfo.id}?uploadType=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          data: data,
        },
      );

      if (uploadResponse.statusCode < 200 || uploadResponse.statusCode >= 300) {
        throw new Error(`Failed to upload content: status ${uploadResponse.statusCode}`);
      }

      return fileInfo.id;
    } catch (error) {
      this.logger.error(
        `Google Drive upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async download(filename: string): Promise<BookmarkBackup> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    if (!isValidFilename(filename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }

    try {
      const safeName = encodeURIComponent(filename);
      const searchResponse = await this.http.get(
        `${this.API_BASE}/files?q=name='${safeName}' and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (searchResponse.statusCode < 200 || searchResponse.statusCode >= 300) {
        throw new Error(`Failed to search for file: status ${searchResponse.statusCode}`);
      }

      const searchResult = JSON.parse(searchResponse.text);

      if (!searchResult.files || searchResult.files.length === 0) {
        throw new Error(`File not found: ${filename}`);
      }

      const fileId = searchResult.files[0].id;

      const downloadResponse = await this.http.get(`${this.API_BASE}/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (downloadResponse.statusCode < 200 || downloadResponse.statusCode >= 300) {
        throw new Error(`Failed to download file: status ${downloadResponse.statusCode}`);
      }

      return JSON.parse(downloadResponse.text);
    } catch (error) {
      this.logger.error(
        `Google Drive download failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async list(): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const appFolder = await this.getOrCreateAppFolder();
      const response = await this.http.get(
        `${this.API_BASE}/files?q='${appFolder[0]}' in parents and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Failed to list files: status ${response.statusCode}`);
      }

      const result = JSON.parse(response.text);
      return result.files?.map((file: any) => file.name) || [];
    } catch (error) {
      this.logger.error(
        `Google Drive list failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async delete(filename: string): Promise<boolean> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    if (!isValidFilename(filename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }

    try {
      const safeName = encodeURIComponent(filename);
      const searchResponse = await this.http.get(
        `${this.API_BASE}/files?q=name='${safeName}' and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (searchResponse.statusCode < 200 || searchResponse.statusCode >= 300) {
        return false;
      }

      const searchResult = JSON.parse(searchResponse.text);

      if (!searchResult.files || searchResult.files.length === 0) {
        return false;
      }

      const fileId = searchResult.files[0].id;

      const deleteResponse = await this.http.delete(`${this.API_BASE}/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return deleteResponse.statusCode >= 200 && deleteResponse.statusCode < 300;
    } catch (error) {
      this.logger.error(
        `Google Drive delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async getOrCreateAppFolder(): Promise<string[]> {
    try {
      // Folder name is a constant, no injection risk
      const searchResponse = await this.http.get(
        `${this.API_BASE}/files?q=name='IINA Bookmarks' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (searchResponse.statusCode >= 200 && searchResponse.statusCode < 300) {
        const result = JSON.parse(searchResponse.text);
        if (result.files && result.files.length > 0) {
          return [result.files[0].id];
        }
      }

      const createResponse = await this.http.post(`${this.API_BASE}/files`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'IINA Bookmarks',
          mimeType: 'application/vnd.google-apps.folder',
        },
      });

      if (createResponse.statusCode >= 200 && createResponse.statusCode < 300) {
        const folder = JSON.parse(createResponse.text);
        return [folder.id];
      }

      throw new Error('Failed to create app folder');
    } catch (error) {
      this.logger.error(
        `Failed to get/create app folder: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

// Dropbox Provider Implementation
class DropboxProvider implements CloudStorageProvider {
  id = 'dropbox';
  name = 'Dropbox';
  private accessToken: string | null = null;
  private readonly API_BASE = 'https://api.dropboxapi.com/2';
  private readonly CONTENT_BASE = 'https://content.dropboxapi.com/2';
  private http: HttpAdapter;
  private logger: IINAConsole;

  constructor(http: HttpAdapter, logger: IINAConsole) {
    this.http = http;
    this.logger = logger;
  }

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    try {
      if (credentials.accessToken) {
        this.accessToken = credentials.accessToken;

        const response = await this.http.post(`${this.API_BASE}/users/get_current_account`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        return response.statusCode >= 200 && response.statusCode < 300;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Dropbox authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async upload(data: BookmarkBackup, filename: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    const safeFilename = sanitizeDropboxPathComponent(filename);
    if (!safeFilename || !isValidFilename(safeFilename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }

    try {
      const path = `/IINA Bookmarks/${safeFilename}`;

      const response = await this.http.post(`${this.CONTENT_BASE}/files/upload`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: path,
            mode: 'overwrite',
            autorename: false,
          }),
          'Content-Type': 'application/octet-stream',
        },
        data: data,
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Upload failed: status ${response.statusCode}`);
      }

      const result = JSON.parse(response.text);
      return result.id;
    } catch (error) {
      this.logger.error(
        `Dropbox upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async download(filename: string): Promise<BookmarkBackup> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    const safeFilename = sanitizeDropboxPathComponent(filename);
    if (!safeFilename || !isValidFilename(safeFilename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }

    try {
      const path = `/IINA Bookmarks/${safeFilename}`;

      const response = await this.http.post(`${this.CONTENT_BASE}/files/download`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: path }),
        },
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Download failed: status ${response.statusCode}`);
      }

      return JSON.parse(response.text);
    } catch (error) {
      this.logger.error(
        `Dropbox download failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async list(): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const response = await this.http.post(`${this.API_BASE}/files/list_folder`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          path: '/IINA Bookmarks',
          recursive: false,
        },
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return [];
      }

      const result = JSON.parse(response.text);
      return (
        result.entries
          ?.filter((entry: any) => entry['.tag'] === 'file')
          ?.map((entry: any) => entry.name) || []
      );
    } catch (error) {
      this.logger.error(
        `Dropbox list failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async delete(filename: string): Promise<boolean> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    const safeFilename = sanitizeDropboxPathComponent(filename);
    if (!safeFilename || !isValidFilename(safeFilename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }

    try {
      const path = `/IINA Bookmarks/${safeFilename}`;

      const response = await this.http.post(`${this.API_BASE}/files/delete_v2`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data: { path: path },
      });

      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (error) {
      this.logger.error(
        `Dropbox delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

// Cloud Storage Manager
export class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();
  private currentProvider: CloudStorageProvider | null = null;
  private logger: IINAConsole;

  constructor(http: HttpAdapter, logger: IINAConsole) {
    this.logger = logger;
    this.providers.set('gdrive', new GoogleDriveProvider(http, logger));
    this.providers.set('dropbox', new DropboxProvider(http, logger));
  }

  getAvailableProviders(): Array<{ id: string; name: string }> {
    return Array.from(this.providers.values()).map((provider) => ({
      id: provider.id,
      name: provider.name,
    }));
  }

  async setProvider(providerId: string, credentials: CloudCredentials): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const authenticated = await provider.authenticate(credentials);
    if (authenticated) {
      this.currentProvider = provider;
      return true;
    }

    return false;
  }

  async uploadBookmarks(bookmarks: any[], filename?: string): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No cloud provider configured');
    }

    const backup: BookmarkBackup = {
      bookmarks,
      metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        totalBookmarks: bookmarks.length,
        device: 'IINA-Plugin',
        userAgent: 'IINA-Plugin/1.0',
      },
    };

    const backupFilename = filename || `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    return await this.currentProvider.upload(backup, backupFilename);
  }

  async downloadBookmarks(filename: string): Promise<BookmarkBackup> {
    if (!this.currentProvider) {
      throw new Error('No cloud provider configured');
    }

    return await this.currentProvider.download(filename);
  }

  async listBackups(): Promise<string[]> {
    if (!this.currentProvider) {
      throw new Error('No cloud provider configured');
    }

    return await this.currentProvider.list();
  }

  async deleteBackup(filename: string): Promise<boolean> {
    if (!this.currentProvider) {
      throw new Error('No cloud provider configured');
    }

    return await this.currentProvider.delete(filename);
  }

  async syncBookmarks(localBookmarks: any[]): Promise<{
    merged: any[];
    added: number;
    updated: number;
    conflicts: any[];
  }> {
    try {
      const backups = await this.listBackups();
      if (backups.length === 0) {
        await this.uploadBookmarks(localBookmarks);
        return {
          merged: localBookmarks,
          added: 0,
          updated: 0,
          conflicts: [],
        };
      }

      const latestBackup = backups.sort().reverse()[0];
      const cloudBackup = await this.downloadBookmarks(latestBackup);
      const cloudBookmarks = cloudBackup.bookmarks;

      const merged = new Map<string, any>();
      const conflicts: any[] = [];
      let added = 0;
      let updated = 0;

      localBookmarks.forEach((bookmark) => {
        merged.set(bookmark.id, { ...bookmark, source: 'local' });
      });

      cloudBookmarks.forEach((cloudBookmark) => {
        const localBookmark = merged.get(cloudBookmark.id);

        if (!localBookmark) {
          merged.set(cloudBookmark.id, { ...cloudBookmark, source: 'cloud' });
          added++;
        } else {
          // Use updatedAt for conflict resolution (falls back to createdAt)
          const localTime = new Date(localBookmark.updatedAt || localBookmark.createdAt).getTime();
          const cloudTime = new Date(cloudBookmark.updatedAt || cloudBookmark.createdAt).getTime();

          if (localTime !== cloudTime) {
            if (cloudTime > localTime) {
              merged.set(cloudBookmark.id, { ...cloudBookmark, source: 'cloud' });
              updated++;
            }
          }
        }
      });

      const mergedBookmarks = Array.from(merged.values());

      await this.uploadBookmarks(mergedBookmarks);

      return {
        merged: mergedBookmarks,
        added,
        updated,
        conflicts,
      };
    } catch (error) {
      this.logger.error(
        `Cloud sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

// Lazy singleton -- do NOT instantiate at module level (no iina.http available yet)
let _instance: CloudStorageManager | null = null;

export function getCloudStorageManager(
  http: HttpAdapter,
  logger: IINAConsole,
): CloudStorageManager {
  if (!_instance) {
    _instance = new CloudStorageManager(http, logger);
  }
  return _instance;
}
