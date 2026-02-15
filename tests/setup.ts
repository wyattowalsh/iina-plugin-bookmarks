// Vitest global setup
// All backend tests inject dependencies via createMockDeps().
// This file only provides the bare minimum globalThis.iina stub
// so that any transitive import of the 'iina' module doesn't crash.

import { vi } from 'vitest';

// Centralized cloud-storage mock — prevents every backend test file from
// duplicating the vi.hoisted() + vi.mock() boilerplate.
// NOTE: vi.hoisted() runs before imports, so we inline the factory here.
const cloudStorageMock = vi.hoisted(() => ({
  getCloudStorageManager: vi.fn(() => ({
    setProvider: vi.fn(),
    uploadBookmarks: vi.fn(),
    downloadBookmarks: vi.fn(),
    listBackups: vi.fn(),
    syncBookmarks: vi.fn(),
  })),
  resetCloudStorageManager: vi.fn(),
  CloudStorageManager: vi.fn(),
}));
vi.mock('../src/cloud-storage', () => cloudStorageMock);

const noop = vi.fn();

const minimalIINA = {
  console: { log: noop, error: noop, warn: noop },
  preferences: { get: vi.fn().mockReturnValue(null), set: noop },
  core: { status: { path: '', currentTime: 0 } },
  event: { on: noop, off: noop },
  menu: { addItem: noop, item: vi.fn(() => ({})) },
  sidebar: { loadFile: noop, postMessage: noop, onMessage: noop },
  overlay: {
    loadFile: noop,
    postMessage: noop,
    onMessage: noop,
    setClickable: noop,
    show: noop,
    hide: noop,
    isVisible: vi.fn().mockReturnValue(false),
  },
  standaloneWindow: { loadFile: noop, postMessage: noop, onMessage: noop, show: noop },
};

(globalThis as any).iina = minimalIINA;

vi.mock('iina', () => minimalIINA);
