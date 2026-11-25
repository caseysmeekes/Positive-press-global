import "../admin.css";
import { getSql } from "@/lib/db";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const sql = getSql();
  const articles = await sql`select a.id, a.title, a.slug, a.status, a.article_type, d.name as desk_name from articles a join editorial_desks d on d.id = a.desk_id order by a.updated_at desc limit 100`;
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">EDITORIAL WORKSPACE</span></header>
    <AdminNav />
    <section className="admin-content">
      <p className="newsroom-kicker">EDITORIAL CONTENT</p><h1 className="admin-page-title">Articles.</h1>
      <p className="admin-page-intro">Manage article drafts and track editorial status. Publication remains disabled until the approval workflow is implemented.</p>
      {params.saved && <p className="admin-success">Draft created.</p>}
      <section className="newsroom-panel"><div className="admin-list-heading"><div><p className="newsroom-kicker">ALL ARTICLES</p><h2>{articles.length} articles</h2></div><a className="admin-primary admin-button-link" href="/admin/articles/new">Create article</a></div>
        {articles.length === 0 ? <p className="admin-empty">No articles yet. Create your first draft.</p> : <div className="admin-record-list">{articles.map((article: any) => <article className="admin-record" key={article.id}><div><strong>{article.title}</strong><span>{article.desk_name} · {article.article_type} · {article.status.replaceAll("_"," ")}</span><small>/{article.slug}</small></div><span className="status-muted">{article.status}</span></article>)}</div>}
      </section>
    </section>
    <footer className="newsroom-footer"><a href="/admin">← Newsroom overview</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
