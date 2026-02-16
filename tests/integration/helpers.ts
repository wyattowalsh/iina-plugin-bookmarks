import { vi } from 'vitest';
import { BookmarkManager } from '../../src/bookmark-manager';
import { createMockDeps, findHandler, type MockDeps } from '../helpers/mock-deps';
import type { BookmarkData, UISource } from '../../src/types';

export interface TestHarness {
  manager: BookmarkManager;
  deps: MockDeps;
  /** Send a UI message to the BookmarkManager (simulates a message from a UI) */
  send: (ui: UISource, msgType: string, payload?: Record<string, unknown>) => void;
  /** Get all outbound postMessage calls for a UI */
  getMessages: (ui: UISource, msgType?: string) => Array<{ type: string; data: any }>;
  /** Get the last outbound message of a given type for a UI */
  getLastMessage: (ui: UISource, msgType: string) => any | undefined;
  /** Clear all postMessage mock call history */
  clearMessages: () => void;
}

/**
 * Create a test harness wrapping BookmarkManager with mock dependencies.
 * Provides convenient methods for sending messages and reading responses.
 */
export function createTestHarness(depsOverrides: Record<string, any> = {}): TestHarness {
  const deps = createMockDeps(depsOverrides);
  const manager = new BookmarkManager(deps);

  function getUIMock(ui: UISource) {
    switch (ui) {
      case 'sidebar':
        return deps.sidebar;
      case 'overlay':
        return deps.overlay;
      case 'window':
        return deps.standaloneWindow;
      default:
        return deps.sidebar;
    }
  }

  function send(ui: UISource, msgType: string, payload: Record<string, unknown> = {}) {
    const uiMock = getUIMock(ui);
    const handler = findHandler(uiMock.onMessage, msgType);
    handler(payload);
  }

  function getMessages(ui: UISource, msgType?: string): Array<{ type: string; data: any }> {
    const uiMock = getUIMock(ui);
    const calls = (uiMock.postMessage as ReturnType<typeof vi.fn>).mock.calls;
    const messages = calls.map(([type, data]: any[]) => ({ type, data }));
    if (msgType) {
      return messages.filter((m) => m.type === msgType);
    }
    return messages;
  }

  function getLastMessage(ui: UISource, msgType: string): any | undefined {
    const msgs = getMessages(ui, msgType);
    return msgs.length > 0 ? msgs[msgs.length - 1].data : undefined;
  }

  function clearMessages() {
    for (const ui of ['sidebar', 'overlay', 'window'] as const) {
      (getUIMock(ui).postMessage as ReturnType<typeof vi.fn>).mockClear();
    }
  }

  return { manager, deps, send, getMessages, getLastMessage, clearMessages };
}

/** Factory for creating valid BookmarkData objects */
export function makeBookmark(
  id: string,
  title: string,
  timestamp: number,
  filepath = '/test/video.mp4',
  tags: string[] = [],
): BookmarkData {
  const now = new Date().toISOString();
  return {
    id,
    title,
    timestamp,
    filepath,
    description: `Description for ${title}`,
    createdAt: now,
    updatedAt: now,
    tags,
  };
}
