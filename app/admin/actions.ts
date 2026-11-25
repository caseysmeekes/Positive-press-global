"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { generateGeminiJson } from "@/lib/gemini";

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
  const deskId = value(data, "desk_id");
  const allowedStatuses = ["discovered", "shortlisted", "researching", "drafted", "rejected", "duplicate", "archived"];
  const allowedVerification = ["unverified", "in_review", "partially_verified", "verified", "disputed"];
  if (!id || !allowedStatuses.includes(status) || !allowedVerification.includes(verification)) throw new Error("Invalid story triage update.");
  const sql = getSql();
  if (!deskId) throw new Error("Assign an editorial desk before saving triage.");
  const updated = await sql`update discovered_stories set desk_id = ${deskId}, status = ${status}, verification_status = ${verification}, internal_notes = ${notes || null} where id = ${id} returning id`;
  if (!updated.length) throw new Error("Story not found.");
  await sql`insert into editorial_audit_log (entity_type, entity_id, action, details) values ('story', ${id}, 'triage_updated', jsonb_build_object('status', ${status}::text, 'verification_status', ${verification}::text))`;
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
  if (!items.length) return null;
  const parsed = await generateGeminiJson<{ assessments?: StoryAssessment[] }>({
    systemInstruction: "You screen story leads for The Positive Press Global. Prioritise constructive positive global stories, solutions, conservation, science, communities and culture. Also retain strong specialist stories about aviation and aerospace, sport and officiating, and technology. Reject routine promotions, thin press releases, clickbait, gossip and low-public-interest items. Never invent facts. Return JSON {assessments:[...]}. For each input index return include boolean, desk slug, positivity 1-5, relevance 1-5, priority 1-5 and one cautious summary sentence. Allowed desk slugs: good-news, planet-positive, people-places, science-discovery, food-culture, aviation-aerospace, sport-officiating, technology-innovation.",
    prompt: JSON.stringify({ items: items.map((item,index) => ({ index, headline:item.title, publisher:item.sourceName, sourceType:item.sourceType, summary:item.summary.slice(0,800), url:item.url })) }),
    temperature: 0.1
  });
  if (!Array.isArray(parsed.assessments)) throw new Error("Gemini screening response was not in the expected format.");
  return parsed.assessments;
}

async function createOvernightDraft(storyId: string): Promise<boolean> {
  if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) return false;
  const sql = getSql();
  const rows = await sql`select s.id,s.headline,s.summary,s.canonical_url,s.desk_id,d.name as desk_name from discovered_stories s left join editorial_desks d on d.id=s.desk_id where s.id=${storyId} limit 1`;
  if (!rows.length) return false;
  const story = rows[0] as {id:string;headline:string;summary:string|null;canonical_url:string|null;desk_id:string|null;desk_name:string|null};
  if (!story.desk_id) return false;
  const sources = await sql`select url,title,publisher,source_role,notes from story_sources where story_id=${storyId} order by created_at asc limit 8`;
  const sourceMaterial = (sources as {url:string;title:string|null;publisher:string|null;source_role:string;notes:string|null}[]).map(source => ({url:source.url,title:source.title,publisher:source.publisher,role:source.source_role,extracted_text:source.notes || ""}));
  const usable = sourceMaterial.filter(source => source.extracted_text.includes("EXTRACTED SOURCE TEXT (up to 12,000 characters):"));
  if (!usable.length) return false;
  const draft = await generateGeminiJson<{headline?:string;standfirst?:string;article_markdown?:string;seo_description?:string;research_summary?:string;claims_to_verify?:string[];source_assessment?:string}>({
    systemInstruction: "You are the commissioning editor and original writer for The Positive Press Global. Create a genuinely original, accurate, readable article draft from the supplied source text. Do not reproduce or closely paraphrase source wording, structure, distinctive turns of phrase or quotations. Do not invent facts, people, dates, statistics, outcomes or quotes. Use direct quotes only when they are present in the supplied text and clearly attributed, otherwise paraphrase facts in fresh language. Distinguish reported facts from interpretation. If evidence is thin, write a shorter cautious draft rather than padding. Do not claim independent verification. Add a short editor's verification checklist. Return valid JSON only.",
    prompt: JSON.stringify({story:{headline:story.headline,summary:story.summary,desk:story.desk_name},sources:usable,required_output:{headline:"string",standfirst:"string",article_markdown:"string",seo_description:"string",research_summary:"string",claims_to_verify:["string"],source_assessment:"string"}}),
    temperature: 0.3
  });
  if (!draft.headline || !draft.article_markdown || draft.article_markdown.length < 500) throw new Error("AI draft was incomplete or too short.");
  const links = usable.map(source=>"- ["+(source.publisher || source.title || "Source")+"]("+source.url+")").join("\n");
  const body = draft.article_markdown+"\n\n## Sources\n"+links+"\n\n## Editor's verification checklist\n"+(draft.claims_to_verify || []).map(item=>"- "+item).join("\n")+"\n\n*AI-assisted working draft. Not independently fact-checked. Human editorial approval is required before publication.*";
  const slugBase = draft.headline.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70) || "article";
  const slug = slugBase+"-"+crypto.randomUUID().slice(0,8);
  const created = await sql`with a as (insert into articles (story_id,desk_id,title,slug,standfirst,body_markdown,seo_description,article_type,status,is_ai_assisted,human_review_required) values (${storyId},${story.desk_id},${draft.headline.slice(0,180)},${slug},${(draft.standfirst || "").slice(0,400)},${body},${(draft.seo_description || "").slice(0,300)},'feature','draft',true,true) returning id,title,standfirst,body_markdown) insert into article_versions (article_id,version_number,title,standfirst,body_markdown,change_summary) select id,1,title,standfirst,body_markdown,'Overnight AI-assisted draft from extracted source text' from a returning article_id`;
  await sql`update discovered_stories set status='drafted',internal_notes=concat_ws(E'\n\n',internal_notes,${"OVERNIGHT AI DRAFT RESEARCH: "+(draft.research_summary || "")+"\nSource assessment: "+(draft.source_assessment || "Not supplied")}) where id=${storyId}`;
  await sql`insert into workflow_runs (workflow_type,status,started_at,completed_at,items_processed,metadata) values ('drafting','succeeded',now(),now(),1,jsonb_build_object('story_id',${storyId}::text,'article_id',${(created[0] as {article_id:string}).article_id}::text,'mode','overnight'))`;
  await sql`insert into editorial_audit_log (entity_type,entity_id,action,details) values ('story',${storyId},'overnight_ai_draft_created',jsonb_build_object('article_id',${(created[0] as {article_id:string}).article_id}::text))`;
  return true;
}
async function extractSourceArticle(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("Only public HTTPS article pages are supported.");
  const response = await fetch(parsed.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PositivePressGlobal/1.0)", Accept: "text/html,application/xhtml+xml" },
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error("Article page returned HTTP " + response.status);
  const html = (await response.text()).slice(0, 1000000);
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(article|main|p|h1|h2|h3|li|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/(article|main|p|h1|h2|h3|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
  if (text.length < 400) throw new Error("The page did not expose enough readable article text.");
  return text.slice(0, 12000);
}
export async function runSourceDiscoveryCore() {
  const sql = getSql();
  const sources = await sql`select id, name, feed_url, source_type from sources where is_active = true and feed_url is not null and trim(feed_url) <> '' order by name limit 50`;
  const run = await sql`insert into workflow_runs (workflow_type,status,started_at,metadata) values ('source_fetch','running',now(),jsonb_build_object('source_count',${sources.length}::int)) returning id`;
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
  if ((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) && unique.length) {
    try { assessments = await screenStories(unique); }
    catch (error) { aiError = error instanceof Error ? error.message : "AI screening failed"; }
  }
  const desks = await sql`select id,slug from editorial_desks where is_active = true`;
  const deskIds = new Map<string, string>((desks as {id:string;slug:string}[]).map(desk => [desk.slug,desk.id] as const));
  const assessmentByIndex = new Map<number, StoryAssessment>((assessments || []).map(item => [item.index,item] as const));
  let imported = 0;
  let selected = 0;
  let extracted = 0;
  let draftsCreated = 0;
  const draftErrors: string[] = [];
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
    let extractedText = "";
    let extractionNote = "";
    if (extracted < 8) {
      try { extractedText = await extractSourceArticle(item.url); extracted++; }
      catch (error) { extractionNote = "Source text extraction failed: " + (error instanceof Error ? error.message : "Unknown extraction error"); }
    } else {
      extractionNote = "Source text extraction queued for a later run to keep the scan within execution limits.";
    }
    const sourceNotes = extractedText ? "EXTRACTED SOURCE TEXT (up to 12,000 characters):\n" + extractedText : extractionNote;
    await sql`insert into story_sources (story_id,source_id,url,title,publisher,published_at,source_role,notes)
      values (${storyId},${item.sourceId},${item.url},${item.title},${item.sourceName},${item.publishedAt},'primary',${sourceNotes || null})
      on conflict (story_id,url) do update set notes=excluded.notes`;
    imported++;
    if (assessment) selected++;
    if (extractedText && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      try { if (await createOvernightDraft(storyId)) draftsCreated++; }
      catch (error) { draftErrors.push(item.title + ": " + (error instanceof Error ? error.message : "Draft creation failed")); }
    }
  }
  await sql`update workflow_runs set status='succeeded',completed_at=now(),items_processed=${imported},
    metadata=jsonb_build_object('sources_checked',${checked}::int,'items_fetched',${fetched}::int,'new_stories',${imported}::int,'duplicates',${duplicates}::int,'drafts_created',${draftsCreated}::int,'draft_errors',${JSON.stringify(draftErrors.slice(0,8))}::jsonb,'ai_screened',${Boolean(assessments)}::boolean,'ai_error',${aiError}::text,'feed_errors',${JSON.stringify(errors.slice(0,10))}::jsonb)
    where id=${(run[0] as {id:string}).id}`;
  await sql`insert into workflow_runs (workflow_type,status,started_at,completed_at,items_processed,metadata)
    values ('story_discovery',${assessments ? "succeeded" : "failed"},now(),now(),${selected},
    jsonb_build_object('screened',${unique.length}::int,'selected',${selected}::int,'ai_enabled',${Boolean(assessments)}::boolean,'error',${aiError || ((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? "" : "GEMINI_API_KEY is not configured")}::text))`;
  return { checked, fetched, imported, duplicates, aiEnabled: Boolean(assessments), feedErrors: errors.length, extracted, draftsCreated, draftErrors: draftErrors.length };
}

export async function runSourceDiscovery() {
  const result = await runSourceDiscoveryCore();
  revalidatePath("/admin");
  revalidatePath("/admin/stories");
  redirect("/admin/stories?scan=1&checked="+result.checked+"&fetched="+result.fetched+"&imported="+result.imported+"&duplicates="+result.duplicates+"&ai="+(result.aiEnabled ? "on" : "off")+"&errors="+result.feedErrors+"&extracted="+result.extracted+"&drafts="+result.draftsCreated+"&draftErrors="+result.draftErrors);
}

export async function seedStarterSources() {
  const rows = [
    ["Positive News","https://www.positive.news","https://www.positive.news/feed/","publication","GB"],
    ["Good News Network","https://www.goodnewsnetwork.org","https://www.goodnewsnetwork.org/feed/","publication","US"],
    ["Reasons to be Cheerful","https://reasonstobecheerful.world","https://reasonstobecheerful.world/feed/","publication","US"],
    ["Good Good Good","https://www.goodgoodgood.co","https://www.goodgoodgood.co/articles/rss.xml","publication","US"],
    ["Optimist Daily","https://www.optimistdaily.com","https://www.optimistdaily.com/feed/","publication","US"],
    ["Mongabay","https://news.mongabay.com","https://news.mongabay.com/feed/","publication","US"],
    ["Yale Environment 360","https://e360.yale.edu","https://e360.yale.edu/feed.xml","publication","US"],
    ["Carbon Brief","https://www.carbonbrief.org","https://www.carbonbrief.org/feed","publication","GB"],
    ["World Resources Institute","https://www.wri.org","https://www.wri.org/insights/rss.xml","research","US"],
    ["ScienceDaily Environment","https://www.sciencedaily.com","https://www.sciencedaily.com/rss/top/environment.xml","publication","US"],
    ["Nature","https://www.nature.com","https://www.nature.com/nature.rss","research","GB"],
    ["BBC Science and Environment","https://www.bbc.com/news/science_and_environment","https://feeds.bbci.co.uk/news/science_and_environment/rss.xml","publication","GB"],
    ["BBC World","https://www.bbc.com/news/world","https://feeds.bbci.co.uk/news/world/rss.xml","publication","GB"],
    ["BBC Travel","https://www.bbc.com/travel","https://www.bbc.com/travel/feed.rss","publication","GB"],
    ["BBC Culture","https://www.bbc.com/culture","https://www.bbc.com/culture/feed.rss","publication","GB"],
    ["BBC Future","https://www.bbc.com/future","https://www.bbc.com/future/feed.rss","publication","GB"],
    ["BBC Sport","https://www.bbc.com/sport","https://feeds.bbci.co.uk/sport/rss.xml","publication","GB"],
    ["NASA News Releases","https://www.nasa.gov","https://www.nasa.gov/news-release/feed/","official","US"],
    ["NASA Aeronautics","https://www.nasa.gov/aeronautics","https://www.nasa.gov/aeronautics/feed/","official","US"],
    ["NASA Science","https://science.nasa.gov","https://science.nasa.gov/feed/","official","US"],
    ["UN News","https://news.un.org","https://news.un.org/feed/subscribe/en/news/all/rss.xml","official","UN"],
    ["World Health Organization News","https://www.who.int","https://www.who.int/rss-feeds/news-english.xml","official","CH"],
    ["Our World in Data","https://ourworldindata.org","https://ourworldindata.org/atom.xml","research","GB"],
    ["Futurity","https://www.futurity.org","https://www.futurity.org/feed/","research","US"],
    ["TechCrunch","https://techcrunch.com","https://techcrunch.com/feed/","publication","US"],
    ["The Verge","https://www.theverge.com","https://www.theverge.com/rss/index.xml","publication","US"],
    ["Ars Technica","https://arstechnica.com","https://feeds.arstechnica.com/arstechnica/technology-lab","publication","US"],
    ["The Guardian Environment","https://www.theguardian.com/environment","https://www.theguardian.com/environment/rss","publication","GB"],
    ["The Guardian Science","https://www.theguardian.com/science","https://www.theguardian.com/science/rss","publication","GB"],
    ["The Conversation Australia","https://theconversation.com/au","https://theconversation.com/au/articles.atom","publication","AU"],
    ["ABC News Australia","https://www.abc.net.au/news","https://www.abc.net.au/news/feed/51120/rss.xml","publication","AU"]
  ] as const;
  const sql = getSql();
  let added = 0;
  let existing = 0;
  for (const [name, homepage, feed, type, country] of rows) {
    const result = await sql`insert into sources (name,homepage_url,feed_url,source_type,country_code,is_active)
      values (${name},${homepage},${feed},${type},${country},true)
      on conflict do nothing returning id`;
    if (result.length) added++; else existing++;
  }
  revalidatePath("/admin");
  revalidatePath("/admin/sources");
  redirect("/admin/sources?seeded=1&added=" + added + "&existing=" + existing);
}
