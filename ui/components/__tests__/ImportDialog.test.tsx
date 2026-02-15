/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import ImportDialog from '../ImportDialog';

describe('ImportDialog', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  let onClose: () => void;
  let postMessage: (type: string, data?: any) => void;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onClose = vi.fn() as unknown as () => void;
    postMessage = vi.fn() as unknown as (type: string, data?: any) => void;
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container.remove();
  });

  it('should not render when isOpen is false', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={false} onClose={onClose} postMessage={postMessage} />);
    });

    expect(container.querySelector('.dialog-overlay')).toBeNull();
  });

  it('should render dialog when isOpen is true', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Import Bookmarks');
  });

  it('should start on file-selection step', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    expect(container.textContent).toContain('Step 1: Select File');
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe('.json,.csv');
  });

  it('should close dialog on close button click', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const closeBtn = container.querySelector('.close-btn') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close dialog on Escape key', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should disable Parse File button when no file is selected', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const parseButton = container.querySelector('.btn-primary') as HTMLButtonElement;
    expect(parseButton.textContent).toBe('Parse File');
    expect(parseButton.disabled).toBe(true);
  });

  it('should show parse errors for invalid file types', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate selecting an invalid file type
    const invalidFile = new File(['contents'], 'test.txt', { type: 'text/plain' });
    act(() => {
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Please select a valid JSON or CSV file');
  });

  it('should show parse errors for files that are too large', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a mock file that reports large size
    const largeFile = new File(['x'], 'big.json', { type: 'application/json' });
    Object.defineProperty(largeFile, 'size', { value: 60 * 1024 * 1024 }); // 60MB

    act(() => {
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('File is too large');
  });

  it('should show parse errors for files that are too small', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a mock file that is very small
    const tinyFile = new File(['x'], 'tiny.json', { type: 'application/json' });
    Object.defineProperty(tinyFile, 'size', { value: 5 }); // 5 bytes

    act(() => {
      Object.defineProperty(fileInput, 'files', {
        value: [tinyFile],
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('File is too small');
  });

  it('should show file info after valid file selection', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const validFile = new File(['{"bookmarks":[]}'], 'bookmarks.json', {
      type: 'application/json',
    });
    Object.defineProperty(validFile, 'size', { value: 1024 }); // 1KB

    act(() => {
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Should show file info
    expect(container.textContent).toContain('bookmarks.json');
    expect(container.textContent).toContain('JSON');

    // Parse button should be enabled
    const parseButton = container.querySelector('.btn-primary') as HTMLButtonElement;
    expect(parseButton.disabled).toBe(false);
  });

  it('should reset state when dialog reopens', () => {
    // Render open
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    // Close and reopen
    act(() => {
      root.render(<ImportDialog isOpen={false} onClose={onClose} postMessage={postMessage} />);
    });

    act(() => {
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    // Should be back on file-selection step
    expect(container.textContent).toContain('Step 1: Select File');
  });

  it('should show import results when IMPORT_RESULT message is received', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    // Simulate receiving an import result via window message
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            type: 'IMPORT_RESULT',
            data: {
              success: true,
              importedCount: 5,
              skippedCount: 1,
              errorCount: 0,
            },
          },
        }),
      );
    });

    expect(container.textContent).toContain('Import Completed!');
    expect(container.textContent).toContain('5');
  });

  it('should show error state for failed import results', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(<ImportDialog isOpen={true} onClose={onClose} postMessage={postMessage} />);
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            type: 'IMPORT_RESULT',
            data: {
              success: false,
              importedCount: 0,
              skippedCount: 0,
              errorCount: 3,
              errors: ['Invalid format', 'Missing field', 'Corrupt data'],
            },
          },
        }),
      );
    });

    expect(container.textContent).toContain('Import Failed');
    expect(container.textContent).toContain('Invalid format');
  });
});
