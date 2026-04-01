import fs from 'fs/promises';
import path from 'path';
import { Page } from '@playwright/test';
import { AUTH_DIR, SCREENSHOT_DIR } from './config';

export async function ensureDirectories(): Promise<void> {
  await Promise.all([
    fs.mkdir(AUTH_DIR, { recursive: true }),
    fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  ]);
}

export function buildUrl(baseUrl: string, relativePath: string): string {
  return new URL(relativePath, `${baseUrl}/`).toString();
}

export async function captureScreenshot(page: Page, fileName: string): Promise<string> {
  const outputPath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}
