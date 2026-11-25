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
