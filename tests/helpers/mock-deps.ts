import { vi } from 'vitest';
import type { IINARuntimeDependencies } from '../../src/types';

export type MockDeps = IINARuntimeDependencies;

/**
 * Find a registered onMessage handler for a specific message type on a UI mock.
 * Throws if no handler is found, listing the registered types for easier debugging.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findHandler(uiMock: any, messageType: string): (data: any) => void {
  const calls: any[][] = uiMock.mock.calls;
  const match = calls.find((call) => call[0] === messageType);
  if (!match) {
    const registered = calls.map((call) => call[0]).join(', ');
    throw new Error(
      `No handler registered for message type "${messageType}". Registered types: ${registered}`,
    );
  }
  return match[1];
}

/**
 * Canonical mock factory for IINARuntimeDependencies.
 * Every function is a vi.fn() with sensible defaults.
 * Pass overrides to customise specific properties.
 */
export function createMockDeps(overrides: Record<string, any> = {}): IINARuntimeDependencies {
  return {
    console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
    preferences: { get: vi.fn().mockReturnValue(null), set: vi.fn() },
    core: {
      status: { path: '/test/video.mp4', currentTime: 120 },
      seekTo: vi.fn(),
      seek: vi.fn(),
      osd: vi.fn(),
    },
    event: { on: vi.fn(), off: vi.fn() },
    menu: { addItem: vi.fn(), item: vi.fn(() => ({})) },
    sidebar: { loadFile: vi.fn(), postMessage: vi.fn(), onMessage: vi.fn() },
    overlay: {
      loadFile: vi.fn(),
      postMessage: vi.fn(),
      onMessage: vi.fn(),
      setClickable: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      isVisible: vi.fn().mockReturnValue(false),
    },
    standaloneWindow: {
      loadFile: vi.fn(),
      postMessage: vi.fn(),
      onMessage: vi.fn(),
      show: vi.fn(),
    },
    utils: { ask: vi.fn(), prompt: vi.fn(), chooseFile: vi.fn() },
    file: {
      read: vi.fn().mockReturnValue('[]'),
      write: vi.fn(),
      exists: vi.fn().mockReturnValue(true),
    },
    http: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ...overrides,
  } as unknown as IINARuntimeDependencies;
}
