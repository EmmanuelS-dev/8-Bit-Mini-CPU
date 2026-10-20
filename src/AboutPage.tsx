import SiteHeader from './SiteHeader'

const members = ['Nathan John', 'Emmanuel S', 'Sahil Sunil', 'Aishwarya A', 'N Hrishikesh', 'Thulasi']

export default function AboutPage() {
  return (
    <div className="site-frame" id="about">
      <SiteHeader page="about" />
      <main className="about-page">
        <section className="about-hero">
          <p className="eyebrow">Digital Computer Fundamentals & Computer Architecture</p>
          <h1><span>8 Bit Mini</span><em>CPU</em></h1>
          <p>An interactive study of how an eight-bit processor moves data, follows instructions, and produces results.</p>
          <a className="primary-button about-cta" href="./simulator.html#guide">Explore the simulator <span>→</span></a>
          <div className="hero-rule"><span>8-BIT DATA PATH</span><span>256 × 8 RAM</span><span>MANUAL + AUTOMATIC CONTROL</span></div>
        </section>

        <section className="about-members" aria-labelledby="team-heading">
          <div className="about-section-heading">
            <div><p className="eyebrow">THE PROJECT TEAM</p><h2 id="team-heading">About the group</h2></div>
          </div>
          <div className="members-grid">
            {members.map((name, index) => <article className="member-card" key={index}><span>0{index + 1} / TEAM MEMBER</span><h3>{name}</h3></article>)}
          </div>
        </section>

        <section className="about-summary">
          <div><p className="eyebrow">WHAT YOU CAN EXPLORE</p><h2>From a clock edge to a complete instruction</h2></div>
          <p>Follow the program counter, memory address and data registers, instruction register, A and B registers, and the arithmetic logic unit. Choose manual control to send signals one clock at a time, or use the teaching control unit to run a small program.</p>
          <a className="secondary-button" href="./simulator.html#circuit">Open the circuit page <span>→</span></a>
        </section>
      </main>
      <footer className="site-footer"><span>8 BIT MINI CPU</span><span>Interactive computer architecture project</span><a href="./simulator.html#guide">Open simulator</a></footer>
    </div>
  )
}
