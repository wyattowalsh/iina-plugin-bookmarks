/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import AddBookmarkDialog from '../AddBookmarkDialog';

describe('AddBookmarkDialog defaults request behavior', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  let onClose: () => void;
  let onSave: (
    title: string,
    description: string,
    tags: string[],
    timestamp: number,
    color?: string,
    endTimestamp?: number,
  ) => void;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onClose = vi.fn() as unknown as () => void;
    onSave = vi.fn() as unknown as (
      title: string,
      description: string,
      tags: string[],
      timestamp: number,
      color?: string,
      endTimestamp?: number,
    ) => void;
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container.remove();
  });

  it('requests defaults only once while dialog remains open even when postMessage reference changes', () => {
    const postMessageA = vi.fn() as unknown as (type: string, data?: any) => void;
    const postMessageB = vi.fn() as unknown as (type: string, data?: any) => void;

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <AddBookmarkDialog
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          availableTags={[]}
          postMessage={postMessageA}
        />,
      );
    });

    expect(postMessageA).toHaveBeenCalledWith('REQUEST_BOOKMARK_DEFAULTS');
    expect(postMessageA).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(
        <AddBookmarkDialog
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          availableTags={[]}
          postMessage={postMessageB}
        />,
      );
    });

    expect(postMessageB).not.toHaveBeenCalled();
  });

  it('requests defaults again when dialog is reopened', () => {
    const postMessage = vi.fn() as unknown as (type: string, data?: any) => void;

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <AddBookmarkDialog
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    act(() => {
      root.render(
        <AddBookmarkDialog
          isOpen={false}
          onClose={onClose}
          onSave={onSave}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    act(() => {
      root.render(
        <AddBookmarkDialog
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, 'REQUEST_BOOKMARK_DEFAULTS');
    expect(postMessage).toHaveBeenNthCalledWith(2, 'REQUEST_BOOKMARK_DEFAULTS');
  });
});
