# Release Checklist

Use this checklist before promoting FRG Builder to a production environment.

## 1. Quality gates

- Run `npm run lint`
- Run `npm run typecheck`
- Run `npm run test`
- Run `npm run build`
- Run `npm run infra:check`
- Confirm GitHub Actions `CI` is green

## 2. Runtime health

- Open `/api/health`
- Confirm `ok` is `true`
- Confirm `releaseReady` is `true`
- Confirm database status is `healthy`
- Confirm storage status is `healthy`
- Confirm email status is `healthy`
- Confirm the active AI provider has its API key loaded

## 3. Infrastructure

- `DATABASE_URL` points to managed Postgres
- `STORAGE_DRIVER=s3`
- S3 bucket credentials are present
- backup flow is working from Admin or `npm run ops:backup:local`
- a production `NEXTAUTH_SECRET` is configured

## 4. Email and domain

- `EMAIL_PROVIDER` is `resend` or `smtp`
- `EMAIL_FROM` uses a verified business domain
- `EMAIL_REPLY_TO` is configured
- domain verification is complete in the mail provider
- test a proposal send and a CRM follow-up send

Note:
- `futureremodelingllc1@gmail.com` can be used as `EMAIL_REPLY_TO` or temporary SMTP identity, but it is not a branded sending domain

## 5. Core business flow

- Create a project
- Upload at least one plan PDF
- Run document analysis
- Generate an estimate
- Create proposal PDF
- Send proposal
- Open the public portal
- Approve or reject the proposal
- Send a CRM follow-up
- Confirm activity logs were written in Admin

## 6. Security review

- login rate limiting works
- chat rate limiting works
- proposal send and email send require level `3` or admin
- export and admin operations stay admin-only
- security headers are present on app and API responses

## 7. Netlify or deployment platform

- build uses Node 20
- clear build cache before the first production release after dependency changes
- confirm environment variables were added to the production site, not only locally
- redeploy and re-check `/api/health`
