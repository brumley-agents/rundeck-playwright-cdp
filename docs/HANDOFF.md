# Rundeck Account Lookup Handoff

This is the single-file handoff for teams that need to set up and run the Rundeck account lookup with minimal trial and error.

If you only share one document with a new user, use this one.

Related documents:

- [QUICK_START.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/QUICK_START.md)
- [IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md)

## What This Tool Does

This tool runs the Rundeck job `Acloud-Get-Account-Details-SUPPORT` and extracts:

- logical org name
- organization ID
- tenant ID or IDs
- tenant names

It uses Playwright, but instead of opening a brand-new browser every run, it attaches to an already-open Edge or Chrome window through Chrome DevTools Protocol (CDP).

That is the main thing new users usually miss.

The browser must be started in CDP mode first, and that browser window must stay open while the job runs.

## Why Setup Sometimes Feels Complicated

Most failures come from one of these:

1. The browser was not started with CDP enabled.
2. The user signed into the wrong browser window.
3. `browser:status` was not checked before the run.
4. The environment variables in `.env` were not set correctly.
5. The user pasted a full cloud URL into a field that expected a logical org name.

This repository now handles the cloud URL normalization automatically, but the CDP/browser setup still has to be correct.

## What a New User Needs

Before the first run, the user needs:

- a Windows machine
- Node.js installed
- Microsoft Edge or Google Chrome installed
- access to Rundeck
- this repo available locally
- a valid `.env` file

Recommended local path:

```text
C:\Users\<your-user>\rundeck-playwright-cdp
```

## Minimum One-Time Setup

Open PowerShell in the project folder:

```powershell
cd C:\Users\<your-user>\rundeck-playwright-cdp
```

Install dependencies:

```powershell
npm install
```

Create `.env`:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and confirm these values are correct:

- `RUNDECK_BASE_URL`
- `RUNDECK_TARGET_PATH`
- `RUNDECK_ACLOUD_JOB_PATH`
- `RUNDECK_BROWSER`
- `RUNDECK_CDP_HOST`
- `RUNDECK_CDP_PORT`
- `RUNDECK_EDGE_EXECUTABLE_PATH`
- `RUNDECK_CHROME_EXECUTABLE_PATH`

Typical example:

```env
RUNDECK_BASE_URL=https://rundeck.uipath.com
RUNDECK_TARGET_PATH=/project/UiPath/jobs/Windows/SRE-Toolbox/Acloud
RUNDECK_ACLOUD_JOB_PATH=/project/UiPath/job/show/ee31ce10-2b66-48a5-97c6-b88eb1364987
RUNDECK_BROWSER=edge
RUNDECK_CDP_HOST=127.0.0.1
RUNDECK_CDP_PORT=9222
```

## The Actual Daily Workflow

This is the simplest repeatable path for users.

### Step 1. Start the CDP Browser

Edge:

```powershell
npm run browser:edge:start
```

Chrome:

```powershell
npm run browser:chrome:start
```

What this does:

- starts a browser with remote debugging enabled
- opens Rundeck
- gives Playwright a browser session it can attach to later

### Step 2. Sign In to Rundeck

In the browser window that just opened:

1. Complete SSO.
2. Confirm you can reach Rundeck.
3. Leave that exact browser window open.

If the user signs into some other browser window, the automation may fail even though the user thinks they are logged in.

### Step 3. Verify CDP Before Running Anything

Run:

```powershell
npm run browser:status
```

Expected pattern:

```text
CDP reachable at http://127.0.0.1:9222/json/version
Browser: Edg/...
WebSocket: ws://127.0.0.1:9222/devtools/browser/...
```

If this check fails, the user should not continue yet.

### Step 4. Use the Launcher

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch-rundeck-account-details.ps1
```

This is the easiest supported user path.

The launcher gives the user:

- a field for `Cloud URL / Cloud Org`
- a field for `Ticket Number`
- a `Start Edge CDP` button
- a `Check CDP` button
- a `Run Job` button
- a live output area

### Step 5. Enter the Request Details

Valid examples for `Cloud URL / Cloud Org`:

- `https://cloud.uipath.com/adapthealth`
- `adapthealth`

Valid example for `Ticket Number`:

- `02830062`

The code now normalizes a full cloud URL to the logical org automatically.

### Step 6. Run the Job

Click:

- `Run Job`

Wait for the results in the output window.

## What Success Looks Like

Example output:

```text
ORG Name: adapthealth
ORG ID: fb87fce2-f3b5-4235-be77-1cb2a544101e
TENANTS:
1b457298-42bc-46e1-aed6-79b111d728b9 | DefaultTenant
```

Success example screenshot:

![Successful lookup output](../screenshots/acloud-account-details-output.png)

## What Failure Looks Like

Example failure pattern:

- the job starts
- Rundeck runs
- the output says it cannot find organization data

Failure example screenshot:

![Failure example](../screenshots/acloud-account-details-error.png)

## The Fastest Troubleshooting Checklist

When a user says "it does not work," have them answer these in order:

1. Did you start the browser with `npm run browser:edge:start` or `npm run browser:chrome:start`?
2. Did `npm run browser:status` succeed immediately before the run?
3. Did you sign into Rundeck in the same browser window started by the tool?
4. Is that CDP browser window still open?
5. Did you enter the correct cloud URL or org value?
6. Did you enter the correct ticket number?

If the answer to any of the first four is no, that is usually the real issue.

## What To Tell Users Up Front

If you want adoption to go smoothly, tell users these four things explicitly:

1. Do not use a random existing browser window. Start the browser with the provided command.
2. Do not close the CDP browser window before the run finishes.
3. Always run `npm run browser:status` if anything looks wrong.
4. You can paste either the full cloud URL or just the org slug.

Those four points eliminate most confusion.

## Recommended Rollout Instructions

When handing this tool to another team, give them:

1. This handoff doc.
2. A pre-reviewed `.env` template for their environment.
3. One known-good sample input.
4. One known-good expected output.
5. The escalation path if CDP or auth fails.

Without those, new users tend to spend time debugging local setup instead of using the tool.

## Suggested Internal Support Model

For a clean rollout, separate support into two levels.

User-level issues:

- how to start the browser
- how to launch the tool
- what input to paste
- whether the browser is still connected

Maintainer-level issues:

- selectors changed in Rundeck
- CDP attach failures
- Playwright or Node issues
- `.env` path or browser-path issues
- job output parsing changes

## Files to Collect When Escalating

If a user still cannot run the tool, ask for:

- the input they used
- whether `npm run browser:status` worked
- the latest screenshot from [screenshots/](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/screenshots)
- the latest files under [test-results/](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/test-results)
- [auth/launcher.log](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/auth/launcher.log)

## Primary References

- [QUICK_START.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/QUICK_START.md)
- [IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md)
- [scripts/launch-rundeck-account-details.ps1](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/scripts/launch-rundeck-account-details.ps1)
- [src/runAcloudGetAccountDetails.ts](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/src/runAcloudGetAccountDetails.ts)
