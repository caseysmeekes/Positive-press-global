"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";

const formValue = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v.trim() : "";
};


async function extractArticleText(rawUrl: string): Promise<string> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return ""; }
  const host = url.hostname.toLowerCase();
  const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host);
  if (url.protocol !== "https:" || !host || url.username || url.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || privateIpv4 || host.includes(":")) return "";
  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PositivePressGlobal/1.0)", Accept: "text/html,application/xhtml+xml" },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) return "";
    const html = (await response.text()).slice(0, 1000000);
    const text = html
      .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(article|main|p|h1|h2|h3|h4|li|blockquote)\b[^>]*>/gi, "\n")
      .replace(/<\/(article|main|p|h1|h2|h3|h4|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ").trim();
    return text.length >= 400 ? text.slice(0, 12000) : "";
  } catch { return ""; }
}

export async function researchAndDraftStory(data: FormData) {
  const storyId = formValue(data, "story_id");
  if (!storyId) throw new Error("Story ID is required.");
  if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) redirect("/admin/stories?error=gemini_not_configured");

  const sql = getSql();
  const rows = await sql`select s.id,s.headline,s.summary,s.canonical_url,s.desk_id,d.name as desk_name
    from discovered_stories s left join editorial_desks d on d.id=s.desk_id where s.id=${storyId} limit 1`;
  if (!rows.length) throw new Error("Story not found.");
  const story = rows[0] as {id:string;headline:string;summary:string|null;canonical_url:string|null;desk_id:string|null;desk_name:string|null};
  if (!story.desk_id) redirect("/admin/stories?error=assign_desk");

  // Re-running research updates the latest draft for this story rather than creating duplicates.
  const existingDrafts = await sql`select id from articles where story_id=${storyId} and status='draft' order by updated_at desc limit 1`;
  const existingArticleId = existingDrafts.length ? (existingDrafts[0] as {id:string}).id : null;
  const sources = await sql`select url,title,publisher,source_role,notes from story_sources where story_id=${storyId} order by created_at asc limit 8`;
  const sourceMaterial = (sources as {url:string;title:string|null;publisher:string|null;source_role:string;notes:string|null}[]).map(s => ({
    url:s.url, title:s.title, publisher:s.publisher, role:s.source_role, editorial_notes:s.notes, article_text:""
  }));
  if (story.canonical_url && !sourceMaterial.some(s=>s.url===story.canonical_url)) {
    sourceMaterial.unshift({url:story.canonical_url,title:story.headline,publisher:"Original story link",role:"primary",editorial_notes:null,article_text:""});
  }
  // Fetch source pages so the writer has reporting to work from, not just headlines and URLs.
  for (const source of sourceMaterial) if (source.url) source.article_text = await extractArticleText(source.url);
  if (!sourceMaterial.length && !story.summary) throw new Error("This story has no source material. Add a source URL or summary first.");

  const run = await sql`insert into workflow_runs (workflow_type,status,started_at,metadata)
    values ('research','running',now(),jsonb_build_object('story_id',${storyId}::text,'source_count',${sourceMaterial.length}::int)) returning id`;
  try {
    const { generateGeminiJson } = await import("@/lib/gemini");
    const draft = await generateGeminiJson<{
      ready_to_publish_as_draft?:boolean;reason_if_insufficient?:string;
      research_summary?:string;key_facts?:string[];claims_to_verify?:string[];
      missing_perspectives?:string[];source_assessment?:string;headline?:string;
      standfirst?:string;article_markdown?:string;seo_description?:string
    }>({
      systemInstruction: "You are the senior commissioning editor and feature writer for The Positive Press Global, an international publication known for distinctive, intelligent, constructive journalism. Write like an experienced human journalist, not a content generator. Use extracted article text as the primary evidence. A headline, RSS snippet or URL is not sufficient reporting. If full article text is unavailable, lower confidence and do not invent missing details. Find the specific, genuinely interesting story in the evidence and lead with the most compelling verified development, never generic scene-setting. Make the article informative, vivid and readable. For policy stories, explain who made the decision, what the policy actually says, the evidence and figures behind it, the practical consequences, what remains undecided and the response from affected stakeholders where the source supports it. Do not repeat the same announcement in the opening and second paragraph. Never put editor notes, source links or verification checklists inside article_markdown. Use concrete facts, named people, organisations, locations, dates, figures and examples only when supplied. Explain why the development matters with relevant context, but distinguish sourced facts from interpretation. Use varied sentence lengths, natural transitions and purposeful paragraphs. Avoid repetitive phrasing, empty optimism, cliches, rhetorical padding and generic conclusions. Never use stock openings such as 'as the calendar turns' or 'thoughts naturally drift'. Aim for 600-850 words only when evidence supports that length; if the material supports only a short news story, write 300-450 strong words. If evidence is too thin, return ready_to_publish_as_draft=false rather than inventing or padding. You cannot browse or independently verify facts. Never invent quotes, statistics, dates, forecasts, probabilities, names, outcomes, expert views or corroboration. Do not closely paraphrase source wording. The article_markdown field must contain publication-ready article prose and useful Markdown subheadings only. Do not put source lists, research notes, editorial caveats, AI disclaimers, verification checklists, word counts or comments to the editor in the article body. Return valid JSON only with ready_to_publish_as_draft, reason_if_insufficient, research_summary, key_facts, claims_to_verify, missing_perspectives, source_assessment, headline, standfirst, article_markdown and seo_description.",
      prompt: JSON.stringify({
        story:{headline:story.headline,summary:story.summary,desk:story.desk_name,original_url:story.canonical_url},
        source_material:sourceMaterial,
        output:{ready_to_publish_as_draft:"boolean",reason_if_insufficient:"string",research_summary:"string",key_facts:["string"],claims_to_verify:["string"],missing_perspectives:["string"],source_assessment:"string",headline:"string",standfirst:"string",article_markdown:"publication-ready article prose only",seo_description:"string"}
      }),
      temperature: 0.25
    });
    if (draft.ready_to_publish_as_draft === false) throw new Error("The supplied source material is not strong enough for a responsible article draft. " + (draft.reason_if_insufficient || "Add fuller source material, then retry."));
    if (!draft.headline || !draft.article_markdown || draft.article_markdown.trim().length < 1400) throw new Error("The AI response did not meet the article quality threshold. Add fuller source material and retry.");

    const pack = [
      "AI RESEARCH PACK. HUMAN VERIFICATION REQUIRED.",
      "Summary: "+(draft.research_summary || "Not provided."),
      "Key facts: "+(draft.key_facts || []).join(" | "),
      "Claims to verify: "+(draft.claims_to_verify || []).join(" | "),
      "Missing perspectives: "+(draft.missing_perspectives || []).join(" | "),
      "Source assessment: "+(draft.source_assessment || "Not provided."),
      "Supplied source links: "+sourceMaterial.map(s=>s.publisher+": "+s.url).join(" | ")
    ].join("\n");
    const articleBody = draft.article_markdown.trim();
    const slugBase = draft.headline.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70) || "article";
    const slug = slugBase+"-"+crypto.randomUUID().slice(0,8);
    let articleId: string;
    if (existingArticleId) {
      const updated = await sql`update articles set title=${draft.headline.slice(0,180)}, standfirst=${(draft.standfirst || "").slice(0,400)}, body_markdown=${articleBody}, seo_description=${(draft.seo_description || "").slice(0,300)}, is_ai_assisted=true, human_review_required=true, updated_at=now() where id=${existingArticleId} returning id`;
      if (!updated.length) throw new Error("The existing draft could not be updated.");
      articleId = (updated[0] as {id:string}).id;
    } else {
      const created = await sql`insert into articles (story_id,desk_id,title,slug,standfirst,body_markdown,seo_description,article_type,status,is_ai_assisted,human_review_required) values (${storyId},${story.desk_id},${draft.headline.slice(0,180)},${slug},${(draft.standfirst || "").slice(0,400)},${articleBody},${(draft.seo_description || "").slice(0,300)},'feature','draft',true,true) returning id`;
      articleId = (created[0] as {id:string}).id;
    }
    await sql`insert into article_versions (article_id,version_number,title,standfirst,body_markdown,change_summary) select ${articleId},coalesce(max(version_number),0)+1,${draft.headline.slice(0,180)},${(draft.standfirst || "").slice(0,400)},${articleBody},${existingArticleId ? "AI-assisted editorial redraft" : "AI-assisted first draft"} from article_versions where article_id=${articleId}`;
    await sql`update discovered_stories set status='drafted',internal_notes=concat_ws(E'\\n\\n',internal_notes,${pack}::text) where id=${storyId}`;
    await sql`update workflow_runs set status='succeeded',completed_at=now(),items_processed=1,
      metadata=jsonb_build_object('story_id',${storyId}::text,'article_id',${articleId}::text,'source_count',${sourceMaterial.length}::int)
      where id=${(run[0] as {id:string}).id}`;
    await sql`insert into workflow_runs (workflow_type,status,started_at,completed_at,items_processed,metadata)
      values ('drafting','succeeded',now(),now(),1,jsonb_build_object('story_id',${storyId}::text,'article_id',${articleId}::text))`;
    await sql`insert into editorial_audit_log (entity_type,entity_id,action,details)
      values ('story',${storyId},'ai_research_and_draft_created',jsonb_build_object('article_id',${articleId}))`;
    revalidatePath("/admin");
    revalidatePath("/admin/stories");
    revalidatePath("/admin/articles");
    redirect("/admin/articles?generated=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as {digest?:unknown}).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = error instanceof Error ? error.message : "Research and drafting failed";
    await sql`update workflow_runs set status='failed',completed_at=now(),error_message=${message} where id=${(run[0] as {id:string}).id}`;
    const transient = /503|UNAVAILABLE|high demand|429|rate.?limit|temporar|overloaded|timeout/i.test(message);
    const insufficientSource = /source material is not strong enough|source material|quality threshold/i.test(message);
    redirect(transient
      ? "/admin/stories?error=gemini_temporarily_unavailable"
      : insufficientSource ? "/admin/stories?error=insufficient_source_material" : "/admin/stories?error=research_failed");
  }
}
