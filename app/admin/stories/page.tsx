import "../admin.css";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { createStory } from "../actions";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const params = await searchParams;
  const sql = getSql();
  const [desks, stories] = await Promise.all([
    sql`select id, name from editorial_desks where is_active = true order by display_order`,
    sql`select s.id, s.headline, s.summary, s.canonical_url, s.status, s.priority, d.name as desk_name from discovered_stories s left join editorial_desks d on d.id = s.desk_id order by s.discovered_at desc limit 100`
  ]);
  return <main className="newsroom">
    <header className="newsroom-header"><a className="newsroom-brand" href="/">THE POSITIVE PRESS <span>GLOBAL / NEWSROOM</span></a><span className="newsroom-user">{session.user.name || "Editor"}</span></header>
    <AdminNav />
    <section className="admin-content">
      <p className="newsroom-kicker">STORY DISCOVERY</p><h1 className="admin-page-title">Story inbox.</h1>
      <p className="admin-page-intro">Capture potential stories, attach original sources and decide what deserves further research.</p>
      {params.saved && <p className="admin-success">Story added to the inbox.</p>}
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
          {stories.length === 0 ? <p className="admin-empty">Your inbox is empty. Add a lead or connect source discovery later.</p> : <div className="admin-record-list">{stories.map((story: any) => <article className="admin-record story-record" key={story.id}><div><strong>{story.headline}</strong><span>{story.desk_name || "Unassigned"} · Priority {story.priority} · {story.status.replaceAll("_"," ")}</span>{story.summary && <p>{story.summary}</p>}{story.canonical_url && <a href={story.canonical_url} target="_blank" rel="noreferrer">Open original source ↗</a>}</div></article>)}</div>}
        </section>
      </div>
    </section>
    <footer className="newsroom-footer"><a href="/admin">← Newsroom overview</a><span>THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
