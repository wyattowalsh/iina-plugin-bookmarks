import { vi } from 'vitest';

/**
 * Shared cloud-storage mock factory.
 *
 * Because vi.mock() is hoisted above imports, you MUST use vi.hoisted() to
 * make the factory available at hoist-time:
 *
 *   const cloudStorageMock = vi.hoisted(() => ({
 *     getCloudStorageManager: vi.fn(() => ({
 *       setProvider: vi.fn(),
 *       uploadBookmarks: vi.fn(),
 *       downloadBookmarks: vi.fn(),
 *       listBackups: vi.fn(),
 *       syncBookmarks: vi.fn(),
 *     })),
 *     resetCloudStorageManager: vi.fn(),
 *     CloudStorageManager: vi.fn(),
 *   }));
 *   vi.mock('../src/cloud-storage', () => cloudStorageMock);
 *
 * This function is also available for use in beforeEach() to reset mocks.
 */
export const createCloudStorageMock = () => ({
  getCloudStorageManager: vi.fn(() => ({
    setProvider: vi.fn(),
    uploadBookmarks: vi.fn(),
    downloadBookmarks: vi.fn(),
    listBackups: vi.fn(),
    syncBookmarks: vi.fn(),
  })),
  resetCloudStorageManager: vi.fn(),
  CloudStorageManager: vi.fn(),
});
