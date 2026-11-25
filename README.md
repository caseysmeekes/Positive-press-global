# The Positive Press Global

Phase 1 website starter, built with Next.js App Router.

## Stack
- Next.js 15, React 19 and TypeScript
- Responsive CSS with forest green, cream and muted gold identity
- Ready for Vercel deployment

## Run locally
Requires Node.js 20.9 or newer.
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Deploy to Vercel
Import this GitHub repository into Vercel. Select Next.js, root directory `.`, and no environment variables are needed for this front-end phase.

## Current scope
Includes the homepage, responsive navigation, editorial desk overview, brand styling, metadata and project documentation. It does not yet include a CMS, database, article ingestion, AI writing, editor login, approval dashboard, newsletter signup or analytics. Editorial desk cards are introductions, not published news stories.

## Editorial principle
AI may assist discovery and drafting, but every article requires explicit human editorial approval before publication. Verify names, dates, claims, quotes, image rights and sources. RSS access does not automatically grant republication rights.

## Phase 2: newsroom foundations
The initial Neon PostgreSQL schema is in `database/schema.sql`, with setup instructions in `database/README.md`. It defines editorial users and roles, the eight desks, sources, discovered stories, source evidence, articles, version history, approvals, media rights, workflow runs, audit history and newsletter subscribers. The schema must be applied to a new Neon database and `DATABASE_URL` configured in Vercel before the application database integration can be enabled.

## Next phases
1. Complete Neon setup and verify the schema.
2. Add secure editor authentication and role-based access.
3. Build the private newsroom dashboard and article review workflow.
4. Add source discovery, research and AI-assisted drafting.
5. Connect approved articles to the public website, then newsletter and analytics.

## Brand note
The publication name is provisional pending proper trademark and brand clearance. Similar positive-news publication naming exists; domain availability alone is not legal clearance.


## Newsroom access and authentication

The newsroom at `/admin` is temporarily accessible without login while the product is being built and tested. Authentication has deliberately been deferred until the end of the build. Do not add credentials or OAuth environment variables yet. Before any public launch, restore route and server-action protection, configure the chosen authentication provider, and verify access controls.


## Newsroom tools implemented

The admin workspace currently includes:
- `/admin/sources`: register and view editorial sources, including homepage, feed URL, type, country and notes.
- `/admin/stories`: manually capture story leads, assign an editorial desk, add an original source URL and set priority.
- `/admin/articles`: list article drafts and their editorial status.
- `/admin/articles/new`: create an unpublished article draft and store its first version in the version history.

The newsroom is intentionally open during development. Do not treat this as production-safe: anyone who can reach the deployed site may be able to access the admin screens and create records. Keep the site private or use it only with non-sensitive test data until authentication is restored.

The workflow currently supports manual source and story intake and draft creation. RSS ingestion, editing existing records, research automation, approvals and public publishing are subsequent implementation steps.


## Overnight newsroom automation

The scheduled newsroom endpoint is `/api/cron/newsroom`. Vercel invokes it using two UTC schedules so that the local execution window remains 02:00 in `Pacific/Auckland` across daylight-saving changes. The endpoint checks the local time, requires a bearer token, and records a daily run marker in `workflow_runs` to avoid duplicate runs.

Configure the following Production environment variable in Vercel before enabling the schedule:

- `CRON_SECRET`: a long random secret. Generate one locally with `openssl rand -base64 32`, then add the same value in Vercel. Do not commit the value or share it in chat.

The cron is only active on Production deployments. It does not publish articles. AI-generated articles remain drafts requiring human editorial review.

**Runtime note:** the current Vercel team is on the Hobby plan, whose function execution limit is 60 seconds. The existing discovery pipeline scans sources sequentially and may exceed that limit when feeds are slow or several drafts are generated. Treat the first scheduled run as a validation run. The next reliability improvement is to split discovery, extraction and drafting into smaller queued batches so that a single invocation cannot time out.


## Gemini AI configuration

All AI-powered story screening, manual research and overnight article drafting use Google's Gemini Developer API. The application uses the official `@google/genai` SDK on the server; API credentials are never sent to the browser.

Add these Production (and Preview, if you test previews) environment variables in Vercel:

- `GEMINI_API_KEY`: create an API key in [Google AI Studio](https://aistudio.google.com/api-keys).
- `GEMINI_MODEL` (optional): defaults to `gemini-2.5-flash`.

The Google AI Plus consumer subscription does not itself supply this API key. Gemini API access and billing/quotas are managed separately in Google AI Studio. Once the Gemini deployment is working, the old `OPENAI_API_KEY` variable is no longer used by this application and can be removed from Vercel.

The shared Gemini client is in `lib/gemini.ts`. It requests JSON responses for predictable newsroom screening and drafting output. AI-generated work remains unpublished and requires human editorial review.
