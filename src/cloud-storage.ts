// Cloud Storage Service for IINA Bookmarks Plugin
// Provides abstraction layer for different cloud storage providers

interface CloudStorageProvider {
  id: string;
  name: string;
  authenticate(credentials: any): Promise<boolean>;
  upload(data: any, filename: string): Promise<string>;
  download(filename: string): Promise<any>;
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

// Google Drive Provider Implementation
class GoogleDriveProvider implements CloudStorageProvider {
  id = 'gdrive';
  name = 'Google Drive';
  private accessToken: string | null = null;
  private readonly API_BASE = 'https://www.googleapis.com/drive/v3';
  private readonly UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    try {
      if (credentials.accessToken) {
        this.accessToken = credentials.accessToken;
        
        // Verify token by making a simple API call
        const response = await fetch(`${this.API_BASE}/about?fields=user`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.ok;
      }
      
      // If no access token, we need to implement OAuth flow
      // For now, return false to indicate authentication is needed
      console.warn('Google Drive authentication requires proper OAuth setup');
      return false;
      
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      return false;
    }
  }

  async upload(data: BookmarkBackup, filename: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      // First, create the file metadata
      const metadata = {
        name: filename,
        parents: await this.getOrCreateAppFolder()
      };

      // Create the file
      const createResponse = await fetch(`${this.API_BASE}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create file: ${createResponse.statusText}`);
      }

      const fileInfo = await createResponse.json();

      // Upload the content
      const uploadResponse = await fetch(`${this.UPLOAD_BASE}/files/${fileInfo.id}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload content: ${uploadResponse.statusText}`);
      }

      return fileInfo.id;
      
    } catch (error) {
      console.error('Google Drive upload failed:', error);
      throw error;
    }
  }

  async download(filename: string): Promise<BookmarkBackup> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      // Find the file
      const searchResponse = await fetch(`${this.API_BASE}/files?q=name='${filename}' and trashed=false`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for file: ${searchResponse.statusText}`);
      }

      const searchResult = await searchResponse.json();
      
      if (!searchResult.files || searchResult.files.length === 0) {
        throw new Error(`File not found: ${filename}`);
      }

      const fileId = searchResult.files[0].id;

      // Download the file content
      const downloadResponse = await fetch(`${this.API_BASE}/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
      }

      return await downloadResponse.json();
      
    } catch (error) {
      console.error('Google Drive download failed:', error);
      throw error;
    }
  }

  async list(): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const appFolder = await this.getOrCreateAppFolder();
      const response = await fetch(`${this.API_BASE}/files?q='${appFolder[0]}' in parents and trashed=false`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const result = await response.json();
      return result.files?.map((file: any) => file.name) || [];
      
    } catch (error) {
      console.error('Google Drive list failed:', error);
      throw error;
    }
  }

  async delete(filename: string): Promise<boolean> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      // Find the file first
      const searchResponse = await fetch(`${this.API_BASE}/files?q=name='${filename}' and trashed=false`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        return false;
      }

      const searchResult = await searchResponse.json();
      
      if (!searchResult.files || searchResult.files.length === 0) {
        return false;
      }

      const fileId = searchResult.files[0].id;

      // Delete the file
      const deleteResponse = await fetch(`${this.API_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      return deleteResponse.ok;
      
    } catch (error) {
      console.error('Google Drive delete failed:', error);
      return false;
    }
  }

  private async getOrCreateAppFolder(): Promise<string[]> {
    try {
      // Look for existing app folder
      const searchResponse = await fetch(`${this.API_BASE}/files?q=name='IINA Bookmarks' and mimeType='application/vnd.google-apps.folder' and trashed=false`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (searchResponse.ok) {
        const result = await searchResponse.json();
        if (result.files && result.files.length > 0) {
          return [result.files[0].id];
        }
      }

      // Create app folder if it doesn't exist
      const createResponse = await fetch(`${this.API_BASE}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'IINA Bookmarks',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (createResponse.ok) {
        const folder = await createResponse.json();
        return [folder.id];
      }

      throw new Error('Failed to create app folder');
    } catch (error) {
      console.error('Failed to get/create app folder:', error);
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

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    try {
      if (credentials.accessToken) {
        this.accessToken = credentials.accessToken;
        
        // Verify token
        const response = await fetch(`${this.API_BASE}/users/get_current_account`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.ok;
      }
      
      return false;
      
    } catch (error) {
      console.error('Dropbox authentication failed:', error);
      return false;
    }
  }

  async upload(data: BookmarkBackup, filename: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const path = `/IINA Bookmarks/${filename}`;
      
      const response = await fetch(`${this.CONTENT_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: path,
            mode: 'overwrite',
            autorename: false
          }),
          'Content-Type': 'application/octet-stream'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
      
    } catch (error) {
      console.error('Dropbox upload failed:', error);
      throw error;
    }
  }

  async download(filename: string): Promise<BookmarkBackup> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const path = `/IINA Bookmarks/${filename}`;
      
      const response = await fetch(`${this.CONTENT_BASE}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: path })
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const text = await response.text();
      return JSON.parse(text);
      
    } catch (error) {
      console.error('Dropbox download failed:', error);
      throw error;
    }
  }

  async list(): Promise<string[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const response = await fetch(`${this.API_BASE}/files/list_folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: '/IINA Bookmarks',
          recursive: false
        })
      });

      if (!response.ok) {
        // Folder might not exist
        return [];
      }

      const result = await response.json();
      return result.entries
        ?.filter((entry: any) => entry['.tag'] === 'file')
        ?.map((entry: any) => entry.name) || [];
      
    } catch (error) {
      console.error('Dropbox list failed:', error);
      return [];
    }
  }

  async delete(filename: string): Promise<boolean> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    try {
      const path = `/IINA Bookmarks/${filename}`;
      
      const response = await fetch(`${this.API_BASE}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: path })
      });

      return response.ok;
      
    } catch (error) {
      console.error('Dropbox delete failed:', error);
      return false;
    }
  }
}

// Cloud Storage Manager
export class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();
  private currentProvider: CloudStorageProvider | null = null;

  constructor() {
    // Register available providers
    this.providers.set('gdrive', new GoogleDriveProvider());
    this.providers.set('dropbox', new DropboxProvider());
  }

  getAvailableProviders(): Array<{ id: string; name: string; }> {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name
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
        device: navigator.platform || 'Unknown',
        userAgent: navigator.userAgent
      }
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
    merged: any[], 
    added: number, 
    updated: number, 
    conflicts: any[] 
  }> {
    try {
      const backups = await this.listBackups();
      if (backups.length === 0) {
        // No cloud backups, upload current bookmarks
        await this.uploadBookmarks(localBookmarks);
        return {
          merged: localBookmarks,
          added: 0,
          updated: 0,
          conflicts: []
        };
      }

      // Download most recent backup
      const latestBackup = backups.sort().reverse()[0];
      const cloudBackup = await this.downloadBookmarks(latestBackup);
      const cloudBookmarks = cloudBackup.bookmarks;

      // Merge bookmarks
      const merged = new Map<string, any>();
      const conflicts: any[] = [];
      let added = 0;
      let updated = 0;

      // Add local bookmarks
      localBookmarks.forEach(bookmark => {
        merged.set(bookmark.id, { ...bookmark, source: 'local' });
      });

      // Merge cloud bookmarks
      cloudBookmarks.forEach(cloudBookmark => {
        const localBookmark = merged.get(cloudBookmark.id);
        
        if (!localBookmark) {
          // New bookmark from cloud
          merged.set(cloudBookmark.id, { ...cloudBookmark, source: 'cloud' });
          added++;
        } else {
          // Check for conflicts
          const localTime = new Date(localBookmark.createdAt).getTime();
          const cloudTime = new Date(cloudBookmark.createdAt).getTime();
          
          if (localTime !== cloudTime) {
            if (cloudTime > localTime) {
              // Cloud version is newer
              merged.set(cloudBookmark.id, { ...cloudBookmark, source: 'cloud' });
              updated++;
            }
            // Otherwise keep local version (it's newer)
          }
        }
      });

      const mergedBookmarks = Array.from(merged.values());
      
      // Upload merged result
      await this.uploadBookmarks(mergedBookmarks);

      return {
        merged: mergedBookmarks,
        added,
        updated,
        conflicts
      };
      
    } catch (error) {
      console.error('Cloud sync failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const cloudStorageManager = new CloudStorageManager();