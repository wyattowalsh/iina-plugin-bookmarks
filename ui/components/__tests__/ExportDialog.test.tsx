/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import ExportDialog from '../ExportDialog';

describe('ExportDialog', () => {
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
      root.render(
        <ExportDialog
          isOpen={false}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    expect(container.querySelector('.dialog-overlay')).toBeNull();
  });

  it('should render dialog when isOpen is true', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Export Bookmarks');
  });

  it('should render JSON and CSV format options', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    const radios = container.querySelectorAll('input[name="export-format"]');
    expect(radios).toHaveLength(2);

    const jsonRadio = container.querySelector('input[value="json"]') as HTMLInputElement;
    const csvRadio = container.querySelector('input[value="csv"]') as HTMLInputElement;
    expect(jsonRadio.checked).toBe(true);
    expect(csvRadio.checked).toBe(false);
  });

  it('should show CSV options when CSV format is selected', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    // CSV options should not be visible initially (JSON is default)
    expect(container.textContent).not.toContain('Delimiter');

    // Select CSV format
    const csvRadio = container.querySelector('input[value="csv"]') as HTMLInputElement;
    act(() => {
      csvRadio.click();
      csvRadio.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // CSV options should now be visible
    expect(container.textContent).toContain('Delimiter');
    expect(container.textContent).toContain('Fields to Export');
    expect(container.textContent).toContain('Include column headers');
  });

  it('should call postMessage with export options on submit', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    // Click the Export Bookmarks button
    const exportButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(exportButton.textContent).toContain('Export Bookmarks');

    act(() => {
      exportButton.click();
    });

    expect(postMessage).toHaveBeenCalledWith(
      'EXPORT_BOOKMARKS',
      expect.objectContaining({
        format: 'json',
        includeMetadata: true,
      }),
    );
  });

  it('should close dialog when close button is clicked', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    const closeBtn = container.querySelector('.close-btn') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close dialog when Cancel button is clicked', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    const cancelButton = container.querySelector('.btn-secondary') as HTMLButtonElement;
    expect(cancelButton.textContent).toBe('Cancel');
    act(() => {
      cancelButton.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close dialog on Escape key', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show filter options when "Apply filters" is checked', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={['action', 'drama']}
          postMessage={postMessage}
        />,
      );
    });

    // Find the "Apply filters to export" checkbox
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // The first checkbox is "Include export metadata", the second is "Apply filters to export"
    const filterCheckbox = Array.from(checkboxes).find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('Apply filters');
    }) as HTMLInputElement;

    expect(filterCheckbox).not.toBeNull();

    act(() => {
      filterCheckbox!.click();
    });

    // Should now show tag filter checkboxes
    expect(container.textContent).toContain('Filter by Tags');
    expect(container.textContent).toContain('action');
    expect(container.textContent).toContain('drama');
  });

  it('should disable export button when CSV format has no fields selected', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    // Switch to CSV
    const csvRadio = container.querySelector('input[value="csv"]') as HTMLInputElement;
    act(() => {
      csvRadio.click();
      csvRadio.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Uncheck all field checkboxes
    const fieldCheckboxes = container.querySelectorAll('.field-checkbox input[type="checkbox"]');
    act(() => {
      fieldCheckboxes.forEach((cb) => {
        if ((cb as HTMLInputElement).checked) {
          (cb as HTMLInputElement).click();
        }
      });
    });

    const exportButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(exportButton.disabled).toBe(true);
  });

  it('should show exporting state when export is in progress', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    const exportButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    act(() => {
      exportButton.click();
    });

    // Button should show exporting state
    expect(exportButton.textContent).toContain('Exporting...');
    expect(exportButton.disabled).toBe(true);
  });

  it('should have proper aria attributes for a11y', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ExportDialog
          isOpen={true}
          onClose={onClose}
          availableTags={[]}
          postMessage={postMessage}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe('export-dialog-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('export-dialog-description');

    const title = container.querySelector('#export-dialog-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Export Bookmarks');

    const radioGroup = container.querySelector('[role="radiogroup"]');
    expect(radioGroup).not.toBeNull();
  });
});
