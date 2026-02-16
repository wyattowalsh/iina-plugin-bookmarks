// Vitest global setup
// All backend tests inject dependencies via createMockDeps().
// This file only provides the bare minimum globalThis.iina stub
// so that any transitive import of the 'iina' module doesn't crash.

import { vi } from 'vitest';

// Cloud-storage mock — imported from extracted module for explicit control.
// Integration tests that need the real module should use a separate setup.
import './mocks/cloud-storage';

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
