import "../../admin.css";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { createArticle } from "../../actions";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const sql = getSql();
  const desks = await sql`select id, name from editorial_desks where is_active = true order by display_order`;
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">{session.user.name || "Editor"}</span></header>
    <AdminNav />
    <section className="admin-content admin-editor-page">
      <p className="newsroom-kicker">EDITORIAL CONTENT / NEW DRAFT</p><h1 className="admin-page-title">Create an article.</h1>
      <p className="admin-page-intro">Start a draft. It remains unpublished and requires a separate human approval before publication.</p>
      <section className="newsroom-panel admin-editor-panel">
        <form action={createArticle} className="admin-form">
          <label>Article headline<input name="title" required maxLength={180} placeholder="Write a clear, engaging headline"/></label>
          <label>Editorial desk<select name="desk_id" required defaultValue=""><option value="" disabled>Select a desk</option>{desks.map((desk: any) => <option key={desk.id} value={desk.id}>{desk.name}</option>)}</select></label>
          <label>Article type<select name="article_type" defaultValue="feature"><option value="news">News</option><option value="feature">Feature</option><option value="analysis">Analysis</option><option value="interview">Interview</option><option value="explainer">Explainer</option><option value="review">Review</option><option value="opinion">Opinion</option></select></label>
          <label>Standfirst<textarea name="standfirst" rows={2} maxLength={400} placeholder="Summarise the central point of the article."/></label>
          <label>Article body<textarea name="body_markdown" required rows={18} placeholder={"Write your article here…\n\nUse blank lines between paragraphs."}/></label>
          <div className="admin-form-actions"><button className="admin-primary" type="submit">Save draft</button><a className="admin-secondary" href="/admin/articles">Cancel</a></div>
        </form>
      </section>
    </section>
    <footer className="newsroom-footer"><a href="/admin/articles">← Back to articles</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
