# Phase 2: Neon database setup

This folder contains the initial PostgreSQL schema for the Positive Press Global newsroom.

## Create the Neon database

1. Sign in to Neon and create a project named `positive-press-global`.
2. Choose a region close to the Vercel deployment's users or application region. For this publication, choose a supported Asia-Pacific region if available.
3. Open the project's SQL Editor.
4. Copy and run the complete contents of `database/schema.sql`.
5. Confirm the tables appear in the Tables view.

## Add the connection string to Vercel

1. In Neon, open **Connect** and copy the pooled connection string. It should begin with `postgresql://` and include `sslmode=require`.
2. In Vercel, open the Positive Press Global project, then **Settings → Environment Variables**.
3. Add `DATABASE_URL` with the connection string.
4. Select **Production**, **Preview** and **Development** environments.
5. Save, then redeploy the latest deployment.

Keep this value private. Never put it in a `NEXT_PUBLIC_` variable, commit it to GitHub, or paste it into chat.

## Schema contents

- Editorial users and roles (identity provider integration comes later)
- Eight editorial desks, pre-seeded
- Source register
- Discovered stories and story-source evidence
- Articles and immutable article versions
- Explicit editorial approvals
- Media rights register
- Workflow run history
- Editorial audit log
- Newsletter subscriber consent and status

## Important safeguards

- The database schema does not create a public admin login. Authentication and role enforcement are the next implementation step.
- Do not expose database credentials in client-side code.
- Publishing must be blocked unless the exact current article version has an approval from an active authorised editor.
- AI-assisted articles remain subject to human review.
- Keep original source URLs and record image rights. A source feed does not automatically grant republication rights.

## Verification

After running the SQL, execute:

```sql
select slug, name, display_order
from editorial_desks
order by display_order;

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```
