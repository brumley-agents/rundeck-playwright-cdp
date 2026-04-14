import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { getOptionalBrowserChannel, getOptionalBrowserExecutablePath } from './src/config';

dotenv.config({ quiet: true });

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
