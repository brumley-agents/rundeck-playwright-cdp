# Rundeck Account Lookup User Guide

This document is the short business-facing handoff for users who only need to run the Rundeck account lookup.

Full technical setup guide: [IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md)

## Purpose

Use this tool to run the Rundeck `Acloud-Get-Account-Details-SUPPORT` job and pull account information for a customer org.

Typical inputs:

- UiPath Cloud URL, such as `https://cloud.uipath.com/adapthealth`
- support ticket number, such as `02830062`

Typical output:

- logical org name
- organization ID
- tenant ID or IDs
- tenant names

## Who This Is For

This guide is intended for:

- support engineers
- operations users
- other internal users who need the lookup result but do not need to modify the code

## What You Need

Before first use, confirm you have:

- a Windows machine
- access to the shared project folder or repository
- Node.js installed
- Microsoft Edge or Google Chrome installed
- access to Rundeck
- a configured `.env` file in the project root

If any of those are missing, use the full guide or contact the team that owns this automation.

## One-Time Setup

Open PowerShell in the project folder:

```powershell
cd C:\Users\<your-user>\rundeck-playwright-cdp
```

Install dependencies:

```powershell
npm install
```

Create `.env` from the template:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and confirm at least:

- `RUNDECK_BASE_URL`
- `RUNDECK_TARGET_PATH`
- `RUNDECK_ACLOUD_JOB_PATH`
- browser executable paths if they are not using default Windows locations

## Daily Steps

### 1. Start the CDP Browser

Run:

```powershell
npm run browser:edge:start
```

If your team uses Chrome instead:

```powershell
npm run browser:chrome:start
```

### 2. Sign In to Rundeck

When the browser opens:

1. Complete SSO if prompted.
2. Confirm Rundeck loads.
3. Leave that browser window open.

### 3. Confirm the Browser Session Is Reachable

Run:

```powershell
npm run browser:status
```

Expected result:

```text
CDP reachable at http://127.0.0.1:9222/json/version
```

If that check fails, do not continue until it is fixed.

### 4. Open the Launcher

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch-rundeck-account-details.ps1
```

### 5. Enter the Request Details

In the launcher window, enter:

- `Cloud URL / Cloud Org`
- `Ticket Number`

Examples:

- `https://cloud.uipath.com/adapthealth`
- `adapthealth`
- `02830062`

The tool automatically converts a full cloud URL into the logical org value expected by the Rundeck job.

### 6. Run the Job

Click:

- `Run Job`

Wait for the result to appear in the launcher output area.

## Expected Result

A successful run returns data like:

```text
ORG Name: adapthealth
ORG ID: fb87fce2-f3b5-4235-be77-1cb2a544101e
TENANTS:
1b457298-42bc-46e1-aed6-79b111d728b9 | DefaultTenant
```

Success example screenshot:

![Successful lookup output](../screenshots/acloud-account-details-output.png)

## Common Failure Example

If the wrong value is sent to the Rundeck job, the execution output may show that it cannot find the organization ID.

Failure example screenshot:

![Failure example](../screenshots/acloud-account-details-error.png)

## First Checks When Something Fails

Check these in order:

1. Is the CDP browser window still open?
2. Does `npm run browser:status` still succeed?
3. Are you signed in to Rundeck in that same browser window?
4. Did you enter the correct ticket number?
5. Did you paste the correct cloud URL or org value?

## FAQ

### Can I paste the full cloud URL?

Yes. The tool accepts either:

- `https://cloud.uipath.com/adapthealth`
- `adapthealth`

### Do I need to sign in every time?

No. Usually you sign in once per browser session, then leave that browser window open.

### Can I close the browser after the lookup?

Yes, but if you close it, you will need to start the CDP browser again before the next run.

### What browser should I use?

Edge is the default path in this project. Chrome is also supported if your environment is configured for it.

### What should I send when asking for help?

Provide:

- the cloud URL or org value you used
- the ticket number
- whether `npm run browser:status` succeeded
- the latest screenshot from `screenshots/`
- any output shown in the launcher window

## Support

Primary technical reference:

- [IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md)

Useful files when escalating an issue:

- [scripts/launch-rundeck-account-details.ps1](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/scripts/launch-rundeck-account-details.ps1)
- [screenshots/](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/screenshots)
- [test-results/](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/test-results)
- [auth/launcher.log](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/auth/launcher.log)
