/**
 * @vitest-environment jsdom
 */
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistentState } from './usePersistentState';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  const api = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    reset: () => {
      store = {};
      api.getItem.mockClear();
      api.setItem.mockClear();
      api.clear.mockClear();
      api.getItem.mockImplementation((key: string) => store[key] ?? null);
      api.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
    },
  };
  return api;
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function TestHarness({
  storageKey,
  defaultValue,
  onReady,
}: {
  storageKey: string;
  defaultValue: string;
  onReady: (setter: (value: string) => void) => void;
}) {
  const [value, setValue] = usePersistentState(storageKey, defaultValue);

  useEffect(() => {
    onReady(setValue);
  }, [onReady, setValue]);

  return <div data-value={value} />;
}

describe('usePersistentState', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root | undefined;
  let setValue: ((value: string) => void) | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    localStorageMock.reset();
    root = undefined;
    setValue = undefined;
  });

  afterEach(() => {
    const currentRoot = root;
    if (currentRoot) {
      act(() => currentRoot.unmount());
    }
    container.remove();
    vi.restoreAllMocks();
  });

  it('updates state after successful localStorage persistence', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <TestHarness
          storageKey="test-key"
          defaultValue="initial"
          onReady={(setter) => (setValue = setter)}
        />,
      );
    });

    const valueNode = container.querySelector('[data-value]') as HTMLDivElement;
    expect(valueNode.getAttribute('data-value')).toBe('initial');

    act(() => {
      setValue?.('updated');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('updated'));
    expect(valueNode.getAttribute('data-value')).toBe('updated');
  });

  it('keeps previous state when localStorage persistence fails', () => {
    const writeError = new Error('Quota exceeded');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    localStorageMock.setItem.mockImplementation(() => {
      throw writeError;
    });

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <TestHarness
          storageKey="test-key"
          defaultValue="initial"
          onReady={(setter) => (setValue = setter)}
        />,
      );
    });

    const valueNode = container.querySelector('[data-value]') as HTMLDivElement;

    act(() => {
      setValue?.('updated');
    });

    expect(valueNode.getAttribute('data-value')).toBe('initial');
    expect(warnSpy).toHaveBeenCalledWith('Error setting localStorage key "test-key":', writeError);
  });
});
