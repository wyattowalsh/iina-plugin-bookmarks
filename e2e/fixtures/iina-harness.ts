/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test';

function installIinaBridge(): void {
  const w = window as any;
  if (w.__iinaHarnessInstalled) return;
  w.__iinaHarnessInstalled = true;

  // Record outbound messages for test assertion
  w.__iinaOutbound = [] as Array<{ type: string; data: any }>;
  const inboundHandlers: Record<string, Array<(data: any) => void>> = {};
  const pendingInbound: Array<{ type: string; data: any }> = [];

  const deliverInbound = (type: string, data: any) => {
    const handlers = inboundHandlers[type];
    if (!handlers || handlers.length === 0) {
      pendingInbound.push({ type, data });
      return;
    }
    handlers.forEach((handler) => handler(data));
  };

  w.__iinaDeliverInbound = deliverInbound;

  // Stub window.iina with onMessage + postMessage.
  w.iina = {
    onMessage(event: string, callback: (data: any) => void) {
      if (!inboundHandlers[event]) inboundHandlers[event] = [];
      inboundHandlers[event].push(callback);

      const remaining: Array<{ type: string; data: any }> = [];
      pendingInbound.forEach((message) => {
        if (message.type === event) {
          callback(message.data);
        } else {
          remaining.push(message);
        }
      });
      pendingInbound.length = 0;
      pendingInbound.push(...remaining);
    },
    postMessage(type: string, data?: any) {
      w.__iinaOutbound.push({ type, data });
    },
  };
}

/**
 * IinaHarness — simulates IINA backend messages for Playwright E2E tests.
 *
 * Installs a production-like `window.iina` bridge with:
 * - `onMessage` for backend→UI message delivery
 * - `postMessage` capture for UI→backend assertions
 *
 * Inbound messages are queued until handlers register to avoid races between
 * app mount/effect timing and early test injections.
 */
export class IinaHarness {
  constructor(private page: Page) {}

  /**
   * Install the harness init script. Must be called BEFORE page.goto().
   * Sets up `window.iina` bridge and outbound message capture.
   */
  async install(): Promise<void> {
    await this.page.addInitScript(installIinaBridge);
    // Ensure the current document also has the bridge even if navigation already occurred.
    await this.page.evaluate(installIinaBridge);
  }

  /** Send a backend→UI message via the simulated IINA bridge */
  async send(type: string, data: any = {}): Promise<void> {
    await this.page.evaluate(
      ({ type, data }) => {
        const deliverInbound = (window as any).__iinaDeliverInbound;
        if (typeof deliverInbound === 'function') {
          deliverInbound(type, data);
        }
        // Also send via MessageEvent for UIs that already fell back before bridge install.
        window.postMessage({ type, data }, window.location.origin);
      },
      { type, data },
    );
  }

  /** Send BOOKMARKS_UPDATED with a list of bookmarks */
  async sendBookmarks(bookmarks: any[]): Promise<void> {
    await this.send('BOOKMARKS_UPDATED', bookmarks);
  }

  /** Send CURRENT_FILE_PATH */
  async sendCurrentFile(filepath: string): Promise<void> {
    await this.send('CURRENT_FILE_PATH', filepath);
  }

  /** Send BOOKMARK_DEFAULTS for the AddBookmarkDialog */
  async sendBookmarkDefaults(defaults: {
    title: string;
    description: string;
    tags: string[];
    timestamp: number;
    filepath: string;
  }): Promise<void> {
    await this.send('BOOKMARK_DEFAULTS', defaults);
  }

  /** Send IMPORT_RESULT */
  async sendImportResult(result: {
    success: boolean;
    importedCount?: number;
    skippedCount?: number;
    errors?: string[];
  }): Promise<void> {
    await this.send('IMPORT_RESULT', result);
  }

  /** Send EXPORT_RESULT */
  async sendExportResult(result: { format: string; content: string }): Promise<void> {
    await this.send('EXPORT_RESULT', result);
  }

  /** Send CLOUD_SYNC_RESULT */
  async sendCloudSyncResult(result: {
    success: boolean;
    action: string;
    message?: string;
    error?: string;
  }): Promise<void> {
    await this.send('CLOUD_SYNC_RESULT', result);
  }

  /** Send FILE_RECONCILIATION_RESULT */
  async sendFileReconciliationResult(result: {
    success: boolean;
    action: string;
    bookmarkId: string;
  }): Promise<void> {
    await this.send('FILE_RECONCILIATION_RESULT', result);
  }

  /** Send SHOW_FILE_RECONCILIATION_DIALOG with moved files */
  async triggerReconciliationDialog(movedFiles: any[]): Promise<void> {
    await this.send('SHOW_FILE_RECONCILIATION_DIALOG', { movedFiles });
  }

  /** Send BOOKMARK_ADDED confirmation */
  async sendBookmarkAdded(): Promise<void> {
    await this.send('BOOKMARK_ADDED', {});
  }

  /** Send BOOKMARK_DELETED confirmation */
  async sendBookmarkDeleted(): Promise<void> {
    await this.send('BOOKMARK_DELETED', {});
  }

  /** Send BOOKMARK_JUMPED confirmation */
  async sendBookmarkJumped(): Promise<void> {
    await this.send('BOOKMARK_JUMPED', {});
  }

  /** Send ERROR message */
  async sendError(message: string): Promise<void> {
    await this.send('ERROR', { message });
  }

  /** Send SORT_PREFERENCES */
  async sendSortPreferences(preferences: any): Promise<void> {
    await this.send('SORT_PREFERENCES', preferences);
  }

  /** Get all intercepted outbound messages */
  async getOutboundMessages(): Promise<Array<{ type: string; data: any }>> {
    return await this.page.evaluate(() => (window as any).__iinaOutbound || []);
  }

  /** Get outbound messages filtered by type */
  async getOutboundByType(type: string): Promise<Array<{ type: string; data: any }>> {
    const all = await this.getOutboundMessages();
    return all.filter((m) => m.type === type);
  }

  /** Get the last outbound message of a given type */
  async getLastOutbound(type: string): Promise<{ type: string; data: any } | undefined> {
    const msgs = await this.getOutboundByType(type);
    return msgs[msgs.length - 1];
  }

  /** Clear intercepted outbound messages */
  async clearOutbound(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__iinaOutbound = [];
    });
  }
}
