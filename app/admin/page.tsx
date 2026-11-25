import "./admin.css";
import { getSql } from "@/lib/db";
import { AdminNav } from "@/components/admin-nav";

type Counts = { stories: number; drafts: number; review: number; published: number; sources: number };
export const dynamic = "force-dynamic";

async function getCounts(): Promise<Counts | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      select
        (select count(*)::int from discovered_stories where status not in ('rejected','duplicate','archived')) as stories,
        (select count(*)::int from articles where status in ('draft','researching')) as drafts,
        (select count(*)::int from articles where status = 'awaiting_approval') as review,
        (select count(*)::int from articles where status = 'published') as published,
        (select count(*)::int from sources where is_active = true) as sources
    `;
    return rows[0] as Counts;
  } catch (error) {
    console.error("Newsroom database query failed", error);
    return null;
  }
}

export default async function AdminPage() {
  const counts = await getCounts();
  const metrics = [
    { label: "Story inbox", value: counts?.stories ?? "—", detail: "Stories in the pipeline" },
    { label: "Draft articles", value: counts?.drafts ?? "—", detail: "Being prepared" },
    { label: "Awaiting approval", value: counts?.review ?? "—", detail: "Human editorial review" },
    { label: "Published", value: counts?.published ?? "—", detail: "Live articles" }
  ];

  return (
    <main className="newsroom">
      <header className="newsroom-header">
        <a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a>
        <div className="newsroom-user">EDITORIAL WORKSPACE</div>
      </header>
      <AdminNav />
      <section className="newsroom-welcome">
        <p className="newsroom-kicker">EDITORIAL WORKSPACE / PRIVATE</p>
        <h1>Story triage newsroom.</h1>
        <p>Review incoming story leads, check their sources, set priorities and decide what moves into research.</p>
      </section>
      {!counts && <div className="newsroom-alert">The database connection needs attention. Check DATABASE_URL in Vercel and confirm the Phase 2 schema has been applied in Neon.</div>}
      <section className="newsroom-metrics" aria-label="Newsroom overview">
        {metrics.map((metric) => <div className="newsroom-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}
      </section>
      <section className="newsroom-lower">
        <div className="newsroom-panel">
          <div className="newsroom-panel-heading"><div><p className="newsroom-kicker">EDITORIAL PIPELINE</p><h2>From discovery to publication</h2></div><span className="pipeline-status">HUMAN APPROVAL REQUIRED</span></div>
          <div className="pipeline-list">
            {[
              ["01", "Discovered", "New stories from monitored sources"],
              ["02", "Researching", "Checking facts and gathering evidence"],
              ["03", "Drafting", "Preparing an article for editorial review"],
              ["04", "Awaiting approval", "An editor checks the current article version"],
              ["05", "Published", "Approved articles appear on the public site"]
            ].map(([number, title, description]) => <div className="pipeline-row" key={number}><span>{number}</span><div><strong>{title}</strong><small>{description}</small></div><b>→</b></div>)}
          </div>
        </div>
        <aside className="newsroom-panel newsroom-side">
          <p className="newsroom-kicker">SOURCE REGISTER</p><h2>Research starts here.</h2>
          <strong className="source-count">{counts?.sources ?? "—"}</strong>
          <p>Active sources registered</p><a className="admin-primary admin-button-link" href="/admin/sources">Manage sources →</a>
        </aside>
      </section>
      <footer className="newsroom-footer"><a href="/">← View public publication</a><span>THE POSITIVE PRESS GLOBAL · EDITORIAL WORKSPACE</span></footer>
    </main>
  );
}
