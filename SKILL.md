---
name: rundeck-org-info
description: Runs the Rundeck Acloud-Get-Account-Details-SUPPORT job for a given UiPath Cloud org and ticket number, returning org ID, tenant IDs, and tenant names.
metadata:
  author: andrew.brumley@uipath.com
  version: "1.0"
---

# Rundeck Org Info Lookup

Runs the Rundeck `Acloud-Get-Account-Details-SUPPORT` job and extracts organization and tenant details for a UiPath Cloud account. Requires a persistent CDP browser session logged into Rundeck.

## Step 1 — Parse the Request

Extract two values from the engineer's message:

- **Cloud org** — a UiPath Cloud URL (e.g., `https://cloud.uipath.com/evernorth`) or just the org slug (e.g., `evernorth`). Either format works.
- **Ticket number** — a support case number (e.g., `02828637`).

If either value is missing, ask the engineer before proceeding.

## Step 2 — Verify the Tool Is Installed

Check that the skill directory exists and has dependencies installed:

```bash
ls ~/.claude/skills/rundeck-org-info/node_modules/.package-lock.json
```

If the file does not exist, tell the engineer:

> The rundeck-org-info skill is not fully set up. Run this to install dependencies:
> ```
> cd ~/.claude/skills/rundeck-org-info && npm install
> ```
> Then check that `~/.claude/skills/rundeck-org-info/.env` exists and has the correct `RUNDECK_BASE_URL` and `RUNDECK_TARGET_PATH`. See `.env.example` for reference.

Do not proceed until the tool is installed.

## Step 3 — Check CDP Browser Status

Run the browser connectivity check:

```bash
cd ~/.claude/skills/rundeck-org-info && npm run browser:status 2>&1
```

**If it succeeds** (output contains "CDP reachable"), continue to Step 4.

**If it fails**, check whether a preferred browser has already been detected. Read the `.env` file and look for `RUNDECK_BROWSER=`. If the value is `edge` or `chrome`, tell the engineer to start that specific browser:

> The CDP browser is not running. Start it and sign into Rundeck:
> ```powershell
> cd ~/.claude/skills/rundeck-org-info
> npm run browser:<detected-browser>:start
> ```
> Then sign into Rundeck in the browser window that opens, leave it open, and ask me again.

**If no browser preference is saved yet** (first run or `RUNDECK_BROWSER` is empty), run auto-detection — see Step 3a.

Do not proceed until CDP is reachable.

### Step 3a — Auto-Detect Best Browser (first run only)

If the engineer has not used this skill before (no `RUNDECK_BROWSER` set in `.env`), detect which browser works on their machine.

First, check which browsers are installed:

```bash
ls "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" 2>/dev/null && echo "EDGE_FOUND" || echo "EDGE_MISSING"
ls "/c/Program Files/Google/Chrome/Application/chrome.exe" 2>/dev/null && echo "CHROME_FOUND" || echo "CHROME_MISSING"
```

Then, for each browser that exists, try starting it and checking CDP:

**Try Edge first** (if installed):
```bash
cd ~/.claude/skills/rundeck-org-info && npm run browser:edge:start &
```
Wait 5 seconds, then:
```bash
cd ~/.claude/skills/rundeck-org-info && npm run browser:status 2>&1
```

If Edge connects, save it as the preferred browser — update `RUNDECK_BROWSER=edge` in the `.env` file. Tell the engineer: "Edge works on your machine. I've saved it as your default browser for this skill."

**If Edge fails, try Chrome** (if installed):
```bash
cd ~/.claude/skills/rundeck-org-info && npm run browser:chrome:start &
```
Wait 5 seconds, then check status again.

If Chrome connects, save `RUNDECK_BROWSER=chrome` in `.env`. Tell the engineer: "Chrome works on your machine. I've saved it as your default browser for this skill."

**If neither connects**, tell the engineer:
> I couldn't connect to either Edge or Chrome via CDP. Please check that one of them is installed and try starting the browser manually:
> ```powershell
> cd ~/.claude/skills/rundeck-org-info
> npm run browser:edge:start
> ```

Once a browser is detected and saved, this step is skipped on future runs.

## Step 4 — Run the Job

Execute the Playwright test with the extracted inputs:

```bash
cd ~/.claude/skills/rundeck-org-info && RUNDECK_CLOUD_ORG="<cloud-org>" RUNDECK_TICKET_NUMBER="<ticket-number>" node node_modules/@playwright/test/cli.js test src/runAcloudGetAccountDetails.ts 2>&1
```

Replace `<cloud-org>` and `<ticket-number>` with the actual values from Step 1.

This command typically takes 30-60 seconds to complete. Set a timeout of at least 5 minutes.

## Step 5 — Parse and Present Results

If the command exits successfully (exit code 0), parse the output. Look for lines matching this pattern:

```
URL: <job-url>
ORG Name: <org-name>
ORG ID: <uuid>
TENANTS:
<tenant-uuid> | <tenant-name>
```

Present the results to the engineer in a clean format:

> **Org:** `<org-name>`
> **Org ID:** `<org-id>`
>
> **Tenants:**
> | Tenant ID | Name |
> |-----------|------|
> | `<id>` | `<name>` |

If the engineer needs the raw copy-paste block (for pasting into a case), also provide:

```
ORG Name: <org-name>
ORG ID: <org-id>
TENANTS:
<tenant-id> | <tenant-name>
```

## Step 6 — Handle Failures

If the command fails, check the output for these patterns and advise accordingly:

| Output contains | Likely cause | Advice |
|----------------|-------------|--------|
| `Failed to connect to CDP browser` | Browser not running | "Start the CDP browser with `npm run browser:<preferred>:start` (check `RUNDECK_BROWSER` in `.env` for which browser), sign into Rundeck, then try again." |
| `sign in` or `login` in body text | Session expired | "Your Rundeck session expired. Sign in again in the CDP browser window, then try again." |
| `Job completed but no organization IDs` | Bad org input or job failed | "The Rundeck job ran but didn't return results. Double-check the cloud org value." |
| `Job run button was clicked but no execution` | Rundeck UI issue | "The job may not have started. Open Rundeck in the CDP browser and check if the job is running." |
| `permission denied` or `unauthorized` | Access issue | "Your Rundeck account may not have permission to run this job." |

If the error doesn't match any pattern, show the full output and suggest checking the screenshot at `~/.claude/skills/rundeck-org-info/screenshots/`.

## Edge Cases

- **Engineer provides multiple orgs at once:** Run them one at a time sequentially. Present each result separately.
- **Engineer provides a cloud URL with a trailing path** (e.g., `https://cloud.uipath.com/evernorth/tenant/services`): The tool normalizes this automatically — only the org slug is extracted.
- **CDP browser is running but Rundeck session expired:** The tool will wait up to 10 minutes for manual SSO login. Tell the engineer to complete login in the open browser window.
- **Engineer asks for this data but doesn't mention a ticket number:** Ask for the ticket number — it is required by the Rundeck job.
