# Operations Runbook

This runbook covers the new block 10 operational layer in FRG Builder.

## Core endpoints

- `GET /api/health`
  Returns runtime health and release readiness.

- `GET /api/ops/overview`
  Admin-only operations snapshot for tickets, incidents, follow-up backlog and maintenance runs.

- `POST /api/ops/maintenance`
  Runs one maintenance action.

- `GET|POST|PATCH /api/ops/incidents`
  Admin incident management.

- `GET|POST|PATCH /api/support`
  Internal support ticket intake and updates.

## Maintenance actions

Supported `action` values for `/api/ops/maintenance`:

- `backup-local`
- `cleanup-storage`
- `health-scan`
- `follow-up-audit`

## Triggering maintenance from a scheduler

The maintenance endpoint supports either:

- admin session auth
- `x-cron-secret: <OPS_CRON_SECRET>`
- `Authorization: Bearer <OPS_CRON_SECRET>`

Recommended environment variable:

- `OPS_CRON_SECRET`

## Suggested schedule

- `health-scan`: every hour
- `follow-up-audit`: every 6 hours
- `backup-local`: daily for local/staging only
- `cleanup-storage`: daily or weekly depending on upload volume

## What the app tracks now

- open support tickets
- active incidents
- maintenance run history
- overdue lead follow-ups
- stale proposals that were sent but not viewed after 72 hours

## Operational response flow

1. Check `/api/health`
2. Open `/api/ops/overview`
3. Review active alerts
4. Review support tickets and incidents
5. Run `health-scan` or `follow-up-audit`
6. If storage or backup is involved, run `backup-local` before further changes

## Production note

This runbook improves observability and operations inside the app, but full production readiness still depends on:

- Postgres instead of SQLite
- S3-compatible storage instead of local disk
- live email provider
- scheduler configuration using `OPS_CRON_SECRET`
