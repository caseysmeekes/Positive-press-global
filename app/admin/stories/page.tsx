import "../admin.css";
import { getSql } from "@/lib/db";
import { createStory, updateStoryTriage, runSourceDiscovery } from "../actions";
import { researchAndDraftStory } from "../research-actions";
import { runGeminiDiagnostics } from "../gemini-diagnostics";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string; updated?: string; generated?: string; error?: string; scan?: string; checked?: string; fetched?: string; imported?: string; duplicates?: string; ai?: string; aiError?: string; errors?: string; extracted?: string; drafts?: string; draftErrors?: string; geminiDiag?: string }> }) {
  const params = await searchParams;
  let geminiDiag: any = null;
  try { if (params.geminiDiag) geminiDiag = JSON.parse(params.geminiDiag); } catch { geminiDiag = null; }
  const sql = getSql();
  const [desks, stories, workflowRuns] = await Promise.all([
    sql`select id, name from editorial_desks where is_active = true order by display_order`,
    sql`select s.id, s.headline, s.summary, s.canonical_url, s.desk_id, s.status, s.priority, s.verification_status, s.internal_notes, d.name as desk_name from discovered_stories s left join editorial_desks d on d.id = s.desk_id order by s.discovered_at desc limit 100`,
    sql`select id, workflow_type, status, started_at, completed_at, items_processed, metadata, error_message from workflow_runs order by started_at desc limit 20`
  ]);
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">EDITORIAL WORKSPACE</span></header>
    <AdminNav />
    <section className="admin-content">
      <p className="newsroom-kicker">STORY DISCOVERY</p><h1 className="admin-page-title">Story inbox.</h1>
      <p className="admin-page-intro">Capture potential stories, attach original sources and decide what deserves further research.</p>
      {params.saved && <p className="admin-success">Story added to the inbox.</p>}{params.generated && <p className="admin-success">Research pack and AI-assisted draft created. Review it in Articles.</p>}{params.updated && <p className="admin-success">Story triage updated.</p>}{params.error === "assign_desk" && <p className="admin-error">Please assign this story to an editorial desk before creating a draft. Choose a desk in the story triage controls below.</p>}{params.error === "gemini_not_configured" && <p className="admin-error">AI drafting is not configured for this deployment. Add GEMINI_API_KEY to the Vercel Preview environment, then redeploy this branch. Other newsroom actions do not require Gemini.</p>}{params.error === "gemini_temporarily_unavailable" && <p className="admin-error">Gemini is temporarily unavailable or rate-limited. Your story has not been lost. Please wait a minute and try Research &amp; create draft again. Other newsroom actions remain available.</p>}{params.error === "research_failed" && <p className="admin-error">The research and drafting step failed. The error has been recorded in workflow history. Check the source material and retry.</p>}
      <section className="newsroom-panel discovery-panel">
        <p className="newsroom-kicker">SYSTEM ACTIVITY</p><h2>Workflow history</h2>
        <p className="discovery-copy">Recent story discovery, research and drafting attempts, including the recorded error when a step fails.</p>
        {workflowRuns.length === 0 ? <p className="admin-empty">No workflow runs have been recorded yet.</p> : <div className="admin-record-list">
          {(workflowRuns as any[]).map((run) => <article className="admin-record" key={run.id}>
            <strong>{String(run.workflow_type).replaceAll("_", " ")} · {run.status}</strong>
            <span>{new Date(run.started_at).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })} · {run.items_processed ?? 0} processed</span>
            {run.metadata && <p className="discovery-note">Details: {JSON.stringify(run.metadata)}</p>}
            {run.error_message && <p className="admin-error">Recorded error: {String(run.error_message).slice(0, 1600)}</p>}
          </article>)}
        </div>}
      </section>
      <section className="newsroom-panel discovery-panel">
        <div className="discovery-heading"><div><p className="newsroom-kicker">AI CONNECTION CHECK</p><h2>Gemini diagnostics</h2><p className="discovery-copy">Check API-key access, list models available to this key, and make a small generation request against the configured primary and fallback models. The key itself is never displayed.</p></div>
          <form action={runGeminiDiagnostics}><button className="admin-secondary-button" type="submit">Run Gemini diagnostics →</button></form>
        </div>
        {params.geminiDiag === "missing_key" && <p className="admin-error">No GEMINI_API_KEY or GOOGLE_API_KEY is configured in this deployment.</p>}
        {geminiDiag && <div className="admin-record-list">
          <p className={geminiDiag.primaryTest?.ok ? "admin-success" : "admin-error"}>Primary model: {geminiDiag.primary} · {geminiDiag.primaryTest?.ok ? "generation successful" : "generation failed"} ({geminiDiag.primaryTest?.durationMs ?? 0} ms)</p>
          <p className={geminiDiag.fallbackTest?.ok ? "admin-success" : "admin-error"}>Fallback model: {geminiDiag.fallback} · {geminiDiag.fallbackTest?.ok ? "generation successful" : "generation failed"} ({geminiDiag.fallbackTest?.durationMs ?? 0} ms)</p>
          <p className="discovery-note">Model listing: {geminiDiag.modelsList}. {geminiDiag.modelCount} generateContent-capable models returned. Primary listed: {geminiDiag.primaryListed ? "yes" : "no"}. Fallback listed: {geminiDiag.fallbackListed ? "yes" : "no"}.</p>
          {geminiDiag.listError && <p className="admin-error">Model-list error: {geminiDiag.listError}</p>}
          {!geminiDiag.primaryTest?.ok && <p className="admin-error">Primary error: {geminiDiag.primaryTest?.error}</p>}
          {geminiDiag.fallbackTest && !geminiDiag.fallbackTest.ok && <p className="admin-error">Fallback error: {geminiDiag.fallbackTest.error}</p>}
          <p className="discovery-note">Checked at {new Date(geminiDiag.checkedAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}. Diagnostic prompts are minimal and do not create or modify stories.</p>
        </div>}
      </section>
      <section className="newsroom-panel discovery-panel">
        <div className="discovery-heading"><div><p className="newsroom-kicker">AUTOMATED DISCOVERY</p><h2>Scan registered RSS feeds</h2><p className="discovery-copy">Fetch recent feed entries, match duplicate URLs and use AI to screen relevant leads into the editorial desks. Nothing is published automatically.</p></div>
          <form action={runSourceDiscovery}><button className="admin-primary" type="submit">Run source scan →</button></form>
        </div>
        {params.scan && <p className="admin-success">Scan complete: {params.checked || "0"} feeds checked, {params.fetched || "0"} entries fetched, {params.imported || "0"} new stories added, {params.duplicates || "0"} duplicates matched. Full article text extracted: {params.extracted || "0"}. AI drafts created: {params.drafts || "0"}. Draft errors: {params.draftErrors || "0"}. AI screening: {params.ai === "on" ? "enabled" : "not active"}. Feed errors: {params.errors || "0"}.</p>}
        {params.ai === "off" && params.scan && <p className="discovery-note">RSS ingestion ran without AI screening. Add GEMINI_API_KEY in Vercel environment variables to enable story selection and desk scoring.</p>}
        {params.ai === "error" && params.scan && <p className="admin-error">AI screening failed. No new stories were imported during this scan, to avoid bypassing editorial screening. {params.aiError || "Check the Gemini API key, model access and quota, then retry."}</p>}
        <p className="discovery-note">Only active sources with an HTTPS feed URL are scanned. Add feed URLs in <a href="/admin/sources">Source Register</a>.</p>
      </section>
      <div className="admin-two-col">
        <section className="newsroom-panel"><p className="newsroom-kicker">MANUAL STORY INTAKE</p><h2>Add a story lead</h2>
          <form action={createStory} className="admin-form">
            <label>Headline / working title<input name="headline" required placeholder="What happened?"/></label>
            <label>Editorial desk<select name="desk_id" required defaultValue=""><option value="" disabled>Select a desk</option>{desks.map((desk: any) => <option key={desk.id} value={desk.id}>{desk.name}</option>)}</select></label>
            <label>Original source URL<input name="canonical_url" type="url" placeholder="https://…"/></label>
            <label>Short summary<textarea name="summary" rows={4} placeholder="Why is this worth investigating?"/></label>
            <label>Priority<select name="priority" defaultValue="3"><option value="1">1 · Low</option><option value="2">2 · Below normal</option><option value="3">3 · Normal</option><option value="4">4 · High</option><option value="5">5 · Urgent</option></select></label>
            <button className="admin-primary" type="submit">Add to story inbox</button>
          </form>
        </section>
        <section className="newsroom-panel"><p className="newsroom-kicker">INCOMING LEADS</p><h2>{stories.length} stories</h2>
          {stories.length === 0 ? <p className="admin-empty">Your inbox is empty. Add a lead or connect source discovery later.</p> : <div className="admin-record-list">{stories.map((story: any) => <article className="admin-record story-record" key={story.id}><div className="story-record-main"><strong>{story.headline}</strong><span>{story.desk_name || "Unassigned"} · Priority {story.priority} · {story.status.replaceAll("_"," ")}</span>{story.summary && <p>{story.summary}</p>}{story.canonical_url && <a href={story.canonical_url} target="_blank" rel="noreferrer">Open original source ↗</a>}<div className="story-triage-form">{story.desk_id ? <form action={researchAndDraftStory}><input type="hidden" name="story_id" value={story.id}/><button className="admin-primary" type="submit">Research &amp; create draft →</button><p className="discovery-note">Creates a research pack and original AI-assisted draft from the supplied story details and source links. Independent verification and editorial approval are still required.</p></form> : <p className="discovery-note">Assign an editorial desk below before creating a draft.</p>}</div><form action={updateStoryTriage} className="story-triage-form"><input type="hidden" name="story_id" value={story.id}/><label>Editorial desk<select name="desk_id" defaultValue={story.desk_id || ""} required><option value="" disabled>Select a desk</option>{desks.map((desk: any) => <option key={desk.id} value={desk.id}>{desk.name}</option>)}</select></label><label>Pipeline status<select name="status" defaultValue={story.status}><option value="discovered">Discovered</option><option value="shortlisted">Shortlisted</option><option value="researching">Researching</option><option value="drafted">Drafted</option><option value="rejected">Rejected</option><option value="duplicate">Duplicate</option><option value="archived">Archived</option></select></label><label>Verification<select name="verification_status" defaultValue={story.verification_status}><option value="unverified">Unverified</option><option value="in_review">In review</option><option value="partially_verified">Partially verified</option><option value="verified">Verified</option><option value="disputed">Disputed</option></select></label><label>Internal editorial notes<textarea name="internal_notes" rows={2} defaultValue={story.internal_notes || ""} placeholder="What needs checking? Who should be contacted?"/></label><button className="admin-secondary-button" type="submit">Save triage</button></form></div></article>)}</div>}
        </section>
      </div>
    </section>
    <footer className="newsroom-footer"><a href="/admin">← Newsroom overview</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
