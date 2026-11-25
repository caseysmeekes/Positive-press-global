import "../admin.css";
import { getSql } from "@/lib/db";
import { createStory, updateStoryTriage, runSourceDiscovery } from "../actions";
import { researchAndDraftStory } from "../research-actions";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string; updated?: string; generated?: string; scan?: string; checked?: string; fetched?: string; imported?: string; duplicates?: string; ai?: string; errors?: string; extracted?: string }> }) {
  const params = await searchParams;
  const sql = getSql();
  const [desks, stories] = await Promise.all([
    sql`select id, name from editorial_desks where is_active = true order by display_order`,
    sql`select s.id, s.headline, s.summary, s.canonical_url, s.status, s.priority, s.verification_status, s.internal_notes, d.name as desk_name from discovered_stories s left join editorial_desks d on d.id = s.desk_id order by s.discovered_at desc limit 100`
  ]);
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">EDITORIAL WORKSPACE</span></header>
    <AdminNav />
    <section className="admin-content">
      <p className="newsroom-kicker">STORY DISCOVERY</p><h1 className="admin-page-title">Story inbox.</h1>
      <p className="admin-page-intro">Capture potential stories, attach original sources and decide what deserves further research.</p>
      {params.saved && <p className="admin-success">Story added to the inbox.</p>}{params.generated && <p className="admin-success">Research pack and AI-assisted draft created. Review it in Articles.</p>}{params.updated && <p className="admin-success">Story triage updated.</p>}
      <section className="newsroom-panel discovery-panel">
        <div className="discovery-heading"><div><p className="newsroom-kicker">AUTOMATED DISCOVERY</p><h2>Scan registered RSS feeds</h2><p className="discovery-copy">Fetch recent feed entries, match duplicate URLs and use AI to screen relevant leads into the editorial desks. Nothing is published automatically.</p></div>
          <form action={runSourceDiscovery}><button className="admin-primary" type="submit">Run source scan →</button></form>
        </div>
        {params.scan && <p className="admin-success">Scan complete: {params.checked || "0"} feeds checked, {params.fetched || "0"} entries fetched, {params.imported || "0"} new stories added, {params.duplicates || "0"} duplicates matched. Full article text extracted: {params.extracted || "0"}. AI screening: {params.ai === "on" ? "enabled" : "not active"}. Feed errors: {params.errors || "0"}.</p>}
        {params.ai === "off" && params.scan && <p className="discovery-note">RSS ingestion ran, but AI screening was not active. Add OPENAI_API_KEY in Vercel environment variables to enable story selection and desk scoring.</p>}
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
          {stories.length === 0 ? <p className="admin-empty">Your inbox is empty. Add a lead or connect source discovery later.</p> : <div className="admin-record-list">{stories.map((story: any) => <article className="admin-record story-record" key={story.id}><div className="story-record-main"><strong>{story.headline}</strong><span>{story.desk_name || "Unassigned"} · Priority {story.priority} · {story.status.replaceAll("_"," ")}</span>{story.summary && <p>{story.summary}</p>}{story.canonical_url && <a href={story.canonical_url} target="_blank" rel="noreferrer">Open original source ↗</a>}<form action={researchAndDraftStory} className="story-triage-form"><input type="hidden" name="story_id" value={story.id}/><button className="admin-primary" type="submit">Research &amp; create draft →</button><p className="discovery-note">Creates a research pack and original AI-assisted draft from the supplied story details and source links. Independent verification and editorial approval are still required.</p></form><form action={updateStoryTriage} className="story-triage-form"><input type="hidden" name="story_id" value={story.id}/><label>Pipeline status<select name="status" defaultValue={story.status}><option value="discovered">Discovered</option><option value="shortlisted">Shortlisted</option><option value="researching">Researching</option><option value="drafted">Drafted</option><option value="rejected">Rejected</option><option value="duplicate">Duplicate</option><option value="archived">Archived</option></select></label><label>Verification<select name="verification_status" defaultValue={story.verification_status}><option value="unverified">Unverified</option><option value="in_review">In review</option><option value="partially_verified">Partially verified</option><option value="verified">Verified</option><option value="disputed">Disputed</option></select></label><label>Internal editorial notes<textarea name="internal_notes" rows={2} defaultValue={story.internal_notes || ""} placeholder="What needs checking? Who should be contacted?"/></label><button className="admin-secondary-button" type="submit">Save triage</button></form></div></article>)}</div>}
        </section>
      </div>
    </section>
    <footer className="newsroom-footer"><a href="/admin">← Newsroom overview</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
