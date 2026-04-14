import { test, expect, type Page } from '@playwright/test';
import { connectToBrowser } from './browser';
import { getCdpUrl, getConfig } from './config';
import { buildUrl, captureScreenshot, ensureDirectories, escapeRegExp, formatError } from './utils';

test('open the configured Rundeck target page', async () => {
  const { baseUrl, targetPath } = getConfig();
  let page: Page | undefined;

  await ensureDirectories();
  const targetUrl = buildUrl(baseUrl, targetPath);

  try {
    ({ page } = await connectToBrowser());
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(escapeRegExp(targetPath)));
    await expect(page.locator('body')).not.toContainText(/sign in|log in/i);

    const screenshotPath = await captureScreenshot(page, 'target-page.png');
    test.info().annotations.push({ type: 'screenshot', description: screenshotPath });
  } catch (error) {
    const screenshotPath = page
      ? await captureScreenshot(page, 'target-page-error.png').catch(() => '')
      : '';
    throw new Error(
      `Opening Rundeck target page failed for ${targetUrl} using CDP endpoint ${getCdpUrl()}. ${formatError(error)}${
        screenshotPath ? ` Screenshot: ${screenshotPath}` : ''
      }`
    );
  }
});
