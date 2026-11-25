"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";

const value = (data: FormData, key: string) => {
  const item = data.get(key);
  return typeof item === "string" ? item.trim() : "";
};

export async function createSource(data: FormData) {
  const name = value(data, "name");
  const homepage = value(data, "homepage_url");
  const feed = value(data, "feed_url");
  const type = value(data, "source_type") || "publication";
  const country = value(data, "country_code").toUpperCase();
  const notes = value(data, "notes");
  if (!name || !homepage) throw new Error("Source name and homepage are required.");
  let url: URL;
  try { url = new URL(homepage); } catch { throw new Error("Enter a valid homepage URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Homepage must use HTTP or HTTPS.");
  const sql = getSql();
  await sql`insert into sources (name, homepage_url, feed_url, source_type, country_code, notes)
    values (${name}, ${url.toString()}, ${feed || null}, ${type}, ${country || null}, ${notes || null})`;
  revalidatePath("/admin");
  revalidatePath("/admin/sources");
  redirect("/admin/sources?saved=1");
}

export async function createStory(data: FormData) {
  const headline = value(data, "headline");
  const summary = value(data, "summary");
  const deskId = value(data, "desk_id");
  const url = value(data, "canonical_url");
  const priority = Number(value(data, "priority") || "3");
  if (!headline || !deskId) throw new Error("Headline and editorial desk are required.");
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new Error("Priority must be between 1 and 5.");
  if (url) {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Story URL must use HTTP or HTTPS.");
  }
  const sql = getSql();
  await sql`insert into discovered_stories (headline, summary, desk_id, canonical_url, priority)
    values (${headline}, ${summary || null}, ${deskId}, ${url || null}, ${priority})`;
  revalidatePath("/admin");
  revalidatePath("/admin/stories");
  redirect("/admin/stories?saved=1");
}

export async function createArticle(data: FormData) {
  const title = value(data, "title");
  const standfirst = value(data, "standfirst");
  const body = value(data, "body_markdown");
  const deskId = value(data, "desk_id");
  const type = value(data, "article_type") || "feature";
  if (!title || !deskId || !body) throw new Error("Title, desk and article body are required.");
  const slugBase = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 75) || "article";
  const slug = slugBase + "-" + crypto.randomUUID().slice(0, 8);
  const sql = getSql();
  await sql`with created as (
      insert into articles (desk_id, title, slug, standfirst, body_markdown, article_type, status, human_review_required)
      values (${deskId}, ${title}, ${slug}, ${standfirst || null}, ${body}, ${type}, 'draft', true)
      returning id, title, standfirst, body_markdown
    )
    insert into article_versions (article_id, version_number, title, standfirst, body_markdown, change_summary)
    select id, 1, title, standfirst, body_markdown, 'Initial draft' from created`;
  revalidatePath("/admin");
  revalidatePath("/admin/articles");
  redirect("/admin/articles?saved=1");
}


export async function updateStoryTriage(data: FormData) {
  const id = value(data, "story_id");
  const status = value(data, "status");
  const verification = value(data, "verification_status");
  const notes = value(data, "internal_notes");
  const allowedStatuses = ["discovered", "shortlisted", "researching", "drafted", "rejected", "duplicate", "archived"];
  const allowedVerification = ["unverified", "in_review", "partially_verified", "verified", "disputed"];
  if (!id || !allowedStatuses.includes(status) || !allowedVerification.includes(verification)) throw new Error("Invalid story triage update.");
  const sql = getSql();
  const updated = await sql`update discovered_stories set status = ${status}, verification_status = ${verification}, internal_notes = ${notes || null} where id = ${id} returning id`;
  if (!updated.length) throw new Error("Story not found.");
  await sql`insert into editorial_audit_log (entity_type, entity_id, action, details) values ('story', ${id}, 'triage_updated', jsonb_build_object('status', ${status}, 'verification_status', ${verification}))`;
  revalidatePath("/admin");
  revalidatePath("/admin/stories");
  redirect("/admin/stories?updated=1");
}
