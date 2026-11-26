"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";

const formValue = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v.trim() : "";
};

export async function researchAndDraftStory(data: FormData) {
  const storyId = formValue(data, "story_id");
  if (!storyId) throw new Error("Story ID is required.");
  if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) throw new Error("GEMINI_API_KEY is missing from this deployment.");

  const sql = getSql();
  const rows = await sql`select s.id,s.headline,s.summary,s.canonical_url,s.desk_id,d.name as desk_name
    from discovered_stories s left join editorial_desks d on d.id=s.desk_id where s.id=${storyId} limit 1`;
  if (!rows.length) throw new Error("Story not found.");
  const story = rows[0] as {id:string;headline:string;summary:string|null;canonical_url:string|null;desk_id:string|null;desk_name:string|null};
  if (!story.desk_id) redirect("/admin/stories?error=assign_desk");

  const sources = await sql`select url,title,publisher,source_role,notes from story_sources where story_id=${storyId} order by created_at asc limit 8`;
  const sourceMaterial = (sources as {url:string;title:string|null;publisher:string|null;source_role:string;notes:string|null}[]).map(s => ({
    url:s.url, title:s.title, publisher:s.publisher, role:s.source_role, editorial_notes:s.notes
  }));
  if (story.canonical_url && !sourceMaterial.some(s=>s.url===story.canonical_url)) {
    sourceMaterial.unshift({url:story.canonical_url,title:story.headline,publisher:"Original story link",role:"primary",editorial_notes:null});
  }
  if (!sourceMaterial.length && !story.summary) throw new Error("This story has no source material. Add a source URL or summary first.");

  const run = await sql`insert into workflow_runs (workflow_type,status,started_at,metadata)
    values ('research','running',now(),jsonb_build_object('story_id',${storyId}::text,'source_count',${sourceMaterial.length}::int)) returning id`;
  try {
    const { generateGeminiJson } = await import("@/lib/gemini");
    const draft = await generateGeminiJson<{
      research_summary?:string;key_facts?:string[];claims_to_verify?:string[];
      missing_perspectives?:string[];source_assessment?:string;headline?:string;
      standfirst?:string;article_markdown?:string;seo_description?:string
    }>({
      systemInstruction: "You are the research editor and feature writer for The Positive Press Global. Produce an original, careful article draft and an editorial research pack using only the supplied information. You cannot browse or independently verify facts. Never invent details, quotes, statistics, dates, names or corroboration. Clearly label all unsupported or single-source claims as needing verification. Do not closely paraphrase source notes. Return valid JSON only.",
      prompt: JSON.stringify({
        story:{headline:story.headline,summary:story.summary,desk:story.desk_name,original_url:story.canonical_url},
        source_material:sourceMaterial,
        output:{research_summary:"string",key_facts:["string"],claims_to_verify:["string"],missing_perspectives:["string"],source_assessment:"string",headline:"string",standfirst:"string",article_markdown:"string",seo_description:"string"}
      }),
      temperature: 0.25
    });
    if (!draft.headline || !draft.article_markdown) throw new Error("The AI response did not include a complete article draft.");

    const pack = [
      "AI RESEARCH PACK. HUMAN VERIFICATION REQUIRED.",
      "Summary: "+(draft.research_summary || "Not provided."),
      "Key facts: "+(draft.key_facts || []).join(" | "),
      "Claims to verify: "+(draft.claims_to_verify || []).join(" | "),
      "Missing perspectives: "+(draft.missing_perspectives || []).join(" | "),
      "Source assessment: "+(draft.source_assessment || "Not provided."),
      "Supplied source links: "+sourceMaterial.map(s=>s.publisher+": "+s.url).join(" | ")
    ].join("\n");
    const articleBody = draft.article_markdown + "\n\n## Sources supplied\n" +
      sourceMaterial.map(s=>"- ["+(s.publisher || s.title || "Source")+"]("+s.url+")").join("\n") +
      "\n\n*AI-assisted working draft. Claims, facts, source quality, image rights and quotations require human review. This draft has not been independently fact-checked.*";
    const slugBase = draft.headline.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70) || "article";
    const slug = slugBase+"-"+crypto.randomUUID().slice(0,8);
    const created = await sql`with a as (
      insert into articles (story_id,desk_id,title,slug,standfirst,body_markdown,seo_description,article_type,status,is_ai_assisted,human_review_required)
      values (${storyId},${story.desk_id},${draft.headline.slice(0,180)},${slug},${(draft.standfirst || "").slice(0,400)},${articleBody},${(draft.seo_description || "").slice(0,300)},'feature','draft',true,true)
      returning id,title,standfirst,body_markdown
    )
    insert into article_versions (article_id,version_number,title,standfirst,body_markdown,change_summary)
    select id,1,title,standfirst,body_markdown,'AI-assisted first draft and research pack' from a returning article_id`;
    await sql`update discovered_stories set status='drafted',internal_notes=concat_ws(E'\\n\\n',internal_notes,${pack}) where id=${storyId}`;
    await sql`update workflow_runs set status='succeeded',completed_at=now(),items_processed=1,
      metadata=jsonb_build_object('story_id',${storyId}::text,'article_id',${(created[0] as {article_id:string}).article_id}::text,'source_count',${sourceMaterial.length}::int)
      where id=${(run[0] as {id:string}).id}`;
    await sql`insert into workflow_runs (workflow_type,status,started_at,completed_at,items_processed,metadata)
      values ('drafting','succeeded',now(),now(),1,jsonb_build_object('story_id',${storyId}::text,'article_id',${(created[0] as {article_id:string}).article_id}::text))`;
    await sql`insert into editorial_audit_log (entity_type,entity_id,action,details)
      values ('story',${storyId},'ai_research_and_draft_created',jsonb_build_object('article_id',${(created[0] as {article_id:string}).article_id}))`;
    revalidatePath("/admin");
    revalidatePath("/admin/stories");
    revalidatePath("/admin/articles");
    redirect("/admin/articles?generated=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as {digest?:unknown}).digest).startsWith("NEXT_REDIRECT")) throw error;
    await sql`update workflow_runs set status='failed',completed_at=now(),error_message=${error instanceof Error ? error.message : "Research and drafting failed"} where id=${(run[0] as {id:string}).id}`;
    throw error;
  }
}
