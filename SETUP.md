# Rundeck Org Info — Skill Setup

These are instructions for Claude to follow when an engineer asks to install this skill.

## Prerequisites

Before starting, confirm the engineer has:

- **Windows** machine
- **Node.js** v18+ installed (`node --version` to check)
- **Microsoft Edge** or **Google Chrome** installed
- **Rundeck** access (able to log in via SSO)

If any prerequisite is missing, tell the engineer what to install before continuing.

## Step 1 — Extract the Skill

Copy the entire contents of this package to the Claude skills directory:

```bash
mkdir -p ~/.claude/skills/rundeck-org-info
```

Then copy all files from this zip/folder into `~/.claude/skills/rundeck-org-info/`.

If the engineer provided a zip file, extract it:

```bash
unzip <path-to-zip> -d ~/.claude/skills/rundeck-org-info/
```

Verify the key files exist:

```bash
ls ~/.claude/skills/rundeck-org-info/SKILL.md
ls ~/.claude/skills/rundeck-org-info/package.json
ls ~/.claude/skills/rundeck-org-info/src/runAcloudGetAccountDetails.ts
```

## Step 2 — Install Dependencies

```bash
cd ~/.claude/skills/rundeck-org-info && npm install
```

This installs Playwright, TypeScript, and other dependencies. It may take a minute.

## Step 3 — Configure Environment

Create the `.env` file from the template:

```bash
cd ~/.claude/skills/rundeck-org-info && cp .env.example .env
```

Now ask the engineer for their environment values. At minimum they need:

1. **Rundeck URL** — "What is your Rundeck base URL?" (e.g., `https://rundeck.uipath.com`)
2. **Target path** — "What Rundeck path should be used for the auth check?" (e.g., `/project/UiPath/jobs`)

Update the `.env` file with their answers:

```
RUNDECK_BASE_URL=<their-rundeck-url>
RUNDECK_TARGET_PATH=<their-target-path>
```

The other values in `.env` have sensible defaults. Only change them if the engineer says their setup differs (different browser, different CDP port, non-standard install paths).

## Step 4 — Register the Skill

Add the skill reference to the engineer's CLAUDE.md so Claude can find it in future conversations.

Check if `~/.claude/CLAUDE.md` exists. If it does, append this line:

```
@~/.claude/skills/rundeck-org-info/SKILL.md
```

If `~/.claude/CLAUDE.md` does not exist, create it with:

```markdown
@~/.claude/skills/rundeck-org-info/SKILL.md
```

**Important:** Do not overwrite existing content in CLAUDE.md — only append the skill reference.

## Step 5 — First Run Setup

Tell the engineer they need to do this one-time browser setup:

> **One-time setup (do this now):**
>
> 1. Open PowerShell in `~/.claude/skills/rundeck-org-info/`
> 2. Run: `npm run browser:edge:start`
> 3. Sign into Rundeck in the browser window that opens
> 4. Leave that browser window open
>
> **Before each session:**
> - Make sure the CDP browser is open and you're signed into Rundeck
> - If the browser was closed, run `npm run browser:edge:start` again and sign in
>
> **Then just ask me:**
> "Get org info for `https://cloud.uipath.com/your-org` ticket 12345678"

## Step 6 — Verify Installation

Run the CDP status check to confirm the browser is reachable:

```bash
cd ~/.claude/skills/rundeck-org-info && npm run browser:status
```

If that succeeds, run the smoke test:

```bash
cd ~/.claude/skills/rundeck-org-info && npm run rundeck:open
```

If both pass, tell the engineer:

> The skill is installed and working. From now on, just ask me something like:
> "Get org info for evernorth ticket 02828637"
> and I'll run the Rundeck lookup and give you the results.

## Troubleshooting

If `npm install` fails:
- Check that Node.js is installed: `node --version`
- Check that npm is available: `npm --version`
- Try deleting `node_modules` and running `npm install` again

If `.env` configuration is unclear:
- Read `.env.example` — every field has a comment explaining what it does
- Most fields have working defaults; only `RUNDECK_BASE_URL` and `RUNDECK_TARGET_PATH` must be set

If the browser won't start:
- Check the Edge/Chrome executable path in `.env` matches what's installed
- Try: `npm run browser:chrome:start` if Edge isn't available
