import { useEffect } from 'react'
import AboutPage from './AboutPage'
import SimulatorPage from './SimulatorPage'

export default function App() {
  const isSimulator = window.location.pathname.endsWith('/simulator.html')

  useEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1))
    if (!targetId) return
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ block: 'start' }))
  }, [])

  return isSimulator ? <SimulatorPage /> : <AboutPage />
}
