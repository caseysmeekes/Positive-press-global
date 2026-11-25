-- The Positive Press Global
-- Phase 2 editorial database schema for Neon PostgreSQL.
-- Apply once to a new database using the Neon SQL Editor.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists editorial_users (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique,
  email text not null unique,
  display_name text not null,
  role text not null default 'editor' check (role in ('owner','admin','editor','researcher','writer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists editorial_desks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  display_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into editorial_desks (slug, name, description, display_order) values
 ('good-news','The Good News','Progress, people and ideas making a positive difference.',1),
 ('planet-positive','Planet Positive','Nature, climate solutions and conservation in action.',2),
 ('people-places','People & Places','Remarkable communities, journeys and human stories.',3),
 ('science-discovery','Science & Discovery','Research and discoveries opening up new possibilities.',4),
 ('food-culture','Food & Culture','The people, flavours and traditions bringing us together.',5),
 ('aviation-aerospace','Aviation & Aerospace','The changing world of flight, space and global connection.',6),
 ('sport-officiating','Sport & Officiating','Sporting stories, fair play and the people behind the game.',7),
 ('technology-innovation','Technology & Innovation','Useful ideas and technology shaping a better future.',8)
on conflict (slug) do nothing;

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  homepage_url text not null,
  feed_url text,
  source_type text not null default 'publication'
    check (source_type in ('publication','official','research','ngo','government','wire','other')),
  country_code char(2),
  language_code varchar(12) not null default 'en',
  reliability_rating smallint check (reliability_rating between 1 and 5),
  notes text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  created_by uuid references editorial_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sources_homepage_url_unique on sources (lower(homepage_url));
create index if not exists sources_active_idx on sources (is_active, name);

create table if not exists discovered_stories (
  id uuid primary key default gen_random_uuid(),
  desk_id uuid references editorial_desks(id) on delete set null,
  headline text not null,
  summary text,
  canonical_url text,
  original_published_at timestamptz,
  discovered_at timestamptz not null default now(),
  status text not null default 'discovered'
    check (status in ('discovered','shortlisted','researching','drafted','rejected','duplicate','archived')),
  priority smallint not null default 3 check (priority between 1 and 5),
  positivity_score smallint check (positivity_score between 1 and 5),
  relevance_score smallint check (relevance_score between 1 and 5),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','in_review','partially_verified','verified','disputed')),
  duplicate_of uuid references discovered_stories(id) on delete set null,
  assigned_to uuid references editorial_users(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discovered_stories_status_idx on discovered_stories (status, discovered_at desc);
create index if not exists discovered_stories_desk_idx on discovered_stories (desk_id, discovered_at desc);

create table if not exists story_sources (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references discovered_stories(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  url text not null,
  title text,
  publisher text,
  published_at timestamptz,
  source_role text not null default 'supporting'
    check (source_role in ('primary','independent','supporting','contradictory')),
  notes text,
  checked_by uuid references editorial_users(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (story_id, url)
);
create index if not exists story_sources_story_idx on story_sources (story_id);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references discovered_stories(id) on delete set null,
  desk_id uuid not null references editorial_desks(id) on delete restrict,
  author_id uuid references editorial_users(id) on delete set null,
  editor_id uuid references editorial_users(id) on delete set null,
  title text not null,
  slug text not null unique,
  standfirst text,
  body_markdown text not null default '',
  hero_image_url text,
  hero_image_credit text,
  seo_title text,
  seo_description text,
  status text not null default 'draft'
    check (status in ('draft','researching','awaiting_approval','approved','scheduled','published','rejected','archived')),
  article_type text not null default 'feature'
    check (article_type in ('news','feature','analysis','interview','explainer','review','opinion')),
  is_ai_assisted boolean not null default false,
  human_review_required boolean not null default true,
  approved_version_id uuid,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index if not exists articles_status_idx on articles (status, updated_at desc);
create index if not exists articles_published_idx on articles (published_at desc) where status = 'published';
create index if not exists articles_desk_idx on articles (desk_id, status);

create table if not exists article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  version_number integer not null,
  title text not null,
  standfirst text,
  body_markdown text not null,
  change_summary text,
  created_by uuid references editorial_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (article_id, version_number)
);
alter table articles drop constraint if exists articles_approved_version_id_fkey;
alter table articles add constraint articles_approved_version_id_fkey
  foreign key (approved_version_id) references article_versions(id) on delete set null;

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  version_id uuid not null references article_versions(id) on delete restrict,
  reviewer_id uuid not null references editorial_users(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected','changes_requested')),
  notes text,
  decided_at timestamptz not null default now()
);
create index if not exists approvals_article_idx on approvals (article_id, decided_at desc);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete set null,
  storage_url text not null,
  alt_text text,
  credit text,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','licensed','permission_granted','public_domain','original','restricted')),
  rights_notes text,
  created_by uuid references editorial_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null
    check (workflow_type in ('source_fetch','story_discovery','deduplication','research','drafting','publishing','newsletter')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  items_processed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  triggered_by uuid references editorial_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists workflow_runs_recent_idx on workflow_runs (created_at desc);

create table if not exists editorial_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references editorial_users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists editorial_audit_entity_idx on editorial_audit_log (entity_type, entity_id, created_at desc);

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending','active','unsubscribed','bounced')),
  consent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on mutable records.
do $$
declare t text;
begin
  foreach t in array array['editorial_users','sources','discovered_stories','articles','newsletter_subscribers'] loop
    execute format('drop trigger if exists %I on %I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- Publication is intentionally not automated by this schema.
-- Application logic must require a current-version approval by an active editor/admin/owner
-- before setting an article to published. Keep human_review_required=true for AI-assisted work.
