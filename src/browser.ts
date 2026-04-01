import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { getCdpUrl } from './config';

type ConnectedBrowser = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

export async function connectToBrowser(): Promise<ConnectedBrowser> {
  const browser = await chromium.connectOverCDP(getCdpUrl());
  const context = browser.contexts()[0] || (await browser.newContext({ ignoreHTTPSErrors: true }));
  const page = await context.newPage();

  await page.bringToFront().catch(() => undefined);

  return {
    browser,
    context,
    page
  };
}
