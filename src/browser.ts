import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { getCdpUrl } from './config';

type ConnectedBrowser = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

const CDP_RETRY_ATTEMPTS = 3;
const CDP_RETRY_DELAY_MS = 1_000;

export async function connectToBrowser(): Promise<ConnectedBrowser> {
  const cdpUrl = getCdpUrl();
  let lastError: unknown;

  for (let attempt = 1; attempt <= CDP_RETRY_ATTEMPTS; attempt++) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      const context = browser.contexts()[0] || (await browser.newContext({ ignoreHTTPSErrors: true }));
      const page = await context.newPage();

      await page.bringToFront().catch(() => undefined);

      return { browser, context, page };
    } catch (error) {
      lastError = error;
      if (attempt < CDP_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, CDP_RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(
    `Failed to connect to CDP browser at ${cdpUrl} after ${CDP_RETRY_ATTEMPTS} attempts. ` +
    `Is the browser running with --remote-debugging-port? ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
