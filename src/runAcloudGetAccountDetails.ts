import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { connectToBrowser } from './browser';
import {
  getAcloudJobPath,
  getCdpUrl,
  getConfig,
  getOptionalEnv
} from './config';
import {
  buildUrl,
  captureScreenshot,
  ensureDirectories,
  escapeRegExp,
  formatError,
  unique
} from './utils';

type JobInputs = {
  cloudOrg: string;
  ticketNumber: string;
};

type TenantRecord = {
  id: string;
  name?: string;
};

type ParsedResult = {
  organizationIds: string[];
  tenants: TenantRecord[];
};

type JobResult = {
  cloudOrg: string;
  ticketNumber: string;
  jobUrl: string;
  organizationIds: string[];
  tenants: TenantRecord[];
};

type DebugPausePoint = 'before-run' | 'after-run' | 'execution-page' | 'output-page';

const EXECUTION_TIMEOUT_MS = 180_000;
const MANUAL_LOGIN_TIMEOUT_MS = 10 * 60_000;
const POST_RUN_NAVIGATION_TIMEOUT_MS = 20_000;
test.setTimeout(EXECUTION_TIMEOUT_MS + 30_000);

function readCliOption(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const exactMatch = args.find((arg) => arg.startsWith(`${flag}=`));
  if (exactMatch) {
    return exactMatch.slice(flag.length + 1).trim() || undefined;
  }

  const flagIndex = args.indexOf(flag);
  if (flagIndex >= 0) {
    return args[flagIndex + 1]?.trim() || undefined;
  }

  return undefined;
}

function normalizeCloudOrg(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const [logicalName] = parsed.pathname.split('/').filter(Boolean);
    return logicalName || trimmed;
  } catch {
    return trimmed;
  }
}

function getJobInputs(): JobInputs {
  const cloudOrg = normalizeCloudOrg(readCliOption('--cloud-org') || getOptionalEnv('RUNDECK_CLOUD_ORG') || '');
  const ticketNumber = readCliOption('--ticket') || getOptionalEnv('RUNDECK_TICKET_NUMBER');

  if (!cloudOrg) {
    throw new Error(
      'Missing cloud org. Provide --cloud-org "<value>" or set RUNDECK_CLOUD_ORG in .env.'
    );
  }

  if (!ticketNumber) {
    throw new Error(
      'Missing ticket number. Provide --ticket "<value>" or set RUNDECK_TICKET_NUMBER in .env.'
    );
  }

  return { cloudOrg, ticketNumber };
}

function getDebugPausePoints(): Set<DebugPausePoint> {
  const rawValue = getOptionalEnv('RUNDECK_DEBUG_PAUSE_POINTS');
  if (!rawValue) {
    return new Set();
  }

  const allowedValues = new Set<DebugPausePoint>([
    'before-run',
    'after-run',
    'execution-page',
    'output-page'
  ]);

  return new Set(
    rawValue
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is DebugPausePoint => allowedValues.has(value as DebugPausePoint))
  );
}

async function pauseIfRequested(page: Page, pausePoints: Set<DebugPausePoint>, point: DebugPausePoint): Promise<void> {
  if (!pausePoints.has(point)) {
    return;
  }

  // Lets the headed Playwright run stop at an exact navigation point for DOM inspection.
  await page.pause();
}

function extractIdsFromText(text: string): ParsedResult {
  const organizationIds: string[] = [];
  const tenants: TenantRecord[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  organizationIds.push(...extractOrganizationIdsFromSections(lines));
  organizationIds.push(...extractOrganizationIdsFromGrafanaUrls(lines));
  tenants.push(...extractTenantsFromSections(lines));

  return {
    organizationIds: unique(organizationIds),
    tenants: uniqueTenantRecords(tenants)
  };
}

function extractOrganizationIdsFromGrafanaUrls(lines: string[]): string[] {
  const organizationIds: string[] = [];

  for (const line of lines) {
    const matches = [...line.matchAll(/[?&]var-orgid=([a-f0-9-]{36})/gi)];
    for (const match of matches) {
      if (match[1]) {
        organizationIds.push(match[1]);
      }
    }
  }

  return organizationIds;
}

function extractOrganizationIdsFromSections(lines: string[]): string[] {
  const organizationIds: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^organization details$/i.test(lines[index])) {
      continue;
    }

    for (let rowIndex = index + 1; rowIndex < Math.min(index + 12, lines.length); rowIndex += 1) {
      const line = lines[rowIndex];
      if (
        !line ||
        /^tenant details$/i.test(line) ||
        /^organization service locations/i.test(line) ||
        /^[-]+$/.test(line) ||
        /organization[_\s]?id|logicalname|subscriptioncode|licensecode|name|companyemail|status|country|createdon/i.test(
          line
        )
      ) {
        continue;
      }

      const matches = line.match(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi);
      if (matches?.length) {
        organizationIds.push(...matches);
        break;
      }
    }
  }

  return organizationIds;
}

function extractTenantsFromSections(lines: string[]): TenantRecord[] {
  const tenants: TenantRecord[] = [];
  const uuidPattern = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi;

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^tenant details$/i.test(lines[index])) {
      continue;
    }

    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex];
      if (!line) {
        continue;
      }

      if (/^organization service locations/i.test(line)) {
        break;
      }

      if (/tenantid|tenantname|isdefaulttenant|region|iscanarytenant|createdon/i.test(line) || /^[-]+$/.test(line)) {
        continue;
      }

      const ids = line.match(uuidPattern) || [];
      if (ids.length < 2) {
        continue;
      }

      const remainder = line.slice(line.indexOf(ids[1]) + ids[1].length).trim();
      const nameMatch = remainder.match(/^(.+?)\s+\d+\s+(?:True|False)\s+\d+\s+(?:True|False)\s+/i);
      const tenantName = normalizeNameCandidate(nameMatch?.[1] || '');
      if (!tenantName) {
        continue;
      }

      tenants.push({
        id: ids[1],
        name: tenantName
      });
    }
  }

  return tenants;
}

function normalizeNameCandidate(value: string): string | undefined {
  const cleaned = value
    .replace(/^["'\s:=-]+/, '')
    .replace(/["'\s]+$/, '')
    .trim();

  if (!cleaned) {
    return undefined;
  }

  if (/^(tenant|name|tenant name)$/i.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function uniqueTenantRecords(tenants: TenantRecord[]): TenantRecord[] {
  const byId = new Map<string, TenantRecord>();

  for (const tenant of tenants) {
    const existing = byId.get(tenant.id);
    if (!existing) {
      byId.set(tenant.id, tenant);
      continue;
    }

    if (!existing.name && tenant.name) {
      byId.set(tenant.id, tenant);
    }
  }

  return [...byId.values()];
}

function formatCopyPasteResult(result: JobResult): string {
  const lines = [
    `URL: ${result.jobUrl}`,
    `ORG Name: ${result.cloudOrg}`,
    `ORG ID: ${result.organizationIds[0] || ''}`,
    'TENANTS:'
  ];

  for (const tenant of result.tenants) {
    lines.push(`${tenant.id} | ${tenant.name || ''}`);
  }

  return lines.join('\n');
}

async function fillJobOption(page: Page, label: RegExp, fallbackName: string, value: string): Promise<void> {
  const optionField = page
    .getByLabel(label)
    .or(page.locator(`[name="${fallbackName}"]`))
    .or(page.locator(`#${fallbackName}`))
    .or(
      page
        .locator('label, .control-label, .form-label, dt, div, span')
        .filter({ hasText: label })
        .locator('xpath=following::input[not(@type="hidden")][1] | following::textarea[1] | following::select[1]')
    )
    .first();

  await expect(optionField).toBeVisible({ timeout: 15_000 });

  const tagName = await optionField.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === 'select') {
    await optionField.selectOption({ label: value }).catch(async () => {
      await optionField.selectOption(value);
    });
    return;
  }

  await optionField.fill(value);
}

async function startJobRun(page: Page): Promise<void> {
  const runButton = page
    .getByRole('button', { name: /run job now|run now|run job|run/i })
    .or(page.getByRole('link', { name: /run job now|run now|run job|run/i }))
    .first();

  await expect(runButton).toBeVisible({ timeout: 15_000 });
  const startingUrl = page.url();
  await runButton.click();

  await Promise.race([
    page
      .waitForURL(
        (url) => {
          const currentUrl = url.toString();
          return currentUrl !== startingUrl && /\/execution\/(show|follow|output)\//i.test(currentUrl);
        },
        { timeout: POST_RUN_NAVIGATION_TIMEOUT_MS }
      )
      .catch(() => undefined),
    page
      .locator('a[href*="/execution/output/"], a[href*="/execution/follow/"], a[href*="/execution/show/"]')
      .first()
      .waitFor({ state: 'visible', timeout: POST_RUN_NAVIGATION_TIMEOUT_MS })
      .catch(() => undefined)
  ]);
}

function isExecutionUrl(url: string): boolean {
  return /\/execution\/(show|follow|output)\//i.test(url);
}

async function openFirstVisibleLocator(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }

    if (!(await locator.isVisible().catch(() => false))) {
      continue;
    }

    await locator.click().catch(() => undefined);
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.waitForTimeout(1_000);
    return true;
  }

  return false;
}

async function openExecutionOutput(page: Page): Promise<void> {
  if (!isExecutionUrl(page.url())) {
    const openedExecutionPage = await openFirstVisibleLocator(page, [
      'a[href*="/execution/output/"]',
      'a[href*="/execution/follow/"]',
      'a[href*="/execution/show/"]',
      'a[href*="/activity/show/"]',
      'button[data-href*="/execution/output/"]',
      'button[data-href*="/execution/follow/"]',
      'button[data-href*="/execution/show/"]'
    ]);

    if (openedExecutionPage) {
      await page
        .waitForURL((url) => isExecutionUrl(url.toString()), {
          timeout: POST_RUN_NAVIGATION_TIMEOUT_MS
        })
        .catch(() => undefined);
    }
  }

  if (isExecutionUrl(page.url()) && /\/execution\/output\//i.test(page.url())) {
    return;
  }

  await openFirstVisibleLocator(page, [
    'a[href*="/execution/output/"]',
    'a[href*="#output"]',
    'button[data-href*="/execution/output/"]',
    '[role="tab"][href*="/execution/output/"]',
    '[role="tab"][aria-controls*="output"]'
  ]);
}

async function clickRowOrToggle(page: Page, rowText: RegExp): Promise<void> {
  const row = page
    .locator('tr, li, div')
    .filter({ hasText: rowText })
    .first();

  await expect(row).toBeVisible({ timeout: 15_000 });

  const toggleCandidates = [
    row.locator('button, a, [role="button"], .glyphicon, .fas, .far, .fa, .arrow, .expand, .toggle').first(),
    row.locator('xpath=.//*[self::button or self::a or @role="button"][1]').first(),
    row.locator('xpath=.//*[contains(@class,"glyphicon") or contains(@class,"icon") or contains(@class,"toggle")][1]').first()
  ];

  for (const candidate of toggleCandidates) {
    if ((await candidate.count()) === 0) {
      continue;
    }

    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(500);
      return;
    }
  }

  await row.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function expandExecutionNodeAndOpenStepOutput(page: Page): Promise<void> {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/organization details/i.test(bodyText) || /organization administrators/i.test(bodyText)) {
    return;
  }

  await clickRowOrToggle(page, /^sre-toolbox$/i);

  const scriptStep = page.locator('tr, li, div').filter({ hasText: /^\d+\.\s+.*script$/i }).first();
  await expect(scriptStep).toBeVisible({ timeout: 15_000 });
  await clickRowOrToggle(page, /^\d+\.\s+.*script$/i);
  await page.waitForTimeout(1_000);
}

async function waitForExecutionOutput(page: Page): Promise<string> {
  const initialBodyText = await page.locator('body').innerText().catch(() => '');
  if (!extractIdsFromText(initialBodyText).organizationIds.length) {
    await expandExecutionNodeAndOpenStepOutput(page).catch(() => undefined);
  }

  await expect
    .poll(
      async () => {
        const bodyText = await page.locator('body').innerText();
        const parsed = extractIdsFromText(bodyText);
        return JSON.stringify(parsed);
      },
      {
        timeout: EXECUTION_TIMEOUT_MS,
        intervals: [1_000, 2_000, 5_000]
      }
    )
    .not.toBe(JSON.stringify({ organizationIds: [], tenants: [] }));

  return page.locator('body').innerText();
}

async function waitForAuthenticatedRundeckPage(page: Page, expectedPath: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const currentUrl = page.url();
        if (!currentUrl) {
          return false;
        }

        try {
          const parsed = new URL(currentUrl);
          const bodyText = await page.locator('body').innerText().catch(() => '');

          return (
            parsed.origin === new URL(getConfig().baseUrl).origin &&
            parsed.pathname.includes(expectedPath) &&
            !/login|signin|authenticate|oauth|saml/i.test(parsed.pathname) &&
            !/sign in|log in|login/i.test(bodyText)
          );
        } catch {
          return false;
        }
      },
      {
        timeout: MANUAL_LOGIN_TIMEOUT_MS,
        intervals: [1_000, 2_000, 5_000],
        message: `If Microsoft login appears, complete SSO in the opened browser window within ${MANUAL_LOGIN_TIMEOUT_MS / 60_000} minutes.`
      }
    )
    .toBe(true);
}

async function createRunContext(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  return connectToBrowser();
}

test('run Acloud-Get-Account-Details-SUPPORT and extract IDs', async () => {
  const { baseUrl } = getConfig();
  const { cloudOrg, ticketNumber } = getJobInputs();
  const jobUrl = buildUrl(baseUrl, getAcloudJobPath());
  const debugPausePoints = getDebugPausePoints();

  await ensureDirectories();
  const { page } = await createRunContext();

  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
    await waitForAuthenticatedRundeckPage(page, getAcloudJobPath());
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page).toHaveURL(new RegExp(escapeRegExp(getAcloudJobPath())));
    await expect(page.locator('body')).toContainText(/Acloud-Get-Account-Details-SUPPORT/i);

    await fillJobOption(page, /^value$/i, 'value', cloudOrg);
    await fillJobOption(page, /^reason$/i, 'reason', ticketNumber);
    await pauseIfRequested(page, debugPausePoints, 'before-run');

    await startJobRun(page);
    await pauseIfRequested(page, debugPausePoints, 'after-run');

    await expect(page.locator('body')).not.toContainText(/unauthorized|permission denied/i, {
      timeout: 10_000
    });

    await openExecutionOutput(page);
    await pauseIfRequested(page, debugPausePoints, 'execution-page');

    const outputText = await waitForExecutionOutput(page);
    await pauseIfRequested(page, debugPausePoints, 'output-page');
    const parsedIds = extractIdsFromText(outputText);

    if (!parsedIds.organizationIds.length || !parsedIds.tenants.length) {
      throw new Error(
        `Execution completed but expected IDs were not found. Parsed result: ${JSON.stringify(parsedIds)}`
      );
    }

    const screenshotPath = await captureScreenshot(page, 'acloud-account-details-output.png');
    const result: JobResult = {
      cloudOrg,
      ticketNumber,
      jobUrl,
      organizationIds: parsedIds.organizationIds,
      tenants: parsedIds.tenants
    };

    console.log(formatCopyPasteResult(result));

    test.info().annotations.push(
      { type: 'jobUrl', description: jobUrl },
      { type: 'screenshot', description: screenshotPath },
      { type: 'result', description: JSON.stringify(result) }
    );
  } catch (error) {
    const screenshotPath = await captureScreenshot(page, 'acloud-account-details-error.png').catch(() => '');
    throw new Error(
      `Running Acloud-Get-Account-Details-SUPPORT failed for "${cloudOrg}" and ticket "${ticketNumber}" using CDP endpoint ${getCdpUrl()}. ${formatError(error)}${
        screenshotPath ? ` Screenshot: ${screenshotPath}` : ''
      }`
    );
  } finally {
    await page.close().catch(() => undefined);
  }
});
