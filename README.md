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


## Private newsroom authentication

The private newsroom is served at `/admin` and uses GitHub OAuth through NextAuth. Sign-in is restricted to the GitHub login configured in `GITHUB_ALLOWED_USER` (default: `caseysmeekes`). Public registration is not enabled.

### GitHub OAuth setup

1. In GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set Application name to `Positive Press Global Newsroom`.
3. Set Homepage URL to `https://positive-press-global.vercel.app`.
4. Set Authorization callback URL to `https://positive-press-global.vercel.app/api/auth/callback/github`.
5. Create the app and generate a client secret.

Add these environment variables to the Vercel project for Production, Preview and Development:

- `GITHUB_ID`: OAuth App client ID
- `GITHUB_SECRET`: OAuth App client secret
- `GITHUB_ALLOWED_USER`: `caseysmeekes`
- `NEXTAUTH_URL`: `https://positive-press-global.vercel.app`
- `NEXTAUTH_SECRET`: a newly generated random secret (for example, generate one with `openssl rand -base64 32`)

The Neon integration has already added database variables. Keep `DATABASE_URL` server-side and never expose any of these secrets in client-side code or GitHub.

After adding variables, redeploy the project. Visit `/login` to test GitHub sign-in and `/admin` to open the private newsroom.

The dashboard reads aggregate counts from Neon. The next implementation step is CRUD for sources, discovered stories and articles, plus approval and publishing actions. Do not treat the dashboard shell as a finished CMS.
