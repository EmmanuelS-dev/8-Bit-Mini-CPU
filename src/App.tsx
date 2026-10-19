import { useEffect, useMemo, useState } from 'react'
import {
  applyManualSignals, demoProgram, hexByte, initialCpuState, installProgram,
  instructionSet, resetCpu, runInstruction, type CpuState, type ManualSignals,
} from './cpu'

type Mode = 'manual' | 'automatic'
const blankSignals: ManualSignals = {
  pcIncrement: false, marFromPc: false, marFromOperand: false, marFromInput: false, ramRead: false,
  ramWrite: false, mdrLoad: false, irLoad: false, loadA: false, loadB: false,
  aFromAlu: false, aluSubtract: false, reset: false,
}
const demoSource = demoProgram.map(hexByte).join(' ')

function format(value: number, bits = 8) {
  return `${value.toString(16).toUpperCase().padStart(bits / 4, '0')}h`
}

function Diagram({ state }: { state: CpuState }) {
  const lit = (name: string) => state.activePaths.includes(name) ? 'wire lit' : 'wire'
  const box = (title: string, value: number | string, x: number, y: number, w: number, h = 76, subtitle = '') => (
    <g className="component" key={title}>
      <rect x={x} y={y} width={w} height={h} rx="9" />
      <text className="component-title" x={x + 14} y={y + 27}>{title}</text>
      <text className="component-value" x={x + 14} y={y + 57}>{typeof value === 'number' ? format(value) : value}</text>
      {subtitle && <text className="component-subtitle" x={x + w - 12} y={y + 57} textAnchor="end">{subtitle}</text>}
    </g>
  )
  return (
    <div className="diagram-scroll">
      <svg className="cpu-diagram" viewBox="0 0 1120 620" role="img" aria-label="Interactive 8-bit CPU datapath. Highlighted lines show the latest data flow.">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" /></marker>
          <marker id="arrow-lit" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" /></marker>
        </defs>
        <path className={lit('pc-mar')} d="M180 105 H285" markerEnd="url(#arrow)" />
        <path className={lit('mar-ram')} d="M420 105 H525" markerEnd="url(#arrow)" />
        <path className={lit('ram-mdr')} d="M680 105 H785" markerEnd="url(#arrow)" />
        <path className={lit('mdr-ir')} d="M855 155 V218 H680" markerEnd="url(#arrow)" />
        <path className={lit('operand-mar')} d="M105 250 V165 H352 V145" markerEnd="url(#arrow)" />
        <path className={lit('input-mar')} d="M205 250 V178 H310 V145" markerEnd="url(#arrow)" />
        <path className={lit('mdr-a')} d="M855 155 V310 H655" markerEnd="url(#arrow)" />
        <path className={lit('mdr-b')} d="M855 155 V480 H655" markerEnd="url(#arrow)" />
        <path className={lit('a-alu')} d="M445 310 H755 V390" markerEnd="url(#arrow)" />
        <path className={lit('b-alu')} d="M445 480 H700 V425 H755" markerEnd="url(#arrow)" />
        <path className={lit('alu-a')} d="M855 430 V550 H320 V350" markerEnd="url(#arrow)" />
        <path className={lit('alu-flags')} d="M930 390 H1010" markerEnd="url(#arrow)" />
        <path className={lit('a-ram')} d="M320 270 V195 H605 V155" markerEnd="url(#arrow)" />
        <path className={lit('mdr-ram')} d="M855 155 V185 H600 V155" markerEnd="url(#arrow)" />
        <path className={lit('input-a')} d="M320 270 V238" markerEnd="url(#arrow)" />
        <path className={lit('input-b')} d="M445 480 H470" markerEnd="url(#arrow)" />
        <path className={lit('operand-a')} d="M105 250 H220 V330 H285" markerEnd="url(#arrow)" />
        <path className={lit('operand-b')} d="M105 250 H220 V480 H285" markerEnd="url(#arrow)" />
        <path className={lit('operand-pc')} d="M105 250 V68 H65 V105 H80" markerEnd="url(#arrow)" />
        <path className={lit('pc-increment')} d="M115 155 V182" markerEnd="url(#arrow)" />
        <text className="wire-label" x="207" y="91">ADDRESS</text>
        <text className="wire-label" x="450" y="91">ADDRESS</text>
        <text className="wire-label" x="710" y="91">DATA</text>
        <text className="wire-label" x="210" y="288">DATA IN</text>
        <text className="wire-label" x="566" y="294">8-BIT DATA BUS</text>
        {box('PROGRAM COUNTER', state.pc, 35, 68, 145, 76, 'PC')}
        {box('MEMORY ADDRESS', state.mar, 285, 68, 135, 76, 'MAR')}
        {box('RAM 256 × 8', state.memory[state.mar] ?? 0, 525, 68, 155, 88, `@ ${format(state.mar)}`)}
        {box('MEMORY DATA', state.mdr, 785, 68, 145, 88, 'MDR')}
        {box('INSTRUCTION', state.ir, 555, 218, 160, 76, 'IR')}
        {box('ACCUMULATOR A', state.a, 285, 270, 160, 80, 'A')}
        {box('REGISTER B', state.b, 285, 440, 160, 80, 'B')}
        <g className="component alu-box">
          <rect x="755" y="355" width="175" height="112" rx="9" />
          <text className="component-title" x="772" y="385">ALU · 8 BIT</text>
          <text className="alu-operation" x="772" y="423">{state.instructionName === 'SUB' ? 'A − B' : ['AND', 'OR', 'XOR', 'NOT'].includes(state.instructionName) ? state.instructionName : 'A + B'}</text>
          <text className="component-subtitle" x="772" y="449">ADD / SUB / LOGIC</text>
        </g>
        <g className="flag-panel">
          <rect x="1010" y="365" width="95" height="106" rx="9" />
          <text x="1024" y="394">FLAGS</text>
          <text x="1024" y="425">Z {state.zero ? '1' : '0'}</text>
          <text x="1024" y="453">C {state.carry ? '1' : '0'}</text>
        </g>
        <text className="diagram-note" x="35" y="588">Highlighted paths show the most recent clock or instruction step.</text>
      </svg>
    </div>
  )
}

function Field({ label, value, onChange, max = 255, helper }: { label: string; value: number; onChange: (value: number) => void; max?: number; helper?: string }) {
  return <label className="field"><span>{label}</span><input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))} /><small>{helper ?? `0–${max} decimal`}</small></label>
}

function App() {
  const [mode, setMode] = useState<Mode>('automatic')
  const [cpu, setCpu] = useState(initialCpuState)
  const [signals, setSignals] = useState(blankSignals)
  const [programText, setProgramText] = useState(demoSource)
  const [running, setRunning] = useState(false)
  const [runInterval, setRunInterval] = useState(850)
  const [dataA, setDataA] = useState(0x12)
  const [dataB, setDataB] = useState(0x06)
  const [operand, setOperand] = useState(0)
  const [ramAddress, setRamAddress] = useState(0)
  const [memoryValue, setMemoryValue] = useState(0)
  const [memoryEdit, setMemoryEdit] = useState({ address: 0x10, value: 0x05 })

  useEffect(() => {
    if (!running || mode !== 'automatic') return
    const timer = window.setInterval(() => setCpu((state) => runInstruction(state)), runInterval)
    return () => window.clearInterval(timer)
  }, [running, mode, runInterval])
  useEffect(() => { if (cpu.halted) setRunning(false) }, [cpu.halted])

  const decoded = useMemo(() => instructionSet[cpu.ir >> 4], [cpu.ir])
  const updateSignal = (key: keyof ManualSignals, value: boolean) => setSignals((old) => ({ ...old, [key]: value }))
  const step = () => setCpu((state) => runInstruction(state))
  const pulseManual = () => {
    setCpu((state) => applyManualSignals(state, signals, { dataA, dataB, operand, ramAddress, memoryValue }))
  }
  const loadDemo = () => {
    setProgramText(demoSource)
    setCpu((state) => installProgram(state, demoSource))
    setRunning(false)
  }
  const editMemory = () => setCpu((state) => {
    const memory = [...state.memory]
    memory[memoryEdit.address] = memoryEdit.value & 0xff
    return { ...state, memory, lastEvent: `RAM[${format(memoryEdit.address)}] set to ${format(memoryEdit.value)}.` }
  })
  const visibleMemory = cpu.memory.slice(0, 16)

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="8-Bit CPU Lab home"><span className="brand-mark">8</span><span>CPU LAB</span></a>
        <nav><a href="#architecture">Architecture</a><a href="#memory">Memory</a><a href="#instruction-set">Instruction set</a><a href="./documentation.md" target="_blank">Documentation</a></nav>
        <span className="project-tag">COLLEGE PROJECT · 8-BIT ARCHITECTURE</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">INTERACTIVE COMPUTER ARCHITECTURE</p>
          <h1>Trace every signal.<br /><em>Understand every cycle.</em></h1>
          <p className="hero-description">A working model of an 8-bit datapath. Drive the registers yourself, or let a control unit sequence fetch, decode, and execute.</p>
        </div>
        <div className="hero-readout"><span>PROCESSOR STATE</span><strong>{cpu.halted ? 'HALTED' : running ? 'RUNNING' : 'READY'}</strong><div><span>PC</span><b>{format(cpu.pc)}</b><span>CYCLES</span><b>{cpu.cycles.toString().padStart(3, '0')}</b></div></div>
      </section>

      <section className="lab-section" id="architecture">
        <div className="section-heading"><div><p className="eyebrow">01 / PROCESSOR WORKSPACE</p><h2>Architecture and datapath</h2></div><div className="mode-switch" role="group" aria-label="Simulation mode"><button className={mode === 'manual' ? 'selected' : ''} onClick={() => { setMode('manual'); setRunning(false) }}>Without control unit</button><button className={mode === 'automatic' ? 'selected' : ''} onClick={() => setMode('automatic')}>With control unit</button></div></div>
        <div className="workspace-grid">
          <section className="panel diagram-panel">
            <div className="panel-heading"><div><h3>8-bit CPU datapath</h3><p>PC · MAR · RAM · MDR · IR · A / B · ALU</p></div><span className="live-badge"><i /> LIVE SIMULATION</span></div>
            <Diagram state={cpu} />
            <div className="event-log"><span className="event-label">LAST CYCLE</span><p>{cpu.lastEvent}</p></div>
          </section>
          <aside className="panel control-panel">
            {mode === 'automatic' ? <>
              <div className="panel-heading"><div><p className="eyebrow">SEQUENCER</p><h3>Control unit</h3></div><span className="mode-chip">AUTOMATIC</span></div>
              <p className="panel-intro">The decoder reads the instruction in IR and asserts the signals needed for each operation.</p>
              <div className="decode-card"><span>DECODED INSTRUCTION</span><strong>{decoded.mnemonic} <small>{format(cpu.ir & 0x0f, 4)}</small></strong><p>{decoded.description}</p></div>
              <div className="signal-list"><div><span>FETCH</span><b className={cpu.activePaths.some((path) => ['pc-mar', 'mar-ram', 'ram-mdr', 'mdr-ir'].includes(path)) ? 'signal-on' : ''}>PC → MAR → RAM → MDR → IR</b></div><div><span>EXECUTE</span><b className={cpu.activePaths.some((path) => path.includes('alu') || path === 'operand-a' || path === 'operand-b') ? 'signal-on' : ''}>{decoded.mnemonic} control signals</b></div><div><span>ZERO FLAG</span><b>{cpu.zero ? 'SET · 1' : 'CLEAR · 0'}</b></div></div>
              <div className="action-row"><button className="primary-button" onClick={step} disabled={cpu.halted}>Step instruction <span>→</span></button><button className="secondary-button" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run'}</button><button className="icon-button" onClick={() => { setRunning(false); setCpu((state) => resetCpu(state)) }} aria-label="Reset CPU">Reset</button></div>
              <label className="speed-control">Run interval <select value={runInterval} onChange={(event) => setRunInterval(Number(event.target.value))}><option value="1300">Slow · 1.3 s</option><option value="850">Normal · 0.85 s</option><option value="450">Fast · 0.45 s</option></select></label>
            </> : <>
              <div className="panel-heading"><div><p className="eyebrow">SIGNAL PANEL</p><h3>Manual control</h3></div><span className="mode-chip muted">NO CONTROL UNIT</span></div>
              <p className="panel-intro">Choose inputs and control signals, then apply one clock edge. Enabled registers latch their input on that edge.</p>
              <div className="manual-fields"><Field label="Data input A" value={dataA} onChange={setDataA} /><Field label="Data input B" value={dataB} onChange={setDataB} /><Field label="Instruction operand" value={operand} onChange={setOperand} max={15} helper="0–15 · 4-bit" /><Field label="RAM address input" value={ramAddress} onChange={setRamAddress} helper="0–255 decimal" /><Field label="RAM write data" value={memoryValue} onChange={setMemoryValue} /></div>
              <div className="signal-grid">
                {([
                  ['marFromPc', 'PC → MAR'], ['marFromOperand', 'Operand → MAR'], ['marFromInput', 'Input address → MAR'], ['ramRead', 'RAM read'], ['ramWrite', 'RAM write'],
                  ['mdrLoad', 'Load MDR input'], ['irLoad', 'MDR → IR'], ['loadA', 'Load register A'], ['loadB', 'Load register B'],
                  ['aFromAlu', 'ALU → A'], ['aluSubtract', 'ALU subtract'], ['pcIncrement', 'Increment PC'],
                ] as [keyof ManualSignals, string][]).map(([key, label]) => <label className="signal-toggle" key={key}><input type="checkbox" checked={signals[key]} onChange={(event) => updateSignal(key, event.target.checked)} /><span>{label}</span></label>)}
              </div>
              <div className="action-row"><button className="primary-button" onClick={pulseManual}>Apply clock edge <span>→</span></button><button className="secondary-button" onClick={() => setSignals(blankSignals)}>Clear signals</button><button className="icon-button" onClick={() => setCpu((state) => resetCpu(state))}>Reset</button></div>
            </>}
          </aside>
        </div>
      </section>

      <section className="lower-grid" id="memory">
        <section className="panel program-panel">
          <div className="panel-heading"><div><p className="eyebrow">02 / PROGRAM LOADER</p><h3>Load instructions into RAM</h3></div><button className="text-button" onClick={loadDemo}>Restore sample</button></div>
          <p className="panel-intro">Enter hexadecimal instruction bytes in address order. Spaces and line breaks are allowed. Program starts at address 00.</p>
          <label className="program-input"><span>PROGRAM BYTES · HEX</span><textarea value={programText} onChange={(event) => setProgramText(event.target.value)} spellCheck={false} /></label>
          <div className="program-actions"><button className="primary-button" onClick={() => { setCpu((state) => installProgram(state, programText)); setRunning(false) }}>Load program <span>→</span></button><span>Sample: <code>61 72 31 53 F0</code> adds 1 + 2 and stores at RAM[3].</span></div>
        </section>
        <section className="panel memory-panel">
          <div className="panel-heading"><div><p className="eyebrow">03 / 256 × 8 STORAGE</p><h3>RAM inspector</h3></div><span className="memory-count">256 addresses</span></div>
          <div className="memory-table" role="table" aria-label="RAM addresses 0 through 15"><div className="memory-row table-header" role="row"><span>ADDRESS</span><span>VALUE</span><span>ROLE</span></div>{visibleMemory.map((value, address) => <div className={`memory-row ${cpu.mar === address ? 'current-address' : ''} ${cpu.pc === address ? 'program-address' : ''}`} role="row" key={address}><span>{format(address)}</span><b>{format(value)}</b><span>{address < 5 ? 'Program' : address === 0x10 || address === 0x11 ? 'Data' : 'Available'}</span></div>)}</div>
          <div className="memory-edit"><Field label="Address" value={memoryEdit.address} onChange={(value) => setMemoryEdit((old) => ({ ...old, address: value }))} helper="0–255 decimal" /><Field label="Byte value" value={memoryEdit.value} onChange={(value) => setMemoryEdit((old) => ({ ...old, value }))} /><button className="secondary-button" onClick={editMemory}>Write RAM</button><p className="selected-memory">RAM[{format(memoryEdit.address)}] currently contains <b>{format(cpu.memory[memoryEdit.address] ?? 0)}</b></p></div>
        </section>
      </section>

      <section className="panel register-panel">
        <div className="panel-heading"><div><p className="eyebrow">04 / LIVE STATE</p><h3>Register file and flags</h3></div><span className="register-caption">Unsigned values · hexadecimal display</span></div>
        <div className="register-grid">{[['PC', cpu.pc, 'Program counter'], ['MAR', cpu.mar, 'Memory address'], ['MDR', cpu.mdr, 'Memory data'], ['IR', cpu.ir, 'Instruction'], ['A', cpu.a, 'Accumulator'], ['B', cpu.b, 'General register']].map(([name, value, description]) => <div className="register-card" key={name as string}><span>{name}</span><strong>{format(value as number)}</strong><small>{description}</small></div>)}<div className="register-card flag-card"><span>FLAGS</span><strong>Z {cpu.zero ? 1 : 0} · C {cpu.carry ? 1 : 0}</strong><small>Zero · carry / no borrow</small></div></div>
      </section>

      <section className="panel instruction-panel" id="instruction-set">
        <div className="panel-heading"><div><p className="eyebrow">05 / REFERENCE</p><h3>Instruction set</h3></div><span className="register-caption">One byte · 4-bit opcode + 4-bit operand</span></div>
        <div className="instruction-grid">{instructionSet.map(({ opcode, mnemonic, description }) => <div className="instruction-card" key={opcode}><code>{opcode.toString(16).toUpperCase()}</code><strong>{mnemonic}</strong><span>{description}</span></div>)}</div>
      </section>

      <footer><span>8-BIT CPU LAB</span><span>Built from the project datapath reference · React + TypeScript</span><a href="./README.md" target="_blank">Project README</a></footer>
    </main>
  )
}

export default App
