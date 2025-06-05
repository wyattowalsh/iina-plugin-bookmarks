import { vi } from 'vitest'

// Mock IINA global object
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
}

// Make mocks available globally
global.console = mockIINA.console as any
global.preferences = mockIINA.preferences as any
global.core = mockIINA.core as any
global.event = mockIINA.event as any
global.menu = mockIINA.menu as any
global.sidebar = mockIINA.sidebar as any
global.overlay = mockIINA.overlay as any
global.standaloneWindow = mockIINA.standaloneWindow as any

// Mock iina module
vi.mock('iina', () => mockIINA) 