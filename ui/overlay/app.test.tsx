/**
 * @vitest-environment jsdom
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkData } from '../types';
import App from './app';

type MessageHandler = (data: unknown) => void;
type TestIina = {
  onMessage: (type: string, handler: MessageHandler) => void;
  postMessage: (type: string, data?: unknown) => void;
};

type HostWindow = Window & {
  iina?: TestIina;
  webkit?: { messageHandlers?: { iina?: unknown } };
  __iinaHarnessInstalled?: boolean;
};

const bookmark: BookmarkData = {
  id: 'b1',
  title: 'Opening Scene',
  timestamp: 12.5,
  filepath: '/tmp/movie.mp4',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  tags: [],
};

function installBridge(nativeHost: boolean): {
  postMessage: ReturnType<typeof vi.fn>;
  emit: (type: string, data?: unknown) => void;
} {
  const handlers = new Map<string, MessageHandler>();
  const postMessage = vi.fn();
  const onMessage = vi.fn((type: string, handler: MessageHandler) => {
    handlers.set(type, handler);
  });
  const testWindow = window as HostWindow;
  testWindow.iina = { onMessage, postMessage };
  if (nativeHost) {
    testWindow.webkit = { messageHandlers: { iina: {} } };
  } else {
    delete testWindow.webkit;
  }
  delete testWindow.__iinaHarnessInstalled;

  return {
    postMessage,
    emit(type: string, data?: unknown) {
      const handler = handlers.get(type);
      if (!handler) {
        throw new Error(`No handler registered for ${type}`);
      }
      handler(data);
    },
  };
}

describe('overlay App visibility', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  let originalIina: HostWindow['iina'];
  let originalWebkit: HostWindow['webkit'];
  const testWindow = window as HostWindow;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    originalIina = testWindow.iina;
    originalWebkit = testWindow.webkit;
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container.remove();
    testWindow.iina = originalIina;
    testWindow.webkit = originalWebkit;
  });

  function renderApp(): void {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<App />);
    });
  }

  function overlay(): HTMLElement {
    const element = container.querySelector('.bookmark-overlay');
    if (!(element instanceof HTMLElement)) {
      throw new Error('overlay tree is missing');
    }
    return element;
  }

  function close(): void {
    const button = container.querySelector('[aria-label="Close bookmark overlay"]');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('close button is missing');
    }
    act(() => {
      button.click();
    });
  }

  it('hides with CSS on close and renders again when bookmarks arrive', () => {
    const { postMessage, emit } = installBridge(false);
    renderApp();

    act(() => {
      emit('BOOKMARKS_UPDATED', [bookmark]);
    });
    expect(overlay().hidden).toBe(false);
    expect(overlay().textContent).toContain('Opening Scene');

    close();

    expect(postMessage).toHaveBeenCalledWith('HIDE_OVERLAY');
    expect(overlay().isConnected).toBe(true);
    expect(overlay().hidden).toBe(true);

    act(() => {
      emit('BOOKMARKS_UPDATED', [bookmark]);
    });

    expect(overlay().hidden).toBe(false);
    expect(overlay().textContent).toContain('Opening Scene');
    expect(overlay().textContent).toContain('Bookmarks (1)');
  });

  it('shows the mounted tree again when a show message arrives', () => {
    const { emit } = installBridge(false);
    renderApp();
    close();
    expect(overlay().hidden).toBe(true);

    act(() => {
      emit('SHOW_OVERLAY');
    });

    expect(overlay().hidden).toBe(false);
    expect(container.querySelector('[aria-label="Close bookmark overlay"]')).not.toBeNull();
  });

  it('hides on Escape without unmounting', () => {
    const { postMessage } = installBridge(false);
    renderApp();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(postMessage).toHaveBeenCalledWith('HIDE_OVERLAY');
    expect(overlay().hidden).toBe(true);
    expect(overlay().isConnected).toBe(true);
  });

  it('keeps the React tree rendered when IINA shows the webview without a message', () => {
    const { postMessage, emit } = installBridge(true);
    renderApp();

    act(() => {
      emit('BOOKMARKS_UPDATED', [bookmark]);
    });
    close();

    expect(postMessage).toHaveBeenCalledWith('HIDE_OVERLAY');
    expect(overlay().hidden).toBe(false);
    expect(overlay().textContent).toContain('Opening Scene');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(overlay().hidden).toBe(false);
    expect(overlay().textContent).toContain('Bookmarks (1)');
  });
});
