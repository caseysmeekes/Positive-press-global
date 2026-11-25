const desks = [
  { number:"01", title:"The Good News", description:"Progress, people and ideas making a positive difference." },
  { number:"02", title:"Planet Positive", description:"Nature, climate solutions and conservation in action." },
  { number:"03", title:"People & Places", description:"Remarkable communities, journeys and human stories." },
  { number:"04", title:"Science & Discovery", description:"Research and discoveries opening up new possibilities." },
  { number:"05", title:"Food & Culture", description:"The people, flavours and traditions bringing us together." },
  { number:"06", title:"Aviation & Aerospace", description:"The changing world of flight, space and global connection." },
  { number:"07", title:"Sport & Officiating", description:"Sporting stories, fair play and the people behind the game." },
  { number:"08", title:"Technology & Innovation", description:"Useful ideas and technology shaping a better future." }
];

export default function Home() {
  return <main>
    <div className="topline"><span>INDEPENDENT GLOBAL PERSPECTIVES</span><span>GOOD NEWS. WIDER PERSPECTIVE.</span></div>
    <header className="site-header">
      <a className="brand" href="#" aria-label="The Positive Press Global home"><span className="brand-mark">P<span>+</span></span><span className="brand-name">THE POSITIVE PRESS <i>GLOBAL</i></span></a>
      <nav aria-label="Main navigation"><a href="#latest">Latest</a><a href="#desks">Explore</a><a href="#about">Our approach</a></nav>
      <a className="header-link" href="#newsletter">Stay connected <span>↗</span></a>
    </header>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> A DIFFERENT VIEW OF THE WORLD</p><h1>There is more<br/>good in the world<br/><em>than we hear.</em></h1><p className="hero-intro">A global perspective on the people, ideas and discoveries moving us forward. Curious, considered journalism with a positive outlook.</p><a className="dark-button" href="#latest">Explore the stories <span>→</span></a></div>
      <div className="hero-art" aria-label="Abstract illustration of a connected world"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orbit orbit-three"></div><div className="globe"><div className="globe-lat"></div><div className="globe-lon"></div><div className="globe-shine"></div></div><span className="art-label art-label-one">PEOPLE</span><span className="art-label art-label-two">PLANET</span><span className="art-label art-label-three">POSSIBILITY</span><span className="art-star star-one">✳</span><span className="art-star star-two">✳</span><span className="art-small">A WORLD OF STORIES</span></div>
      <div className="hero-foot"><span>INDEPENDENT THINKING</span><span>GLOBAL STORIES, HUMAN PERSPECTIVE</span><span>EST. 2026</span></div>
    </section>
    <section className="intro-strip" id="latest"><div><p className="section-kicker">THE EDITOR'S DESK</p><h2>Good things are<br/><em>happening everywhere.</em></h2></div><p className="intro-description">From breakthroughs and bold ideas to everyday acts of progress, we look beyond the headlines to find stories worth sharing. Thoughtful reporting, grounded in evidence and built around a simple belief: the whole picture matters.</p></section>
    <section className="desk-section" id="desks"><div className="section-heading"><div><p className="section-kicker">FIND YOUR CURIOSITY</p><h2>Explore the world.</h2></div><span className="section-count">EIGHT EDITORIAL DESKS / ONE GLOBAL VIEW</span></div><div className="desk-grid">{desks.map(desk=><a className="desk-card" href="#about" key={desk.number}><span className="desk-number">{desk.number}</span><span className="desk-arrow">↗</span><h3>{desk.title}</h3><p>{desk.description}</p></a>)}</div></section>
    <section className="quote-band"><span className="quote-mark">“</span><p>Optimism is not ignoring what is wrong.<br/><em>It is paying attention to what is possible.</em></p><span className="quote-caption">OUR EDITORIAL PHILOSOPHY</span></section>
    <section className="about-section" id="about"><div className="about-left"><p className="section-kicker">WHY WE EXIST</p><h2>Positive.<br/><em>Not naïve.</em></h2></div><div className="about-right"><p>We believe good journalism should help people understand the world in all its complexity. That means finding stories of progress without overlooking the challenges, checking claims rather than chasing easy inspiration, and giving important developments the context they deserve.</p><p>Our newsroom is being built around careful research and human editorial judgement. Technology can help us discover and prepare stories. People remain responsible for what gets published.</p><a href="#newsletter" className="text-link">Follow the journey <span>→</span></a></div></section>
    <section className="newsletter" id="newsletter"><div><p className="section-kicker">A MORE POSITIVE READ</p><h2>Good stories.<br/><em>Worth your time.</em></h2></div><div className="newsletter-copy"><p>Our newsletter is on the way. We are building a thoughtful digest of stories from across the globe, delivered with care and without the noise.</p><span className="coming-soon">NEWSLETTER COMING SOON</span></div></section>
    <footer className="footer"><a className="footer-brand" href="#">THE POSITIVE PRESS <i>GLOBAL</i></a><span>Independent perspective. A world of possibility.</span><span>© 2026 THE POSITIVE PRESS GLOBAL</span></footer>
  </main>;
}
