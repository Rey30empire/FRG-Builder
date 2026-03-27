# FRG Builder

FRG Builder is the canonical Next.js application for FRG's estimating, proposal, CRM, learning, and operations workflow.

## Product Scope

The current app includes these main modules:

- `Dashboard`: operational summary for projects, CRM, and learning.
- `Estimate`: document intake, analysis, takeoff, estimate generation, proposal editing, PDF export, and send flow.
- `Boost`: leads, campaigns, draft emails, activity, and follow-up workspace.
- `Learn`: construction learning interface.
- `Agent`: chat-driven assistant workspace.
- `Admin`: internal control panel.

## Stack

- Next.js 16 App Router
- React 19
- Prisma
- SQLite for local development
- Tailwind CSS 4 + shadcn/ui
- Zustand
- Netlify deployment target
- Local disk storage in development with S3-compatible object storage support for production

## Repository Rules

- The root app is the only canonical product.
- Nested legacy projects remain in the workspace for reference but are ignored by Git.
- Local SQLite is acceptable for development only.
- Production should move to managed Postgres and durable object storage.

## Local Setup

1. Copy [.env.example](C:/Users/rey30/FRG%20Builder/.env.example) to `.env`.
2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client and sync the local database:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

5. Sign in with a seeded local account:

```text
builder@frg.local   / Builder123!
estimator@frg.local / Estimator123!
sales@frg.local     / Sales123!
```

On Windows you can also use:

```bat
clean_and_start.bat
```

## Environment

Minimum required variable:

- `DATABASE_URL`

Local default:

```env
DATABASE_URL="file:../db/custom.db"
```

Recommended future production variables:

- `APP_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `RESEND_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_GROWTH_MONTHLY`
- `STRIPE_PRICE_GROWTH_YEARLY`
- object storage credentials
- AI provider credentials

Per-user AI credentials:

- each signed-in user can save their own OpenAI, Claude, or Gemini API key from the Agent panel
- those keys are encrypted at rest and require `APP_ENCRYPTION_KEY`
- global env provider keys remain optional system fallbacks when a user has not configured a personal key

Billing and monetization:

- each signed-in user gets a billing account with `Starter`, `Pro`, or `Growth`
- usage enforcement is active for AI messages, document analyses, proposal deliveries, agent runs, and enabled custom agents
- the Agent panel now includes self-serve billing overview, usage, checkout, and billing portal access
- Stripe remains optional in local development, but production monetization requires the Stripe env vars above plus a live webhook endpoint at `/api/webhook/stripe`

Netlify build note:

- if `DATABASE_URL` is not present during Netlify build, the repo now uses a temporary SQLite fallback only for compilation
- this avoids failing the build at `prebuild`, but it does not replace a real production database
- set the real `DATABASE_URL` in Netlify Site Settings so runtime APIs use Postgres instead of the temporary build fallback

Production storage variables added in this repo:

- `STORAGE_DRIVER`
- `STORAGE_PREFIX`
- `STORAGE_SIGNED_URL_TTL_SECONDS`
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ENDPOINT`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_FORCE_PATH_STYLE`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `FRG_REQUIRE_PROD_INFRA`

## Scripts

- `npm run check:env`: validates required environment variables.
- `npm run lint`: lints the canonical project files only.
- `npm run typecheck`: runs TypeScript validation.
- `npm run test`: runs the automated QA/security tests.
- `npm run test:watch`: runs Vitest in watch mode.
- `npm run db:generate`: generates Prisma client.
- `npm run db:push`: syncs schema to the local database.
- `npm run db:deploy`: applies Prisma migrations in deployment environments.
- `npm run db:migrate`: runs Prisma development migrations.
- `npm run db:seed`: seeds local development data.
- `npm run infra:check`: fails if the app is not production-ready for Postgres + durable storage.
- `npm run ops:backup:local`: creates a timestamped backup of the local SQLite DB and uploaded files.
- `npm run ops:cleanup:storage`: removes orphaned local uploads that are no longer referenced in the DB.
- `npm run build`: validates env and creates the production build.
- `npm run verify`: runs lint, typecheck, tests, Prisma generate/push, and build.
- `npm run qa:release`: runs the full release gate, including `infra:check`.

## CI

GitHub Actions runs the baseline quality pipeline on pushes and pull requests:

- `npm ci`
- `npm run check:env`
- `npm run lint`
- `npm run typecheck`
- `npm run db:generate`
- `npm run db:push`
- `npm run test`
- `npm run build`

## Health and Release

- Runtime health endpoint: [health route](C:/Users/rey30/FRG%20Builder/src/app/api/health/route.ts)
- Release checklist: [release-checklist.md](C:/Users/rey30/FRG%20Builder/docs/release-checklist.md)

The app now also includes:

- security headers through [middleware.ts](C:/Users/rey30/FRG%20Builder/middleware.ts)
- rate limiting for login, chat, proposal send, email send, admin export, and admin operations via [rate-limit.ts](C:/Users/rey30/FRG%20Builder/src/lib/rate-limit.ts)
- operations overview and maintenance endpoints via [operations.ts](C:/Users/rey30/FRG%20Builder/src/lib/operations.ts)
- support tickets and incident tracking through [support route](C:/Users/rey30/FRG%20Builder/src/app/api/support/route.ts) and [ops incidents route](C:/Users/rey30/FRG%20Builder/src/app/api/ops/incidents/route.ts)

## Netlify

The repository includes:

- [.nvmrc](C:/Users/rey30/FRG%20Builder/.nvmrc)
- [netlify.toml](C:/Users/rey30/FRG%20Builder/netlify.toml)

Those files pin Node 20 and ensure optional native dependencies are installed for Tailwind and Lightning CSS.

## Storage

Document uploads now go through a storage abstraction in [storage.ts](C:/Users/rey30/FRG%20Builder/src/lib/storage.ts).

- Development default: local files in `public/uploads/documents`
- Production-ready path: S3-compatible object storage with signed URL delivery
- Secure access route: [documents file route](C:/Users/rey30/FRG%20Builder/src/app/api/documents/file/route.ts)

## Proposal Delivery

Proposal delivery now supports:

- branded proposal PDF generation
- secure client portal links with review, approve, and reject actions
- real outbound email delivery through `Resend` or `SMTP`
- fallback `log` mode for local development without a live provider

Main implementation files:

- [proposals.ts](C:/Users/rey30/FRG%20Builder/src/lib/proposals.ts)
- [email-delivery.ts](C:/Users/rey30/FRG%20Builder/src/lib/email-delivery.ts)
- [proposal send route](C:/Users/rey30/FRG%20Builder/src/app/api/proposals/send/route.ts)
- [public proposal portal](C:/Users/rey30/FRG%20Builder/src/components/proposals/PublicProposalPortal.tsx)
- [public proposal page](C:/Users/rey30/FRG%20Builder/src/app/proposal/[token]/page.tsx)

## Monetization

The app now includes a Stripe-backed monetization layer:

- billing models and limits in [billing.ts](C:/Users/rey30/FRG%20Builder/src/lib/billing.ts)
- checkout and portal routes in [checkout route](C:/Users/rey30/FRG%20Builder/src/app/api/billing/checkout/route.ts) and [portal route](C:/Users/rey30/FRG%20Builder/src/app/api/billing/portal/route.ts)
- webhook sync in [Stripe webhook route](C:/Users/rey30/FRG%20Builder/src/app/api/webhook/stripe/route.ts)
- per-user billing UX in the Agent module

Current plan limits are enforced for:

- AI messages
- document analyses
- proposal deliveries
- agent runs
- enabled custom agents

## Current Production Reality

The application builds successfully, but it is not yet a finished production SaaS.

Known gaps that still matter before full production:

- authentication is now session-based, but it still needs password reset, invite flows, and hardened production auth UX
- monetization exists, but production still needs live Stripe keys, price IDs, and a verified webhook deployment
- no provider is configured by default, even though the app now supports real outbound email through Resend or SMTP
- no production bucket configured yet, even though the app now supports S3-compatible storage
- no managed production database wired yet
- some `Learn`, `Agent`, and `Admin` sections still need deeper product polish

## Reference Docs

- [Implementation Plan](C:/Users/rey30/FRG%20Builder/docs/implementation-plan.md)
- [Production Infrastructure](C:/Users/rey30/FRG%20Builder/docs/production-infrastructure.md)
- [Unification Status](C:/Users/rey30/FRG%20Builder/docs/unification-status.md)
- [Operations Runbook](C:/Users/rey30/FRG%20Builder/docs/operations-runbook.md)
