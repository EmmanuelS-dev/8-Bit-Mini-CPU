import AboutPage from './AboutPage'
import SimulatorPage from './SimulatorPage'

export default function App() {
  return window.location.pathname.endsWith('/simulator.html') ? <SimulatorPage /> : <AboutPage />
}
