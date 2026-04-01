# Rundeck Playwright CDP Implementation Guide

Quick start for non-technical users: [QUICK_START.md](../docs/QUICK_START.md)

This guide is for users who need to run the Rundeck Playwright automation in their own environment with the least amount of guesswork.

It covers:

- what this project does
- what must exist on the target machine
- how to configure the environment
- how to start the browser in CDP mode
- how to validate connectivity
- how to run the single-ticket account lookup
- common failure modes and how to fix them

## What This Project Does

This project attaches Playwright to an already-open Edge or Chrome session through Chrome DevTools Protocol (CDP).

That matters because:

- the browser session stays open between runs
- your Rundeck login can remain active
- you do not need Playwright to launch and close a fresh browser every time

The main single-ticket workflow is the Rundeck job:

- `Acloud-Get-Account-Details-SUPPORT`

The project can also:

- open a configured Rundeck page to validate browser/session access

## Supported Environment

This repository is currently Windows-first.

The included startup and launcher scripts assume:

- Windows PowerShell is available
- Edge or Chrome is installed on Windows
- the browser can be started with `--remote-debugging-port=9222`

WSL can be used to edit files and inspect the repo, but the actual browser startup and Playwright CDP execution should be treated as Windows commands.

## Prerequisites

Install or verify the following before you start:

1. Node.js
2. npm
3. Microsoft Edge or Google Chrome
4. Access to your Rundeck instance
5. Permission to sign in through your normal SSO flow

Recommended versions:

- Node 20+ or newer
- Current Edge or Chrome

## Project Layout

Files most users need to care about:

- [package.json](../package.json)
- [.env.example](../.env.example)
- [scripts/start-browser.ps1](../scripts/start-browser.ps1)
- [scripts/browser-status.ps1](../scripts/browser-status.ps1)
- [scripts/launch-rundeck-account-details.ps1](../scripts/launch-rundeck-account-details.ps1)
- [src/openRundeck.ts](../src/openRundeck.ts)
- [src/runAcloudGetAccountDetails.ts](../src/runAcloudGetAccountDetails.ts)

## Setup

### 1. Clone the Repository

Use your normal Git workflow to place the repo somewhere on your Windows machine, for example:

```text
C:\Users\<your-user>\rundeck-playwright-cdp
```

### 2. Install Dependencies

From the project root:

```powershell
npm install
```

### 3. Create Your `.env`

Copy the example file:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`.

Minimum values to review:

- `RUNDECK_BASE_URL`
- `RUNDECK_TARGET_PATH`
- `RUNDECK_ACLOUD_JOB_PATH`
- `RUNDECK_BROWSER`
- `RUNDECK_CDP_PORT`
- `RUNDECK_EDGE_EXECUTABLE_PATH`
- `RUNDECK_CHROME_EXECUTABLE_PATH`

Example:

```env
RUNDECK_BASE_URL=https://rundeck.uipath.com
RUNDECK_TARGET_PATH=/project/UiPath/jobs/Windows/SRE-Toolbox/Acloud
RUNDECK_ACLOUD_JOB_PATH=/project/UiPath/job/show/ee31ce10-2b66-48a5-97c6-b88eb1364987
RUNDECK_BROWSER=edge
RUNDECK_CDP_HOST=127.0.0.1
RUNDECK_CDP_PORT=9222
RUNDECK_BROWSER_PROFILE_DIRECTORY=Default
RUNDECK_EDGE_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
RUNDECK_CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

## Important Input Rule

For the account-details job, users often paste a full UiPath Cloud URL such as:

```text
https://cloud.uipath.com/adapthealth
```

This project now normalizes that automatically to:

```text
adapthealth
```

That normalized logical org name is what the Rundeck job expects in the `Value` field.

Users can provide either:

- the logical org name, such as `adapthealth`
- the full cloud URL, such as `https://cloud.uipath.com/adapthealth`

Both are accepted by the current code.

## Starting the Browser in CDP Mode

You must start a dedicated Edge or Chrome session with remote debugging enabled.

If you skip this step, Playwright will fail to attach.

Start Edge:

```powershell
npm run browser:edge:start
```

Or start Chrome:

```powershell
npm run browser:chrome:start
```

What this does:

- opens a new browser window
- enables CDP on port `9222` by default
- uses a dedicated user-data directory under `auth/`

Why that matters:

- it avoids interfering with your main daily browser profile
- it gives Playwright a stable session to reconnect to

## Sign In to Rundeck Once

After the CDP browser starts:

1. Let the browser open the Rundeck base URL.
2. Complete your Microsoft or SSO login if prompted.
3. Confirm that you can manually browse to the target Rundeck page.
4. Leave that browser window open.

Do not close that browser window before running the Playwright job.

## Validate CDP Connectivity

Before running the job, verify that Playwright can still see the browser:

```powershell
npm run browser:status
```

Expected output pattern:

```text
CDP reachable at http://127.0.0.1:9222/json/version
Browser: Edg/...
WebSocket: ws://127.0.0.1:9222/devtools/browser/...
```

If this command fails, stop there and fix CDP before attempting the job run.

## Quick Smoke Test

To confirm the browser can open the configured Rundeck page:

```powershell
npm run rundeck:open
```

This verifies:

- the browser is reachable through CDP
- your Rundeck session is still authenticated
- the configured target page can be loaded

## Run the Account Details Job

There are two practical ways to run the single-ticket flow.

### Option 1. Use the PowerShell Launcher

This is the easiest path for most users:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch-rundeck-account-details.ps1
```

The launcher provides:

- a text box for Cloud URL or Cloud Org
- a text box for Ticket Number
- a button to start Edge CDP
- a button to check CDP
- a button to run the job
- a live output area

Recommended inputs:

- Cloud URL / Cloud Org: `https://cloud.uipath.com/adapthealth`
- Ticket Number: `02830062`

### Option 2. Run Through npm With Environment Variables

If you prefer terminal-only usage, set values in `.env`:

```env
RUNDECK_CLOUD_ORG=https://cloud.uipath.com/adapthealth
RUNDECK_TICKET_NUMBER=02830062
```

Then run:

```powershell
npm run rundeck:acloud:get-account-details
```

## Expected Successful Result

On a good run, the script opens the Rundeck execution output, waits for the script output, and extracts:

- organization ID
- tenant IDs
- tenant names

Example successful result from a real run:

```text
URL: https://rundeck.uipath.com/project/UiPath/job/show/ee31ce10-2b66-48a5-97c6-b88eb1364987
ORG Name: adapthealth
ORG ID: fb87fce2-f3b5-4235-be77-1cb2a544101e
TENANTS:
1b457298-42bc-46e1-aed6-79b111d728b9 | DefaultTenant
```

Success screenshot:

![Successful Rundeck account-details output](../screenshots/acloud-account-details-output.png)

## Example Failure Pattern

One common mistake is passing the full cloud URL directly into a Rundeck field that expects only the logical org name.

That failure looked like this:

- `Type: LogicalName`
- `Value: https://cloud.uipath.com/adapthealth`
- execution log says it cannot find the organization ID for that value

Failure screenshot:

![Failure when the full cloud URL is used as the logical name](../screenshots/acloud-account-details-error.png)

This guide’s current code already fixes that by normalizing the URL to the org slug before filling the form.

## Files Produced by the Run

Useful output locations:

- screenshots: [screenshots/](../screenshots)
- test artifacts: [test-results/](../test-results)
- launcher state: [auth/launcher-state.json](../auth/launcher-state.json)
- launcher log: [auth/launcher.log](../auth/launcher.log)

When a test fails, inspect:

- the latest screenshot in `screenshots/`
- the latest Playwright trace in `test-results/`
- the launcher logs if you used the GUI launcher

## Troubleshooting

### `CDP not reachable at http://127.0.0.1:9222/json/version`

Cause:

- the browser was not started with remote debugging
- the CDP browser was closed
- the port changed

Fix:

1. Run `npm run browser:edge:start`.
2. Leave that browser window open.
3. Run `npm run browser:status` again.

### `connect ECONNREFUSED 127.0.0.1:9222`

Cause:

- Edge or Chrome is still open, but not the debuggable instance
- the debuggable browser exited after launch

Fix:

1. Start a fresh CDP browser session with the provided script.
2. Confirm `browser:status` succeeds.
3. Retry the Playwright command.

### `playwright is not recognized as an internal or external command`

Cause:

- Playwright is not installed locally
- npm did not create the expected local binaries
- a wrapper environment is invoking the command differently

Fix:

1. Run `npm install`.
2. Retry `npm run rundeck:acloud:get-account-details`.
3. If your environment still fails, run through the provided PowerShell launcher, which resolves Node and the Playwright CLI path more defensively.

### PowerShell says script execution is disabled

Cause:

- your local execution policy blocks script loading

Fix:

Use the included commands exactly as written because they already specify:

```text
-ExecutionPolicy Bypass
```

If your environment still blocks execution, work with your local Windows policy or admin restrictions.

### The test times out after a few minutes

Cause:

- Rundeck job execution stalled
- the output page structure changed
- the job returned an unexpected format

Fix:

1. Open the failure screenshot.
2. Open the Playwright trace from `test-results/`.
3. Confirm whether the job itself failed or whether the parser could not find the expected IDs.

### Login page appears instead of Rundeck job output

Cause:

- your SSO session expired

Fix:

1. Reuse the same CDP browser window.
2. Sign in again manually.
3. Leave the window open.
4. Rerun the command.

## Recommended User Workflow

For the smoothest day-to-day usage:

1. Open PowerShell in the project root.
2. Run `npm run browser:edge:start`.
3. Sign into Rundeck once.
4. Leave the browser window open.
5. Use `launch-rundeck-account-details.ps1` for repeated ticket lookups.
6. Only restart the browser if `browser:status` stops working.

## Commands Reference

Install dependencies:

```powershell
npm install
```

Build TypeScript:

```powershell
npm run build
```

Check types:

```powershell
npm run typecheck
```

Start Edge CDP:

```powershell
npm run browser:edge:start
```

Start Chrome CDP:

```powershell
npm run browser:chrome:start
```

Check CDP:

```powershell
npm run browser:status
```

Open configured Rundeck page:

```powershell
npm run rundeck:open
```

Run single account-details lookup:

```powershell
npm run rundeck:acloud:get-account-details
```

## Notes for Maintainers

If you hand this project to another user or team, make sure they receive:

- a working `.env`
- confirmed browser executable paths
- the exact Rundeck job path
- expected sample inputs
- one known-good success screenshot
- one known failure screenshot

Without those, most setup failures get misdiagnosed as Playwright problems when they are actually CDP or environment configuration problems.
