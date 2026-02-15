/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import ErrorBoundary from '../ErrorBoundary';

// Suppress React error boundary console.error noise during tests
const originalConsoleError = console.error;

describe('ErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    console.error = vi.fn();
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container.remove();
    console.error = originalConsoleError;
  });

  function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
      throw new Error('Test error from child');
    }
    return <div data-testid="child">Child content</div>;
  }

  it('should render children when no error occurs', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={false} />
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('Child content');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('should render fallback UI when child throws', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>,
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('Something went wrong');
    expect(alert!.textContent).toContain('Test error from child');
  });

  it('should render a Reload button in the fallback', () => {
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>,
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('Reload');
  });

  it('should call window.location.reload when Reload button is clicked', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        <ErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>,
      );
    });

    const button = container.querySelector('button')!;
    act(() => {
      button.click();
    });

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
