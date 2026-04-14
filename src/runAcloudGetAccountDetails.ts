import { expect, test, type Page } from '@playwright/test';
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

type TailExecutionOutput = {
  completed?: boolean;
  execCompleted?: boolean;
  entries?: Array<{
    log?: string;
  }>;
};

type DebugPausePoint = 'before-run' | 'after-run' | 'execution-page' | 'output-page';

const EXECUTION_TIMEOUT_MS = 180_000;
const MANUAL_LOGIN_TIMEOUT_MS = 10 * 60_000;
const POST_RUN_NAVIGATION_TIMEOUT_MS = 20_000;
test.setTimeout(EXECUTION_TIMEOUT_MS + 30_000);

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
  const cloudOrg = normalizeCloudOrg(getOptionalEnv('RUNDECK_CLOUD_ORG') || '');
  const ticketNumber = getOptionalEnv('RUNDECK_TICKET_NUMBER');

  if (!cloudOrg) {
    throw new Error(
      'Missing cloud org. Set RUNDECK_CLOUD_ORG in .env or pass it as an environment variable.'
    );
  }

  if (!ticketNumber) {
    throw new Error(
      'Missing ticket number. Set RUNDECK_TICKET_NUMBER in .env or pass it as an environment variable.'
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

      tenants.push({
        id: ids[1],
        ...(tenantName ? { name: tenantName } : {})
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

  const navigationResult = await Promise.race([
    page
      .waitForURL(
        (url) => {
          const currentUrl = url.toString();
          return currentUrl !== startingUrl && /\/execution\/(show|follow|output)\//i.test(currentUrl);
        },
        { timeout: POST_RUN_NAVIGATION_TIMEOUT_MS }
      )
      .then(() => 'navigated' as const)
      .catch(() => undefined),
    page
      .locator('a[href*="/execution/output/"], a[href*="/execution/follow/"], a[href*="/execution/show/"]')
      .first()
      .waitFor({ state: 'visible', timeout: POST_RUN_NAVIGATION_TIMEOUT_MS })
      .then(() => 'link-visible' as const)
      .catch(() => undefined)
  ]);

  if (!navigationResult) {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hint = /error|denied|failed/i.test(bodyText)
      ? ` Page body contains error text: "${bodyText.slice(0, 200)}"`
      : '';
    throw new Error(
      `Job run button was clicked but no execution page or link appeared within ${POST_RUN_NAVIGATION_TIMEOUT_MS / 1_000}s. ` +
      `The job may not have started.${hint}`
    );
  }
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

function getExecutionIdFromUrl(url: string): string | undefined {
  const match = url.match(/\/execution\/(?:show|follow|output)\/(\d+)/i);
  return match?.[1];
}

async function getExecutionId(page: Page): Promise<string | undefined> {
  const fromUrl = getExecutionIdFromUrl(page.url());
  if (fromUrl) {
    return fromUrl;
  }

  const execInfoText = await page.locator('#execInfoJSON').textContent().catch(() => '');
  if (!execInfoText) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(execInfoText) as { execId?: string | number };
    return parsed.execId ? String(parsed.execId) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchTailExecutionOutput(page: Page, executionId: string): Promise<TailExecutionOutput> {
  if (!/^\d+$/.test(executionId)) {
    throw new Error(`Invalid execution ID (expected numeric): ${executionId}`);
  }

  return page.evaluate(async (id) => {
    const response = await fetch(`/execution/tailExecutionOutput/${id}.json`, {
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`Failed to load tail execution output for ${id}: HTTP ${response.status}`);
    }

    return response.json();
  }, executionId);
}

async function waitForExecutionOutput(page: Page): Promise<string> {
  const executionId = await getExecutionId(page);
  if (!executionId) {
    throw new Error(`Could not determine execution id from page URL: ${page.url()}`);
  }

  let capturedOutput = '';
  let jobCompleted = false;

  await expect
    .poll(
      async () => {
        const tailOutput = await fetchTailExecutionOutput(page, executionId);
        capturedOutput = (tailOutput.entries || [])
          .map((entry) => entry.log || '')
          .join('\n');
        jobCompleted = !!(tailOutput.completed || tailOutput.execCompleted);

        const parsed = extractIdsFromText(capturedOutput);
        const foundIds = parsed.organizationIds.length > 0 && parsed.tenants.length > 0;

        if (jobCompleted && !foundIds) {
          throw new Error(
            'Rundeck job completed but no organization IDs or tenants were found in the output. ' +
            'The job may have failed or produced unexpected output.'
          );
        }

        return foundIds;
      },
      {
        timeout: EXECUTION_TIMEOUT_MS,
        intervals: [1_000, 2_000, 5_000]
      }
    )
    .toBe(true);

  return capturedOutput;
}

async function waitForAuthenticatedRundeckPage(page: Page, expectedPath: string): Promise<void> {
  const expectedOrigin = new URL(getConfig().baseUrl).origin;

  await expect
    .poll(
      async () => {
        const currentUrl = page.url();
        if (!currentUrl) {
          return false;
        }

        try {
          const parsed = new URL(currentUrl);
          if (parsed.origin !== expectedOrigin || !parsed.pathname.includes(expectedPath)) {
            return false;
          }

          if (/login|signin|authenticate|oauth|saml/i.test(parsed.pathname)) {
            return false;
          }

          const bodyText = await page.locator('body').innerText().catch(() => '');
          return !/sign in|log in|login/i.test(bodyText);
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

test('run Acloud-Get-Account-Details-SUPPORT and extract IDs', async () => {
  const { baseUrl } = getConfig();
  const { cloudOrg, ticketNumber } = getJobInputs();
  const jobUrl = buildUrl(baseUrl, getAcloudJobPath());
  const debugPausePoints = getDebugPausePoints();

  await ensureDirectories();
  const { page } = await connectToBrowser();

  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
    await waitForAuthenticatedRundeckPage(page, getAcloudJobPath());

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
    const { organizationIds, tenants } = extractIdsFromText(outputText);

    const screenshotPath = await captureScreenshot(page, 'acloud-account-details-output.png');
    const result: JobResult = {
      cloudOrg,
      ticketNumber,
      jobUrl,
      organizationIds,
      tenants
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
