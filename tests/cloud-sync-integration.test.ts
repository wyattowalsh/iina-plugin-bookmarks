import { describe, it, expect, beforeEach, vi } from 'vitest';

// Override the global cloud-storage mock from setup.ts — this file tests the real module.
vi.unmock('../src/cloud-storage');

import { CloudStorageManager, resetCloudStorageManager } from '../src/cloud-storage';
import type { HttpAdapter, IINAConsole } from '../src/types';

function createMockHttp(): HttpAdapter {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockLogger(): IINAConsole {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
}

describe('Cloud Sync Integration', () => {
  let http: HttpAdapter;
  let logger: IINAConsole;
  let manager: CloudStorageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCloudStorageManager();
    http = createMockHttp();
    logger = createMockLogger();
    manager = new CloudStorageManager(http, logger);
  });

  describe('CloudStorageManager initialization', () => {
    it('should throw when no provider is configured', async () => {
      await expect(manager.uploadBookmarks([])).rejects.toThrow('No cloud provider configured');
      await expect(manager.downloadBookmarks('file.json')).rejects.toThrow(
        'No cloud provider configured',
      );
      await expect(manager.listBackups()).rejects.toThrow('No cloud provider configured');
    });
  });

  describe('Provider selection', () => {
    it('should reject unknown provider', async () => {
      await expect(manager.setProvider('unknown', { accessToken: 'tok' })).rejects.toThrow(
        'Unknown provider: unknown',
      );
    });

    it('should authenticate with Google Drive via access token', async () => {
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 200,
        text: JSON.stringify({ user: { displayName: 'Test' } }),
      });

      const result = await manager.setProvider('gdrive', { accessToken: 'valid-token' });
      expect(result).toBe(true);
      expect(http.get).toHaveBeenCalledWith(
        expect.stringContaining('googleapis.com/drive/v3/about'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer valid-token' }),
        }),
      );
    });

    it('should return false when Google Drive auth fails', async () => {
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 401,
        text: 'Unauthorized',
      });

      const result = await manager.setProvider('gdrive', { accessToken: 'bad-token' });
      expect(result).toBe(false);
    });

    it('should authenticate with Dropbox via access token', async () => {
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusCode: 200,
        text: JSON.stringify({ account_id: 'abc' }),
      });

      const result = await manager.setProvider('dropbox', { accessToken: 'dropbox-token' });
      expect(result).toBe(true);
      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('dropboxapi.com/2/users/get_current_account'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer dropbox-token' }),
        }),
      );
    });

    it('should return false when no credentials are provided', async () => {
      const result = await manager.setProvider('gdrive', {});
      expect(result).toBe(false);
    });
  });

  describe('Upload and download', () => {
    beforeEach(async () => {
      // Authenticate with Google Drive
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ user: {} }),
      });
      await manager.setProvider('gdrive', { accessToken: 'tok' });
    });

    it('should upload bookmarks with metadata', async () => {
      // Mock getOrCreateAppFolder (search finds existing folder)
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      // Mock file creation
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ id: 'file-456' }),
      });
      // Mock content upload
      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: '{}',
      });

      const bookmarks = [
        {
          id: 'b1',
          title: 'Test',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];

      const result = await manager.uploadBookmarks(bookmarks);
      expect(result).toBe('file-456');
    });

    it('should download bookmarks from cloud', async () => {
      const backupData = {
        bookmarks: [
          {
            id: 'b1',
            title: 'Cloud BM',
            timestamp: 5,
            filepath: '/cloud.mp4',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            tags: [],
          },
        ],
        metadata: { version: '1.0.0', totalBookmarks: 1 },
      };

      // Mock file search
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'file-789' }] }),
      });
      // Mock content download
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify(backupData),
      });

      const result = await manager.downloadBookmarks('backup.json');
      expect(result.bookmarks).toHaveLength(1);
      expect(result.bookmarks[0].title).toBe('Cloud BM');
    });

    it('should list backups', async () => {
      // Mock getOrCreateAppFolder
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      // Mock list files
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({
          files: [{ name: 'backup-2024-01-01.json' }, { name: 'backup-2024-01-02.json' }],
        }),
      });

      const backups = await manager.listBackups();
      expect(backups).toHaveLength(2);
    });
  });

  describe('Sync merge logic', () => {
    beforeEach(async () => {
      // Authenticate with Google Drive
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ user: {} }),
      });
      await manager.setProvider('gdrive', { accessToken: 'tok' });
    });

    it('should upload when no cloud backups exist', async () => {
      // listBackups -> getOrCreateAppFolder -> list files (empty)
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [] }),
      });
      // uploadBookmarks (getOrCreateAppFolder + create + upload)
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ id: 'new-file' }),
      });
      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: '{}',
      });

      const localBookmarks = [
        {
          id: 'b1',
          title: 'Local',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];
      const result = await manager.syncBookmarks(localBookmarks);

      expect(result.merged).toEqual(localBookmarks);
      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('should merge local and cloud bookmarks', async () => {
      const cloudBookmarks = [
        {
          id: 'b1',
          title: 'Cloud Version',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          tags: [],
        },
        {
          id: 'b3',
          title: 'Cloud Only',
          timestamp: 30,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];

      const localBookmarks = [
        {
          id: 'b1',
          title: 'Local Version',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
        {
          id: 'b2',
          title: 'Local Only',
          timestamp: 20,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];

      // listBackups: getOrCreateAppFolder + list
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ name: 'backup.json' }] }),
      });
      // downloadBookmarks: search + download
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'file-1' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ bookmarks: cloudBookmarks, metadata: {} }),
      });
      // uploadBookmarks after merge: getOrCreateAppFolder + create + upload
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ id: 'merged-file' }),
      });
      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: '{}',
      });

      const result = await manager.syncBookmarks(localBookmarks);

      // b3 is new from cloud
      expect(result.added).toBe(1);
      // b1 cloud version is newer -> updated
      expect(result.updated).toBe(1);
      // merged should have all 3 bookmarks
      expect(result.merged).toHaveLength(3);
      const ids = result.merged.map((b: any) => b.id);
      expect(ids).toContain('b1');
      expect(ids).toContain('b2');
      expect(ids).toContain('b3');
    });

    it('should not contaminate bookmarks with source field after sync', async () => {
      const cloudBookmarks = [
        {
          id: 'b1',
          title: 'From Cloud',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];

      const localBookmarks = [
        {
          id: 'b2',
          title: 'Local',
          timestamp: 20,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];

      // listBackups
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ name: 'backup.json' }] }),
      });
      // downloadBookmarks
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'file-1' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ bookmarks: cloudBookmarks, metadata: {} }),
      });
      // uploadBookmarks
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ id: 'f' }),
      });
      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: '{}',
      });

      const result = await manager.syncBookmarks(localBookmarks);

      // No bookmark should have a 'source' field
      for (const bookmark of result.merged) {
        expect(bookmark).not.toHaveProperty('source');
      }
    });

    it('should keep local version when it is newer', async () => {
      const cloudBookmarks = [
        {
          id: 'b1',
          title: 'Old Cloud',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
        },
      ];

      const localBookmarks = [
        {
          id: 'b1',
          title: 'New Local',
          timestamp: 10,
          filepath: '/f.mp4',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z',
          tags: [],
        },
      ];

      // listBackups
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ name: 'backup.json' }] }),
      });
      // downloadBookmarks
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'file-1' }] }),
      });
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ bookmarks: cloudBookmarks, metadata: {} }),
      });
      // uploadBookmarks
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ files: [{ id: 'folder-123' }] }),
      });
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: JSON.stringify({ id: 'f' }),
      });
      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        statusCode: 200,
        text: '{}',
      });

      const result = await manager.syncBookmarks(localBookmarks);

      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].title).toBe('New Local');
      expect(result.updated).toBe(0);
    });
  });
});
