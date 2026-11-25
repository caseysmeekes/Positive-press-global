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

type FeedEntry = { title: string; url: string; summary: string; publishedAt: string | null };
type FeedCandidate = FeedEntry & { sourceId: string; sourceName: string; sourceType: string };
type StoryAssessment = { index: number; include: boolean; desk: string; positivity: number; relevance: number; priority: number; summary: string };

function cleanXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
}
function feedTag(block: string, names: string[]): string {
  for (const name of names) {
    const match = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i"));
    if (match?.[1]) return cleanXml(match[1]);
  }
  return "";
}
function parseRss(xml: string): FeedEntry[] {
  return [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => {
    const block = match[2];
    const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];
    let url = href || feedTag(block, ["link", "guid", "id"]);
    try { url = new URL(url).toString(); } catch { url = ""; }
    const rawDate = feedTag(block, ["pubDate", "published", "updated", "dc:date"]);
    return {
      title: feedTag(block, ["title"]),
      url,
      summary: feedTag(block, ["description", "summary", "content:encoded", "content"]).slice(0, 2500),
      publishedAt: rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : null
    };
  }).filter(item => item.title && item.url).slice(0, 15);
}
function validateFeedUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !host || url.username || url.password ||
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) {
    throw new Error("Feed must use a public HTTPS hostname.");
  }
  return url.toString();
}
async function screenStories(items: FeedCandidate[]): Promise<StoryAssessment[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !items.length) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You screen story leads for The Positive Press Global. Prioritise constructive positive global stories, solutions, conservation, science, communities and culture. Also retain strong specialist stories about aviation and aerospace, sport and officiating, and technology. Reject routine promotions, thin press releases, clickbait, gossip and low-public-interest items. Never invent facts. Return JSON {assessments:[...]}. For each input index return include boolean, desk slug, positivity 1-5, relevance 1-5, priority 1-5 and one cautious summary sentence. Allowed desk slugs: good-news, planet-positive, people-places, science-discovery, food-culture, aviation-aerospace, sport-officiating, technology-innovation." },
        { role: "user", content: JSON.stringify({ items: items.map((item,index) => ({ index, headline:item.title, publisher:item.sourceName, sourceType:item.sourceType, summary:item.summary.slice(0,800), url:item.url })) }) }
      ]
    }),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error("AI screening returned HTTP " + response.status);
  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI screening returned an empty response.");
  const parsed = JSON.parse(content) as { assessments?: StoryAssessment[] };
  if (!Array.isArray(parsed.assessments)) throw new Error("AI screening response was not in the expected format.");
  return parsed.assessments;
}

export async function runSourceDiscovery() {
  const sql = getSql();
  const sources = await sql`select id, name, feed_url, source_type from sources where is_active = true and feed_url is not null and trim(feed_url) <> '' order by name limit 50`;
  const run = await sql`insert into workflow_runs (workflow_type,status,started_at,metadata) values ('source_fetch','running',now(),jsonb_build_object('source_count',${sources.length})) returning id`;
  const candidates: FeedCandidate[] = [];
  const errors: string[] = [];
  let checked = 0;
  let fetched = 0;
  let duplicates = 0;
  for (const source of sources as {id:string;name:string;feed_url:string;source_type:string}[]) {
    try {
      const response = await fetch(validateFeedUrl(source.feed_url), {
        headers: { "User-Agent": "PositivePressGlobalNewsroom/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const xml = await response.text();
      if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("Not a recognised RSS or Atom feed");
      const entries = parseRss(xml);
      checked++;
      fetched += entries.length;
      for (const entry of entries) candidates.push({ ...entry, sourceId:source.id, sourceName:source.name, sourceType:source.source_type });
    } catch (error) {
      errors.push(source.name + ": " + (error instanceof Error ? error.message : "Feed fetch failed"));
    }
    await sql`update sources set last_checked_at = now() where id = ${source.id}`;
  }
  const unique = [...new Map<string, FeedCandidate>(candidates.map(item => [item.url,item] as const)).values()].slice(0,60);
  let assessments: StoryAssessment[] | null = null;
  let aiError = "";
  if (process.env.OPENAI_API_KEY && unique.length) {
    try { assessments = await screenStories(unique); }
    catch (error) { aiError = error instanceof Error ? error.message : "AI screening failed"; }
  }
  const desks = await sql`select id,slug from editorial_desks where is_active = true`;
  const deskIds = new Map<string, string>((desks as {id:string;slug:string}[]).map(desk => [desk.slug,desk.id] as const));
  const assessmentByIndex = new Map<number, StoryAssessment>((assessments || []).map(item => [item.index,item] as const));
  let imported = 0;
  let selected = 0;
  for (let index=0; index<unique.length; index++) {
    const item = unique[index];
    const assessment = assessmentByIndex.get(index);
    if (assessments && (!assessment || !assessment.include)) continue;
    const existing = await sql`select id from discovered_stories where canonical_url = ${item.url} limit 1`;
    if (existing.length) {
      duplicates++;
      const storyId = (existing[0] as {id:string}).id;
      await sql`insert into story_sources (story_id,source_id,url,title,publisher,published_at,source_role)
        values (${storyId},${item.sourceId},${item.url},${item.title},${item.sourceName},${item.publishedAt},'supporting')
        on conflict (story_id,url) do nothing`;
      continue;
    }
    const deskId = assessment ? deskIds.get(assessment.desk) || null : null;
    const summary = assessment?.summary || item.summary || null;
    const inserted = await sql`insert into discovered_stories
      (headline,summary,desk_id,canonical_url,original_published_at,status,priority,positivity_score,relevance_score)
      values (${item.title.slice(0,500)},${summary},${deskId},${item.url},${item.publishedAt},'discovered',
      ${assessment ? Math.min(5,Math.max(1,assessment.priority)) : 3},
      ${assessment ? Math.min(5,Math.max(1,assessment.positivity)) : null},
      ${assessment ? Math.min(5,Math.max(1,assessment.relevance)) : null}) returning id`;
    const storyId = (inserted[0] as {id:string}).id;
    await sql`insert into story_sources (story_id,source_id,url,title,publisher,published_at,source_role)
      values (${storyId},${item.sourceId},${item.url},${item.title},${item.sourceName},${item.publishedAt},'supporting')
      on conflict (story_id,url) do nothing`;
    imported++;
    if (assessment) selected++;
  }
  await sql`update workflow_runs set status='succeeded',completed_at=now(),items_processed=${imported},
    metadata=jsonb_build_object('sources_checked',${checked},'items_fetched',${fetched},'new_stories',${imported},'duplicates',${duplicates},'ai_screened',${Boolean(assessments)},'ai_error',${aiError},'feed_errors',${errors.slice(0,10)})
    where id=${(run[0] as {id:string}).id}`;
  await sql`insert into workflow_runs (workflow_type,status,started_at,completed_at,items_processed,metadata)
    values ('story_discovery',${assessments ? "succeeded" : "failed"},now(),now(),${selected},
    jsonb_build_object('screened',${unique.length},'selected',${selected},'ai_enabled',${Boolean(assessments)},'error',${aiError || (process.env.OPENAI_API_KEY ? "" : "OPENAI_API_KEY is not configured")}))`;
  revalidatePath("/admin");
  revalidatePath("/admin/stories");
  redirect("/admin/stories?scan=1&checked="+checked+"&fetched="+fetched+"&imported="+imported+"&duplicates="+duplicates+"&ai="+(assessments ? "on" : "off")+"&errors="+errors.length);
}
