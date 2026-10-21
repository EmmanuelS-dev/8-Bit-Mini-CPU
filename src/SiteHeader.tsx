type SiteHeaderProps = { page: 'about' | 'simulator' }

export default function SiteHeader({ page }: SiteHeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href="./index.html#about" aria-label="8 Bit Mini CPU home">
        <span className="brand-mark">8</span><span>8 BIT MINI CPU</span>
      </a>
      <nav aria-label="Main navigation">
        <a className={page === 'about' ? 'current' : ''} href="./index.html#about">About</a>
        <a className={page === 'simulator' ? 'current' : ''} href="./simulator.html#circuit">Circuit</a>
        <a href="./simulator.html#guide">Guide & Instruction Set</a>
        <a href="./documentation.md" target="_blank" rel="noreferrer">Documentation</a>
      </nav>
      <span className="project-tag">COLLEGE PROJECT · 8-BIT ARCHITECTURE</span>
    </header>
  )
}
