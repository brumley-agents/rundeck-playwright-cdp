# Rundeck Playwright CDP

Automates the Rundeck `Acloud-Get-Account-Details-SUPPORT` job by attaching to an already-open Edge or Chrome browser via Chrome DevTools Protocol (CDP). This preserves your login session between runs — no need to re-authenticate each time.

> **Why CDP?** There is a known SSO issue where fresh browser windows fail to authenticate. By keeping one browser session open and connecting to it via CDP, we sidestep this entirely.

## Quick Links

- [START_HERE.md](START_HERE.md) — Which doc to read first
- [docs/QUICK_START.md](docs/QUICK_START.md) — Day-to-day user guide
- [docs/HANDOFF.md](docs/HANDOFF.md) — Rollout guide for onboarding new users
- [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md) — Full technical setup and troubleshooting

## Prerequisites

- **Windows** (scripts use PowerShell)
- **Node.js** v18+ ([download](https://nodejs.org/))
- **Microsoft Edge** or **Google Chrome**
- **Rundeck access** (you must be able to log in via SSO)

## Setup

### 1. Clone and install

```powershell
git clone https://github.com/brumley-agents/rundeck-playwright-cdp.git
cd rundeck-playwright-cdp
npm install
```

### 2. Configure environment

```powershell
Copy-Item .env.example .env
```

Open `.env` and set **at minimum** these two required values:

```dotenv
RUNDECK_BASE_URL=https://rundeck.your-company.com
RUNDECK_TARGET_PATH=/project/UiPath/jobs
```

See `.env.example` for all available options with descriptions.

### 3. Start a CDP browser

```powershell
npm run browser:edge:start
```

Or for Chrome:

```powershell
npm run browser:chrome:start
```

This opens a dedicated browser window with remote debugging enabled on port 9222. It uses an isolated profile under `auth/` so it does not interfere with your daily browser.

### 4. Sign in to Rundeck

In the browser window that just opened, complete SSO login. **Leave this window open** — it is your persistent session.

### 5. Verify CDP connectivity

```powershell
npm run browser:status
```

Expected output:

```
CDP reachable at http://127.0.0.1:9222/json/version
```

## Usage

### Run the account lookup

Set the org and ticket via environment variables:

```powershell
$env:RUNDECK_CLOUD_ORG = "https://cloud.uipath.com/adapthealth"
$env:RUNDECK_TICKET_NUMBER = "02830062"
npm run rundeck:acloud:get-account-details
```

Or put them in your `.env` file:

```dotenv
RUNDECK_CLOUD_ORG=https://cloud.uipath.com/adapthealth
RUNDECK_TICKET_NUMBER=02830062
```

Then just run:

```powershell
npm run rundeck:acloud:get-account-details
```

> **Tip:** You can paste a full UiPath Cloud URL or just the org slug — `https://cloud.uipath.com/adapthealth` and `adapthealth` both work.

### Use the GUI launcher

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch-rundeck-account-details.ps1
```

This opens a small form where you enter the cloud org and ticket number, then click "Run Job."

### Smoke test (open Rundeck page)

```powershell
npm run rundeck:open
```

Verifies that CDP is connected and Rundeck is authenticated.

## Example Output

```
URL: https://rundeck.example.com/project/UiPath/job/show/ee31ce10-...
ORG Name: adapthealth
ORG ID: fb87fce2-f3b5-4235-be77-1cb2a544101e
TENANTS:
1b457298-42bc-46e1-aed6-79b111d728b9 | DefaultTenant
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Failed to connect to CDP browser` | Is the CDP browser still open? Run `npm run browser:edge:start` again. |
| `npm run browser:status` fails | Browser was closed or crashed. Restart it. |
| `Missing cloud org` | Set `RUNDECK_CLOUD_ORG` in `.env` or as an env var before running. |
| SSO login prompt hangs | Complete SSO manually in the open CDP browser window within 10 minutes. |
| `Job completed but no IDs found` | The Rundeck job may have failed. Check the screenshot in `screenshots/`. |
| `Permission denied` / `Unauthorized` | Your Rundeck account may lack access to this job. |

## Project Structure

```
src/
  browser.ts          CDP connection with retry logic
  config.ts           Environment variable handling
  openRundeck.ts      Smoke test (verify auth)
  runAcloudGetAccountDetails.ts   Main job runner + output parser
  utils.ts            Shared helpers
scripts/
  start-browser.ps1   Launch Edge/Chrome with CDP
  browser-status.ps1  Check CDP connectivity
  launch-rundeck-account-details.ps1   GUI launcher (WinForms)
  run-playwright-job.ps1               Bridge script for launcher
```

## Outputs

- **Screenshots:** `screenshots/`
- **Playwright traces on failure:** `test-results/`
- **Launcher logs:** `auth/launcher.log`
