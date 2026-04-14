import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const AUTH_DIR = path.resolve(process.cwd(), 'auth');
export const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');
export const DEFAULT_ACLOUD_JOB_PATH =
  '/project/UiPath/job/show/ee31ce10-2b66-48a5-97c6-b88eb1364987';

type RequiredConfig = {
  baseUrl: string;
  targetPath: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeTargetPath(rawPath: string): string {
  if (/^https?:\/\//i.test(rawPath)) {
    throw new Error('RUNDECK_TARGET_PATH must be a relative path, not a full URL.');
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
}

function normalizeBrowserPath(rawPath: string | undefined): string | undefined {
  const value = rawPath?.trim();
  if (!value) {
    return undefined;
  }

  if (process.platform === 'win32') {
    return /^[A-Za-z]:\\/.test(value) ? value : undefined;
  }

  return value.startsWith('/') ? value : undefined;
}

export function getConfig(): RequiredConfig {
  return {
    baseUrl: getRequiredEnv('RUNDECK_BASE_URL').replace(/\/+$/, ''),
    targetPath: normalizeTargetPath(getRequiredEnv('RUNDECK_TARGET_PATH'))
  };
}

export function getAcloudJobPath(): string {
  const configuredPath = process.env.RUNDECK_ACLOUD_JOB_PATH?.trim();
  return normalizeTargetPath(configuredPath || DEFAULT_ACLOUD_JOB_PATH);
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getOptionalBrowserChannel(): string | undefined {
  return getOptionalEnv('RUNDECK_BROWSER_CHANNEL');
}

export function getOptionalBrowserExecutablePath(): string | undefined {
  return normalizeBrowserPath(process.env.RUNDECK_BROWSER_EXECUTABLE_PATH);
}

export function getCdpHost(): string {
  return getOptionalEnv('RUNDECK_CDP_HOST') || '127.0.0.1';
}

export function getCdpPort(): number {
  const rawValue = getOptionalEnv('RUNDECK_CDP_PORT');
  if (!rawValue) {
    return 9222;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid RUNDECK_CDP_PORT value: ${rawValue}`);
  }

  return parsed;
}

export function getCdpUrl(): string {
  return `http://${getCdpHost()}:${getCdpPort()}`;
}

