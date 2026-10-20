import SiteHeader from './SiteHeader'
import LightTunnel from './LightTunnel'
import FuzzyText from './FuzzyText'

const members = ['Nathan John', 'Emmanuel S', 'Sahil Sunil', 'Aishwarya A', 'Hrishikesh', 'Thulasi']

export default function AboutPage() {
  return (
    <div className="site-frame landing-frame" id="about">
      <LightTunnel className="landing-light-tunnel" cableColor="#ffffff" pulseColor="#ffffff" cableCount={56} pulseDensity={0.36} flowDirection="inward" mouseInteraction={false} clickSurge={false} tunnelColor="#08080a" tunnelOpacity={0} speed={0.08} pulseSpeed={1.6} pulseLength={0.24} pulseBlend={0.58} pulseWidth={0.8} thickness={0.25} rimWidth={0.15} waviness={0.28} sway={0.35} bend={0.36} glow={0.76} size={1} fadeNear={0.5} fadeFar={2} brightness={0.56} colorVariance={false} grain={false} intro lightMode={false} />
      <SiteHeader page="about" />
      <main className="about-page">
        <section className="about-hero">
          <p className="eyebrow">Digital Computer Fundamentals & Computer Architecture</p>
          <h1 className="fuzzy-title"><FuzzyText className="fuzzy-title-canvas" color="#f3f1ed" fontSize="clamp(70px, 11vw, 148px)" fontWeight={700} fontFamily="DM Sans, Arial, sans-serif" colorSplit={0} trigger="hover" direction="horizontal" baseIntensity={0.2} hoverIntensity={0.5} fuzzRange={30} sliceSize={1} fps={60} transitionDuration={0} intro introDuration={1400} letterSpacing={0} enableHover clickEffect glitchMode={false} glitchInterval={2000} glitchDuration={200}>8 Bit Mini</FuzzyText><em>CPU</em></h1>
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
