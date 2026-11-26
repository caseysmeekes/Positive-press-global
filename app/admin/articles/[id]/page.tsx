import "../../admin.css";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { AdminNav } from "@/components/admin-nav";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = getSql();
  const rows = await sql`select a.id, a.title, a.slug, a.status, a.article_type, a.standfirst,
    a.body_markdown, a.seo_description, a.is_ai_assisted, a.human_review_required,
    a.created_at, a.updated_at, d.name as desk_name
    from articles a left join editorial_desks d on d.id = a.desk_id
    where a.id = ${id} limit 1`;
  if (!rows.length) notFound();
  const article = rows[0] as {
    id:string; title:string; slug:string; status:string; article_type:string;
    standfirst:string|null; body_markdown:string; seo_description:string|null;
    is_ai_assisted:boolean; human_review_required:boolean; created_at:string;
    updated_at:string; desk_name:string|null
  };
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">EDITORIAL WORKSPACE</span></header>
    <AdminNav />
    <section className="admin-content">
      <p className="newsroom-kicker">ARTICLE REVIEW / {article.status.replaceAll("_"," ").toUpperCase()}</p>
      <h1 className="admin-page-title">{article.title}</h1>
      <p className="admin-page-intro">{article.desk_name || "Unassigned"} · {article.article_type} · {article.is_ai_assisted ? "AI-assisted draft" : "Editorial draft"}</p>
      <section className="newsroom-panel">
        <div className="admin-list-heading"><div><p className="newsroom-kicker">DRAFT CONTENT</p><h2>Article preview</h2></div><span className="status-muted">{article.status}</span></div>
        {article.standfirst && <p className="admin-page-intro">{article.standfirst}</p>}
        <div className="article-draft-body" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{article.body_markdown}</div>
      </section>
      <section className="newsroom-panel">
        <p className="newsroom-kicker">EDITORIAL CHECKS</p>
        <p>{article.human_review_required ? "Human review required before publication." : "Human review not flagged."}</p>
        {article.seo_description && <p><strong>SEO description:</strong> {article.seo_description}</p>}
        <p className="discovery-note">Last updated: {new Date(article.updated_at).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}</p>
      </section>
      <p><a href="/admin/articles">← Back to all articles</a></p>
    </section>
    <footer className="newsroom-footer"><a href="/admin">← Newsroom overview</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
