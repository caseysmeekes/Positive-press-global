const desks = [
  { number: "01", title: "The Good News", description: "People, ideas and progress worth knowing about.", tone: "sun", href: "#good-news" },
  { number: "02", title: "Planet Positive", description: "Nature, climate solutions and conservation.", tone: "leaf", href: "#desks" },
  { number: "03", title: "People & Places", description: "Remarkable communities and human stories.", tone: "people", href: "#desks" },
  { number: "04", title: "Science & Discovery", description: "Research opening up new possibilities.", tone: "science", href: "#desks" },
  { number: "05", title: "Food & Culture", description: "Flavours, traditions and the people behind them.", tone: "food", href: "#desks" },
  { number: "06", title: "Aviation & Aerospace", description: "The changing world of flight and space.", tone: "aviation", href: "#desks" },
  { number: "07", title: "Sport & Officiating", description: "Sport, fair play and the people behind the game.", tone: "sport", href: "#desks" },
  { number: "08", title: "Technology & Innovation", description: "Ideas and technology shaping what comes next.", tone: "tech", href: "#desks" }
];

const highlights = [
  { label: "Planet Positive", title: "A closer look at the people caring for our natural world", description: "Explore conservation, restoration and practical ideas for a healthier planet.", image: "story-planet", number: "01" },
  { label: "People & Places", title: "Meet the communities finding new ways to thrive", description: "Discover local initiatives, remarkable journeys and stories of connection.", image: "story-people", number: "02" },
  { label: "Food & Culture", title: "The food, traditions and creativity that bring us together", description: "A world of makers, growers, cooks and cultural discoveries.", image: "story-food", number: "03" }
];

export default function Home() {
  return <main className="home">
    <div className="topline"><span>INDEPENDENT GLOBAL PERSPECTIVES</span><span>GOOD NEWS. WIDER PERSPECTIVE.</span></div>
    <header className="site-header">
      <a className="brand" href="#" aria-label="The Positive Press Global home">
        <span className="brand-mark">P<span>+</span></span>
        <span className="brand-name">THE POSITIVE PRESS <i>GLOBAL</i></span>
      </a>
      <nav aria-label="Main navigation"><a className="nav-active" href="#latest">Latest</a><a href="#desks">Explore</a><a href="#about">Our approach</a></nav>
      <a className="header-link" href="#newsletter">The weekly read <span>↗</span></a>
    </header>

    <section className="hero hero-modern">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-dot" /> A GLOBAL HOME FOR GOOD NEWS</p>
        <h1>People, ideas<br />and solutions<br />making the world<br /><em>brighter.</em></h1>
        <p className="hero-intro">Positive Press Global explores the people, progress and possibilities shaping a more connected world. Curious journalism, grounded in evidence and told with perspective.</p>
        <div className="hero-actions"><a className="dark-button" href="#latest">Explore the stories <span>→</span></a><a className="light-button" href="#about">Our approach</a></div>
        <div className="hero-note"><span className="note-mark">✳</span><span>Optimism, with its eyes open.</span></div>
      </div>
      <div className="hero-feature">
        <div className="hero-photo" role="img" aria-label="Mountain landscape at sunrise"></div>
        <div className="hero-photo-shade"></div>
        <div className="feature-copy">
          <span className="feature-label">A WORLD OF STORIES</span>
          <p className="feature-title">Look closer.<br />Find what moves us forward.</p>
          <p className="feature-description">From local action to global breakthroughs, discover a fuller picture of progress.</p>
          <a href="#desks" className="feature-link">Explore our editorial desks <span>→</span></a>
        </div>
        <span className="feature-index">P / G — 001</span>
      </div>
      <div className="hero-foot"><span>INDEPENDENT THINKING</span><span>GLOBAL STORIES, HUMAN PERSPECTIVE</span><span>EST. 2026</span></div>
    </section>

    <section className="category-strip" aria-label="Explore topics">
      <span className="category-intro">EXPLORE BY INTEREST</span>
      <a href="#good-news"><span>✳</span> Good news</a>
      <a href="#desks"><span>◌</span> Planet</a>
      <a href="#desks"><span>⌂</span> People</a>
      <a href="#desks"><span>✧</span> Discovery</a>
      <a href="#desks"><span>◇</span> Culture</a>
      <a href="#desks"><span>↗</span> Innovation</a>
    </section>

    <section className="latest-section" id="latest">
      <div className="section-heading">
        <div><p className="section-kicker">A GLOBAL VIEW, WITH A POSITIVE OUTLOOK</p><h2>Stories worth <em>your attention.</em></h2></div>
        <span className="section-count">THE POSITIVE PRESS / EDITORIAL PREVIEW</span>
      </div>
      <div className="highlight-grid" id="good-news">
        {highlights.map(item => <article className="highlight-card" key={item.number}>
          <div className={`highlight-image ${item.image}`} role="img" aria-label={item.label}></div>
          <div className="highlight-body">
            <div className="highlight-meta"><span>{item.label}</span><span>{item.number}</span></div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="card-read">EXPLORE THE DESK <span>↗</span></span>
          </div>
        </article>)}
      </div>
      <p className="editorial-note">Our live story feed is being prepared. These previews introduce the subjects and perspectives you'll find in the publication.</p>
    </section>

    <section className="desk-section" id="desks">
      <div className="section-heading">
        <div><p className="section-kicker">FOLLOW YOUR CURIOSITY</p><h2>Eight desks. <em>One world.</em></h2></div>
        <p className="desk-intro">Specialist coverage alongside the good news. Explore the subjects that help make sense of our changing world.</p>
      </div>
      <div className="desk-grid">{desks.map(desk => <a className="desk-card" href={desk.href} key={desk.number}>
        <span className="desk-number">{desk.number}</span><span className={`desk-symbol ${desk.tone}`}>✳</span>
        <h3>{desk.title}</h3><p>{desk.description}</p><span className="desk-arrow">↗</span>
      </a>)}</div>
    </section>

    <section className="manifesto-band">
      <div className="manifesto-mark">“</div>
      <div><p className="section-kicker">OUR EDITORIAL PHILOSOPHY</p><p className="manifesto-quote">Optimism is not ignoring what is wrong.<br /><em>It is paying attention to what is possible.</em></p></div>
      <span className="manifesto-side">POSITIVE.<br />NOT NAÏVE.</span>
    </section>

    <section className="about-section" id="about">
      <div className="about-left"><p className="section-kicker">WHY WE EXIST</p><h2>A fuller picture<br />of the <em>world.</em></h2></div>
      <div className="about-right"><p>Good journalism should help us understand the world in all its complexity. That means finding stories of progress without overlooking the challenges, checking claims rather than chasing easy inspiration, and giving important developments the context they deserve.</p><p>Technology can help our newsroom discover and prepare stories. People remain responsible for what gets published. Every article is subject to human editorial review.</p><a href="#newsletter" className="text-link">Get to know us <span>→</span></a></div>
    </section>

    <section className="newsletter" id="newsletter">
      <div className="newsletter-icon">✉</div>
      <div className="newsletter-heading"><p className="section-kicker">A MORE POSITIVE READ</p><h2>Good stories.<br /><em>Worth your time.</em></h2></div>
      <div className="newsletter-copy"><p>A thoughtful digest of stories from across the globe, delivered with care and without the noise.</p><span className="coming-soon">THE WEEKLY READ — COMING SOON</span></div>
    </section>
    <footer className="footer"><a className="footer-brand" href="#">THE POSITIVE PRESS <i>GLOBAL</i></a><span>Independent perspective. A world of possibility.</span><span>© 2026 THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
