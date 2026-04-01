# Rundeck Playwright CDP

Start here: [START_HERE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/START_HERE.md)

Implementation guide for end users: [docs/IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md)

Quick start for day-to-day users: [docs/QUICK_START.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/QUICK_START.md)

Single-file rollout handoff: [docs/HANDOFF.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/HANDOFF.md)

Separate project based on `rundeck-playwright`, but designed to attach to an already-open Edge or Chrome session through Chrome DevTools Protocol (CDP).

This avoids closing your browser every time you want to run the Rundeck tool.

## Important Constraint

Playwright cannot attach to an arbitrary normal browser window after the fact.

The browser must already be running with a remote debugging port, for example:

- Edge with `--remote-debugging-port=9222`
- Chrome with `--remote-debugging-port=9222`

The easiest pattern is to keep one debuggable browser session open all day and let this project attach to it whenever needed.
By default, the included start scripts use a dedicated persistent profile under `auth/`, so they do not need to take over your normal daily browser profile.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and adjust values if needed.

3. Start a debuggable browser session:

   ```powershell
   npm run browser:edge:start
   ```

   Or:

   ```powershell
   npm run browser:chrome:start
   ```

4. Sign into Rundeck in that browser window once and leave the browser open.

5. Check CDP connectivity if needed:

   ```powershell
   npm run browser:status
   ```

## Usage

Open the configured Rundeck page in a new tab of the already-open debuggable browser:

```powershell
npm run rundeck:open
```

Run the `Acloud-Get-Account-Details-SUPPORT` job in that same browser session:

```powershell
npm run rundeck:acloud:get-account-details -- --cloud-org "<cloud-org>" --ticket "<ticket-number>"
```

You can also place `RUNDECK_CLOUD_ORG` and `RUNDECK_TICKET_NUMBER` in `.env`.

If users paste a full UiPath Cloud URL like `https://cloud.uipath.com/adapthealth`, the tool normalizes that automatically to the logical org value `adapthealth` before filling the Rundeck form.

## Recommended Browser Pattern

If you want this to work while your browser stays open:

1. Start Edge or Chrome once with the provided start script.
2. Sign in to Rundeck in that browser.
3. Leave that browser window open.
4. Run the Playwright commands whenever needed.

That gives you a persisted session without requiring the Playwright run to take over your primary browser profile.
If you really want to attach to a specific existing browser profile, set `RUNDECK_EDGE_USER_DATA_DIR` or `RUNDECK_CHROME_USER_DATA_DIR`, but that is more fragile because of profile locking.

## Outputs

- Screenshots: `screenshots/`
- Playwright traces on failure: `test-results/`
