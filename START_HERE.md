# Start Here

Use this page to decide which document to open first.

## If You Just Need To Run The Tool

Open:

- [docs/QUICK_START.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/QUICK_START.md)

Use this if you are a day-to-day user and only need to run the Rundeck account lookup.

## If You Are Rolling This Out To Other Users

Open:

- [docs/HANDOFF.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/HANDOFF.md)

Use this if you need the cleanest single-file handoff for onboarding a team or reducing setup friction.

## If You Need Full Setup And Troubleshooting Details

Open:

- [docs/IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md)

Use this if you need the technical setup steps, environment details, and troubleshooting guidance.

## Typical Recommended Path

For most teams:

1. Read [docs/HANDOFF.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/HANDOFF.md).
2. Give end users [docs/QUICK_START.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/QUICK_START.md).
3. Use [docs/IMPLEMENTATION_GUIDE.md](/mnt/c/Users/andrew.brumley/rundeck-playwright-cdp/docs/IMPLEMENTATION_GUIDE.md) only when deeper setup or troubleshooting is needed.

## Key Things New Users Usually Miss

Before anyone tries to run the tool, make sure they know:

1. The browser must be started with the provided CDP command.
2. The same CDP browser window must stay open during the run.
3. `npm run browser:status` should work before the job is launched.
4. Users can paste either the full cloud URL or just the org slug.
