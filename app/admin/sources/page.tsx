import "../admin.css";
import { getSql } from "@/lib/db";
import { createSource, seedStarterSources } from "../actions";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ saved?: string; seeded?: string; added?: string; existing?: string }> }) {
  const params = await searchParams;
  const sql = getSql();
  const sources = await sql`select id, name, homepage_url, source_type, country_code, is_active from sources order by name asc`;
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">EDITORIAL WORKSPACE</span></header>
    <AdminNav />
    <section className="admin-content">
      <p className="newsroom-kicker">RESEARCH INFRASTRUCTURE</p><h1 className="admin-page-title">Source register.</h1>
      <p className="admin-page-intro">Maintain publications, official bodies, research organisations and other newsroom sources.</p>
      {params.saved && <p className="admin-success">Source saved.</p>}{params.seeded && <p className="admin-success">Starter source set processed: {params.added || "0"} added, {params.existing || "0"} already registered.</p>}
      <section className="newsroom-panel starter-source-panel">
        <div className="starter-source-heading"><div><p className="newsroom-kicker">STARTER SOURCE LIBRARY</p><h2>30 curated global sources</h2><p>Positive journalism, science, conservation, international coverage, culture, technology, sport and aviation. Existing sources are left untouched.</p></div>
          <form action={seedStarterSources}><button className="admin-primary" type="submit">Add 30 starter sources →</button></form>
        </div>
        <p className="starter-source-note">This adds active sources and their RSS / Atom feed URLs. Feeds are used to discover story leads, not to republish source articles. Check each publisher’s terms before using excerpts, images or other content.</p>
      </section>
      <div className="admin-two-col">
        <section className="newsroom-panel"><p className="newsroom-kicker">ADD A SOURCE</p><h2>Register a source</h2>
          <form action={createSource} className="admin-form">
            <label>Source name<input name="name" required placeholder="e.g. World Health Organization"/></label>
            <label>Homepage URL<input name="homepage_url" type="url" required placeholder="https://example.org"/></label>
            <label>RSS / feed URL <span className="field-optional">Optional</span><input name="feed_url" type="url" placeholder="https://example.org/feed.xml"/></label>
            <div className="admin-form-row">
              <label>Source type<select name="source_type" defaultValue="publication"><option value="publication">Publication</option><option value="official">Official source</option><option value="research">Research</option><option value="ngo">NGO</option><option value="government">Government</option><option value="wire">News wire</option><option value="other">Other</option></select></label>
              <label>Country code<input name="country_code" maxLength={2} placeholder="NZ"/></label>
            </div>
            <label>Editorial notes<textarea name="notes" rows={3} placeholder="Coverage, strengths, verification notes…"/></label>
            <button className="admin-primary" type="submit">Add source</button>
          </form>
        </section>
        <section className="newsroom-panel"><p className="newsroom-kicker">REGISTERED SOURCES</p><h2>{sources.length} sources</h2>
          {sources.length === 0 ? <p className="admin-empty">No sources registered yet. Add your first trusted source.</p> : <div className="admin-record-list">{sources.map((source: any) => <article className="admin-record" key={source.id}><div><strong>{source.name}</strong><span>{source.source_type}{source.country_code ? " · " + source.country_code : ""}</span><a href={source.homepage_url} target="_blank" rel="noreferrer">{source.homepage_url}</a></div><span className={source.is_active ? "status-live" : "status-muted"}>{source.is_active ? "Active" : "Inactive"}</span></article>)}</div>}
        </section>
      </div>
    </section>
    <footer className="newsroom-footer"><a href="/admin">← Newsroom overview</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
