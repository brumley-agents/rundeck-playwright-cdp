import fs from 'fs';
import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { getOptionalBrowserChannel, getOptionalBrowserExecutablePath } from './src/config';

function loadDotEnvFile(): void {
  const envFilePath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvFile();

const browserChannel = getOptionalBrowserChannel();
const browserExecutablePath = getOptionalBrowserExecutablePath();

const browserUse = {
  ...devices['Desktop Chrome'],
  ...(browserChannel ? { channel: browserChannel } : {}),
  ...(browserExecutablePath
    ? {
        launchOptions: {
          executablePath: browserExecutablePath
        }
      }
    : {})
};

export default defineConfig({
  testDir: './src',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: process.env.RUNDECK_BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...browserUse
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /(openRundeck|runAcloudGetAccountDetails)\.ts/
    }
  ]
});
