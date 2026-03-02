/**
 * @vitest-environment jsdom
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIinaMessages } from './useIinaMessages';

type MessageHandler = (data: unknown) => void;
type TestIina = {
  onMessage?: (type: string, handler: MessageHandler) => void;
  postMessage?: (type: string, data?: unknown) => void;
};

function TestHarness({
  handlers,
  uiType,
}: {
  handlers: Record<string, MessageHandler>;
  uiType: string;
}) {
  useIinaMessages(handlers, uiType);
  return null;
}

describe('useIinaMessages', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  let originalIina: TestIina | undefined;
  const testWindow = window as Window & { iina?: TestIina };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    originalIina = testWindow.iina;
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container.remove();
    testWindow.iina = originalIina;
  });

  it('registers iina.onMessage handlers and sends UI_READY', () => {
    const registered = new Map<string, MessageHandler>();
    const onMessage = vi.fn((type: string, handler: MessageHandler) => {
      registered.set(type, handler);
    });
    const postMessage = vi.fn();
    const bookmarksUpdated = vi.fn();

    testWindow.iina = { onMessage, postMessage };

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <TestHarness handlers={{ BOOKMARKS_UPDATED: bookmarksUpdated }} uiType="sidebar" />,
      );
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith('BOOKMARKS_UPDATED', expect.any(Function));
    expect(postMessage).toHaveBeenCalledWith('UI_READY', { uiType: 'sidebar' });

    act(() => {
      registered.get('BOOKMARKS_UPDATED')?.([{ id: 'b1' }]);
    });
    expect(bookmarksUpdated).toHaveBeenCalledWith([{ id: 'b1' }]);
  });

  it('uses latest handler via ref when callbacks fire after rerender', () => {
    const onMessage = vi.fn();
    const postMessage = vi.fn();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    testWindow.iina = { onMessage, postMessage };

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<TestHarness handlers={{ ERROR: firstHandler }} uiType="window" />);
    });

    const registeredCallback = onMessage.mock.calls[0][1] as MessageHandler;

    act(() => {
      root.render(<TestHarness handlers={{ ERROR: secondHandler }} uiType="window" />);
    });

    act(() => {
      registeredCallback({ message: 'latest only' });
    });

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith({ message: 'latest only' });
  });

  it('falls back to window.postMessage listener when iina.onMessage is unavailable', () => {
    const postMessage = vi.fn();
    const pingHandler = vi.fn();

    testWindow.iina = { postMessage };

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<TestHarness handlers={{ PING: pingHandler }} uiType="overlay" />);
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: JSON.stringify({ type: 'PING', data: { ok: true } }),
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'http://example.com',
          data: { type: 'PING', data: { ok: false } },
        }),
      );
    });

    expect(postMessage).not.toHaveBeenCalled();
    expect(pingHandler).toHaveBeenCalledTimes(1);
    expect(pingHandler).toHaveBeenCalledWith({ ok: true });
  });
});
