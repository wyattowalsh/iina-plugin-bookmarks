// Extracted cloud-storage mock for explicit import control.
// Import this in test files that need the cloud-storage mock.
// Integration tests that need the real module should NOT import this.
//
// Uses a singleton pattern so BookmarkManager and tests share the same instance.

import { vi } from 'vitest';

const sharedCloudManager = vi.hoisted(() => ({
  setProvider: vi.fn(),
  uploadBookmarks: vi.fn(),
  downloadBookmarks: vi.fn(),
  listBackups: vi.fn(),
  syncBookmarks: vi.fn(),
}));

const cloudStorageMock = vi.hoisted(() => ({
  getCloudStorageManager: vi.fn(() => sharedCloudManager),
  resetCloudStorageManager: vi.fn(),
  CloudStorageManager: vi.fn(),
}));

vi.mock('../../src/cloud-storage', () => cloudStorageMock);
