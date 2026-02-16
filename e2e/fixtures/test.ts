import { test as base } from '@playwright/test';
import { IinaHarness } from './iina-harness';

/**
 * Custom Playwright test fixture that provides an IinaHarness instance.
 * The harness is automatically installed before page navigation.
 */
export const test = base.extend<{ harness: IinaHarness }>({
  harness: async ({ page }, use) => {
    const harness = new IinaHarness(page);
    await harness.install();
    await use(harness);
  },
});

export { expect } from '@playwright/test';
