import { vi } from 'vitest';

// Mock IINA global object for plugin backend tests
const mockIINA = {
  console: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  preferences: {
    get: vi.fn(),
    set: vi.fn(),
  },
  core: {
    status: {
      path: '/test/video.mp4',
      currentTime: 100,
    },
  },
  event: {
    on: vi.fn(),
  },
  menu: {
    addItem: vi.fn(),
    item: vi.fn(),
  },
  sidebar: {
    loadFile: vi.fn(),
    postMessage: vi.fn(),
    onMessage: vi.fn(),
  },
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
};

// Make IINA mocks available on globalThis (do NOT replace real console)
(globalThis as any).iina = mockIINA;
(globalThis as any).preferences = mockIINA.preferences;
(globalThis as any).core = mockIINA.core;
(globalThis as any).event = mockIINA.event;
(globalThis as any).menu = mockIINA.menu;
(globalThis as any).sidebar = mockIINA.sidebar;
(globalThis as any).overlay = mockIINA.overlay;
(globalThis as any).standaloneWindow = mockIINA.standaloneWindow;

// Mock iina module
vi.mock('iina', () => mockIINA);
