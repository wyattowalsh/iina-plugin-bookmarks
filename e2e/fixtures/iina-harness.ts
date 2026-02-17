/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test';

/**
 * IinaHarness — simulates IINA backend messages for Playwright E2E tests.
 *
 * Sets `window.iina` with a stub `postMessage` (captures outbound UI→backend calls)
 * but deliberately omits `onMessage` so that `useIinaMessages` falls through to the
 * dev-mode `window.postMessage` path for inbound (backend→UI) message injection.
 */
export class IinaHarness {
  constructor(private page: Page) {}

  /**
   * Install the harness init script. Must be called BEFORE page.goto().
   * Sets up `window.iina.postMessage` stub for outbound message capture.
   */
  async install(): Promise<void> {
    await this.page.addInitScript(() => {
      // Record outbound messages for test assertion
      (window as any).__iinaOutbound = [] as Array<{ type: string; data: any }>;

      // Stub window.iina with postMessage only (NO onMessage).
      // UI code calls `appWindow.iina?.postMessage?.('TYPE', data)` for outbound
      // messages — this stub captures those calls.
      // onMessage is intentionally omitted so useIinaMessages falls back to
      // window.addEventListener('message', ...) for inbound injection.
      (window as any).iina = {
        postMessage(type: string, data?: any) {
          (window as any).__iinaOutbound.push({ type, data });
        },
      };

      // window.postMessage is used by the harness send() method for inbound
      // (backend→UI) injection — no need to patch it for outbound capture now
      // that window.iina.postMessage handles that.
    });
  }

  /** Send a backend→UI message via window.postMessage */
  async send(type: string, data: any = {}): Promise<void> {
    await this.page.evaluate(
      ({ type, data }) => {
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
