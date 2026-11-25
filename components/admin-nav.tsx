export function AdminNav() {
  return <nav className="admin-nav" aria-label="Newsroom navigation">
    <a href="/admin">Overview</a><a href="/admin/stories">Story inbox</a><a href="/admin/sources">Sources</a><a href="/admin/articles">Articles</a><a href="/admin/articles/new" className="admin-nav-cta">+ New article</a>
  </nav>;
}
