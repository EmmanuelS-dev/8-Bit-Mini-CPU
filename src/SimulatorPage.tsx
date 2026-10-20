import { useEffect, useMemo, useRef, useState } from 'react'
import {
  demoProgramText, formatByte, getInstruction, initialCpuState, installProgram,
  instructionSet, microstepLabel, resetCpu, stepClock, stepInstruction, type CpuState,
} from './cpu'
import SiteHeader from './SiteHeader'

type Mode = 'manual' | 'automatic'

const pathLabels: Record<string, string> = {
  'pc-mar': 'PC → MAR', 'pc-increment': 'PC increment', 'mar-ram': 'MAR → RAM · address',
  'ram-mdr': 'RAM → MDR · data', 'mdr-ram': 'MDR → RAM · data', 'mdr-ir': 'MDR → IR',
  'mdr-operand': 'MDR → operand', 'operand-mar': 'Operand → MAR', 'operand-pc': 'Operand → PC',
  'operand-a': 'Operand → A', 'operand-b': 'Operand → B', 'mdr-a': 'MDR → A', 'mdr-b': 'MDR → B',
  'a-mdr': 'A → MDR', 'b-mdr': 'B → MDR', 'a-alu': 'A → ALU', 'b-alu': 'B → ALU',
  'alu-z': 'ALU → Z', 'z-a': 'Z → A', 'z-b': 'Z → B', 'a-output': 'A → output',
}

function Diagram({ state, mode }: { state: CpuState; mode: Mode }) {
  const dataPaths: Record<string, string> = {
    'pc-mar': 'M680 118 H700 V270 H600',
    'pc-increment': 'M600 185 V178',
    'mar-ram': 'M430 270 H350 V350 H275',
    'ram-mdr': 'M275 430 H340 V400 H430',
    'mdr-ram': 'M430 400 H340 V470 H275',
    'mdr-ir': 'M600 400 H700 V190 H850',
    'mdr-operand': 'M600 400 H700 V313 H850',
    'operand-mar': 'M850 313 H700 V270 H600',
    'operand-pc': 'M850 313 H700 V118 H680',
    'operand-a': 'M850 313 H700 V428 H850',
    'operand-b': 'M850 313 H700 V543 H850',
    'mdr-a': 'M600 400 H700 V428 H850',
    'mdr-b': 'M600 400 H700 V543 H850',
    'a-mdr': 'M850 428 H700 V400 H600',
    'b-mdr': 'M850 543 H700 V400 H600',
    'a-alu': 'M850 428 H700 V620 H620',
    'b-alu': 'M850 543 H700 V665 H620',
    'alu-z': 'M620 690 H700 V792 H610',
    'z-a': 'M610 792 H700 V428 H850',
    'z-b': 'M610 792 H700 V543 H850',
    'a-output': 'M850 428 H700 V688 H850',
  }
  const active = (name: string) => state.activePaths.includes(name)
  const taps = [118, 190, 270, 313, 400, 428, 543, 620, 665, 688, 792]
  const box = (title: string, value: number | string, x: number, y: number, w: number, h = 76, subtitle = '') => (
    <g className="component" key={title}>
      <rect x={x} y={y} width={w} height={h} rx="9" />
      <text className="component-title" x={x + 13} y={y + 25}>{title}</text>
      <text className="component-value" x={x + 13} y={y + 55}>{typeof value === 'number' ? formatByte(value) : value}</text>
      {subtitle && <text className="component-subtitle" x={x + w - 12} y={y + 55} textAnchor="end">{subtitle}</text>}
    </g>
  )

  return <div className="diagram-scroll">
    <svg className="cpu-diagram" viewBox="0 0 1400 920" role="img" aria-label="Interactive single-bus 8-bit CPU with separate external RAM address, data, and control buses.">
      <defs>
        <marker id="cpu-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 z" fill="#78828e" /></marker>
        <marker id="cpu-arrow-active" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 z" fill="#a6e5dc" /></marker>
        <marker id="control-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 z" fill="#edb477" /></marker>
      </defs>

      <path className="internal-bus" d="M700 92 V838" />
      <path className={`external-bus address-bus${active('mar-ram') ? ' external-active' : ''}`} d="M430 270 H350 V350 H275" markerEnd="url(#cpu-arrow)" />
      <path className={`external-bus data-bus${active('ram-mdr') || active('mdr-ram') ? ' external-active' : ''}`} d="M275 430 H340 V400 H430" markerStart="url(#cpu-arrow)" markerEnd="url(#cpu-arrow)" />
      <path className={`external-bus control-bus${state.activeSignals.length ? ' control-active' : ''}`} d="M1210 180 V905 H20 V490 H45" markerEnd="url(#control-arrow)" />
      <path className={`decode-wire${state.activeSignals.includes('DECODE') ? ' signal-active' : ''}`} d="M1020 190 H1070 V145 H1090" markerEnd="url(#control-arrow)" />
      <path className={`flag-route${state.activePaths.includes('alu-flags') ? ' signal-active' : ''}`} d="M410 650 H380 V828 H760" markerEnd="url(#control-arrow)" />
      <text className="wire-label bus-name" x="700" y="80" textAnchor="middle">ONE 8-BIT INTERNAL BUS</text>
      <text className="wire-label external-label" x="302" y="322">ADDRESS BUS · 8 BIT</text>
      <text className="wire-label external-label" x="302" y="453">DATA BUS · 8 BIT · BIDIRECTIONAL</text>
      <text className="wire-label control-label" x="80" y="890">CONTROL BUS · RD / WR / WMFC</text>
      <text className="wire-label" x="712" y="240">BUS TAPS · ONE SOURCE PER EDGE</text>

      {Object.entries(dataPaths).map(([name, path]) => <path
        key={`${state.cycles}-${name}`}
        pathLength="1"
        className={`data-route${active(name) ? ' route-active' : ''}`}
        d={path}
        markerEnd={active(name) ? 'url(#cpu-arrow-active)' : 'url(#cpu-arrow)'}
      />)}
      {taps.map((y) => <circle className="bus-tap" key={y} cx="700" cy={y} r="5" />)}

      {box('PROGRAM COUNTER', state.pc, 520, 98, 160, 80, 'PC')}
      <g className="increment-box"><rect x="520" y="185" width="160" height="40" rx="7" /><text x="535" y="210">PC + 1 BYTE</text></g>
      {box('MEMORY ADDRESS', state.mar, 430, 232, 170, 76, 'MAR')}
      {box('MEMORY DATA', state.mdr, 430, 362, 170, 76, 'MDR')}

      <g className="memory-block">
        <rect x="45" y="284" width="230" height="230" rx="11" />
        <text className="component-title" x="65" y="317">MAIN MEMORY · RAM</text>
        <text className="memory-size" x="65" y="354">256 × 8</text>
        <text className="component-value" x="65" y="398">{formatByte(state.memory[state.mar] ?? 0)}</text>
        <text className="component-subtitle" x="65" y="425">RAM[{formatByte(state.mar)}]</text>
        <path className="memory-port" d="M275 350 H291 M275 430 H291 M29 490 H45" />
        <text className="port-label" x="65" y="467">A[7:0] · D[7:0] I/O</text>
        <text className="port-label" x="65" y="491">RD · WR · WMFC</text>
      </g>

      {box('INSTRUCTION REGISTER', state.ir, 850, 152, 170, 76, 'IR')}
      {box('OPERAND REGISTER', state.operand, 850, 275, 170, 76, 'OP')}
      {box('GENERAL REGISTER A', state.a, 850, 390, 170, 76, 'A')}
      {box('GENERAL REGISTER B', state.b, 850, 505, 170, 76, 'B')}

      <g className="component alu-box">
        <rect x="410" y="585" width="210" height="133" rx="10" />
        <text className="component-title" x="430" y="615">ALU · 8 BIT</text>
        <text className="alu-operation" x="430" y="653">{state.instructionName === 'SUB' ? 'A − B' : state.instructionName === 'ADD' ? 'A + B' : 'READY'}</text>
        <text className="component-subtitle" x="430" y="688">A {formatByte(state.aluA)} · B {formatByte(state.aluB)}</text>
      </g>
      {box('RESULT REGISTER', state.zRegister, 410, 755, 200, 76, 'Z')}
      {box('OUTPUT REGISTER', state.output, 850, 650, 170, 76, 'OUT')}

      <g className="flag-panel">
        <rect x="760" y="790" width="180" height="76" rx="9" />
        <text x="778" y="819">FLAGS</text><text x="778" y="846">Z {state.zero ? 1 : 0} · C {state.carry ? 1 : 0}</text>
      </g>
      {mode === 'automatic' && <g className="control-unit">
        <rect x="1090" y="70" width="250" height="110" rx="10" />
        <text x="1110" y="103">CONTROL UNIT</text>
        <text x="1110" y="133">DECODE · SEQUENCE</text>
        <text x="1110" y="160">{state.instructionName}</text>
      </g>}

      <text className="diagram-note" x="430" y="880">Teal = current byte transfer · Amber = control activity · Crossings without a tap are not connected.</text>
    </svg>
  </div>
}

function Field({ label, value, onChange, max = 255, helper }: { label: string; value: number; onChange: (value: number) => void; max?: number; helper?: string }) {
  return <label className="field"><span>{label}</span><input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))} /><small>{helper ?? `0–${max} decimal`}</small></label>
}

function SimulatorPage() {
  const [mode, setMode] = useState<Mode>('automatic')
  const [cpu, setCpu] = useState(initialCpuState)
  const [programText, setProgramText] = useState(demoProgramText)
  const [running, setRunning] = useState(false)
  const [runInterval, setRunInterval] = useState(850)
  const [memoryEdit, setMemoryEdit] = useState({ address: 0x20, value: 0 })
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running || mode !== 'automatic') return
    const timer = window.setInterval(() => setCpu((state) => stepClock(state, 'Automatic')), runInterval)
    return () => window.clearInterval(timer)
  }, [running, mode, runInterval])
  useEffect(() => { if (cpu.halted) setRunning(false) }, [cpu.halted])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0 }, [cpu.cycleLog.length])

  const programRows = useMemo(() => Array.from({ length: Math.ceil(Math.min(cpu.programLength, 256) / 2) }, (_, index) => {
    const address = index * 2
    const opcode = cpu.memory[address] ?? 0
    const operand = cpu.memory[address + 1] ?? 0
    const definition = getInstruction(opcode)
    return { address, opcode, operand, definition }
  }), [cpu.memory, cpu.programLength])
  const visibleMemory = cpu.memory.slice(0, 32)

  const stepOneClock = () => setCpu((state) => stepClock(state, mode === 'manual' ? 'Manual' : 'Automatic'))
  const stepOneInstruction = () => setCpu((state) => stepInstruction(state, 'Automatic'))
  const reset = () => { setRunning(false); setProgramText(demoProgramText); setCpu((state) => resetCpu(state)) }
  const loadSample = () => { setRunning(false); setProgramText(demoProgramText); setCpu((state) => installProgram(state, demoProgramText)) }
  const loadProgram = () => { setRunning(false); setCpu((state) => installProgram(state, programText)) }
  const editMemory = () => setCpu((state) => {
    const memory = [...state.memory]
    memory[memoryEdit.address] = memoryEdit.value & 0xff
    const summary = `RAM[${formatByte(memoryEdit.address)}] set to ${formatByte(memoryEdit.value)} using the memory editor.`
    return { ...state, memory, lastEvent: summary, cycleLog: [...state.cycleLog, {
      id: state.cycleLog.length + 1, cycle: state.cycles, mode: 'Input' as const,
      microstep: 'Memory editor', summary, paths: [], signals: [],
    }].slice(-200) }
  })
  const clearHistory = () => setCpu((state) => ({ ...state, cycleLog: [] }))

  return <div className="site-frame simulator-frame">
    <SiteHeader page="simulator" />
    <main className="simulator-page">
      <section className="sim-intro" id="guide">
        <p className="eyebrow">8-BIT PROCESSOR LAB</p>
        <h1>One bus. One clock edge at a time.</h1>
        <p className="sim-intro-copy">Follow the address, instruction, and data bytes through a small 8-bit processor. Load the built-in program to compute 11 + 4, send 15 to the output register, and halt.</p>
        <div className="guide-grid">
          <article className="guide-card"><span>01 / LOAD</span><h3>Two bytes per instruction</h3><p>The first byte selects the operation; the next byte carries its 8-bit value or address. Each byte fetch advances PC by one.</p></article>
          <article className="guide-card"><span>02 / FOLLOW</span><h3>Read the active route</h3><p>The highlighted route is the current clock edge. The signal list names the controls asserted for that same micro-step.</p></article>
          <article className="guide-card"><span>03 / STEP</span><h3>Watch state change</h3><p>Use Step Clock to advance one micro-step. With the control unit, Step Instruction completes the current instruction and Run advances clock edges automatically.</p></article>
        </div>
        <div className="sample-banner"><div><span>BUILT-IN PROGRAM · 11 + 4 = 15</span><code>10 0B · 11 04 · 30 00 · 50 00 · FF 00</code><p>Load A with 11, load B with 4, add, output the result, then halt.</p></div><button className="primary-button" onClick={loadSample}>Restore sample</button></div>
      </section>

      <section className="instruction-reference" id="instruction-set">
        <div className="page-section-heading"><div><p className="eyebrow">INSTRUCTION REFERENCE</p><h2>Two-byte instruction format</h2></div><p>Byte 1 is the opcode. Byte 2 is an 8-bit immediate or address; use 00 when the operation has no operand. PC and MAR are 8-bit, and RAM has 256 byte addresses.</p></div>
        <div className="instruction-grid">{instructionSet.map(({ opcode, mnemonic, description, operand }) => <article className="instruction-card" key={opcode}><code>{opcode.toString(16).toUpperCase().padStart(2, '0')}</code><strong>{mnemonic}</strong><span>{description}</span><small>Operand: {operand}</small></article>)}</div>
      </section>

      <section className="circuit-section" id="circuit">
        <div className="page-section-heading circuit-heading"><div><p className="eyebrow">LIVE DATAPATH</p><h2>8-bit single-bus CPU</h2></div><div className="mode-switch" role="group" aria-label="Clock mode"><button className={mode === 'manual' ? 'selected' : ''} onClick={() => { setMode('manual'); setRunning(false) }}>Manual clock</button><button className={mode === 'automatic' ? 'selected' : ''} onClick={() => setMode('automatic')}>With control unit</button></div></div>
        <div className="cpu-workspace">
          <section className="panel diagram-panel full-width-diagram">
            <div className="panel-heading"><div><h3>Processor architecture</h3><p>PC · MAR · MDR · IR · A / B · ALU · Z · OUT · RAM</p></div><div className="compact-readout"><span>CPU STATUS</span><strong className={cpu.halted ? 'status-halted' : running ? 'status-running' : ''}>{cpu.halted ? 'HALTED' : running ? 'RUNNING' : 'READY'}</strong><div><span>PC</span><b>{formatByte(cpu.pc)}</b><span>CLOCK</span><b>{cpu.cycles.toString().padStart(3, '0')}</b></div></div></div>
            <Diagram state={cpu} mode={mode} />
            <div className="event-log"><span className="event-label">CURRENT EDGE</span><p>{cpu.lastEvent}</p></div>
          </section>

          <div className="sim-tools-grid">
            <section className="panel control-panel" aria-labelledby="clock-heading">
              <div className="panel-heading"><div><p className="eyebrow">{mode === 'automatic' ? 'CONTROL UNIT' : 'OPERATOR CONTROL'}</p><h3 id="clock-heading">Clock and signals</h3></div><span className={`mode-chip${mode === 'manual' ? ' muted' : ''}`}>{mode === 'manual' ? 'MANUAL' : 'AUTOMATIC'}</span></div>
              <p className="panel-intro">{mode === 'manual' ? 'You choose each rising clock edge. The signal list describes the micro-step the model will apply on that edge.' : 'The control unit selects the micro-step from the decoded instruction. Step one edge, complete one instruction, or run continuously.'}</p>
              <div className="decode-card"><span>CURRENT MICRO-STEP</span><strong>{cpu.halted ? 'HALTED' : microstepLabel(cpu.microstep)}</strong><p>{cpu.instructionName === '—' ? 'Instruction not decoded yet' : `${cpu.instructionName} · IR ${formatByte(cpu.ir)} · operand ${formatByte(cpu.operand)}`}</p></div>
              <div className="active-signal-list"><small>CONTROL SIGNALS THIS EDGE</small>{cpu.activeSignals.length ? cpu.activeSignals.map((signal) => <code key={signal}>{signal}</code>) : <span className="quiet-note">No control signals asserted yet.</span>}</div>
              <div className="action-row">
                <button className="primary-button" onClick={stepOneClock} disabled={cpu.halted || running}>Step Clock</button>
                {mode === 'automatic' && <button className="secondary-button" onClick={stepOneInstruction} disabled={cpu.halted || running}>Step Instruction</button>}
                {mode === 'automatic' && <button className="secondary-button" onClick={() => setRunning((value) => !value)} disabled={cpu.halted}>{running ? 'Pause' : 'Run'}</button>}
                <button className="icon-button" onClick={reset}>Reset</button>
              </div>
              {mode === 'automatic' && <label className="speed-control">Clock interval <select value={runInterval} onChange={(event) => setRunInterval(Number(event.target.value))}><option value="1300">Slow · 1.3 s</option><option value="850">Normal · 0.85 s</option><option value="450">Fast · 0.45 s</option></select></label>}
            </section>

            <section className="panel cycle-panel" aria-labelledby="cycle-heading">
              <div className="panel-heading"><div><p className="eyebrow">EXECUTION TRACE</p><h3 id="cycle-heading">Clock history</h3></div><button className="text-button" onClick={clearHistory} disabled={!cpu.cycleLog.length}>Clear</button></div>
              <p className="panel-intro">Every clock edge records the micro-step, active path, and control signals.</p>
              <div className="cycle-log" ref={logRef} aria-live="polite">{cpu.cycleLog.length === 0 ? <div className="empty-log"><span>NO CLOCK EDGES YET</span><p>Start with Step Clock or Step Instruction. The built-in program is loaded at address 00.</p><small>Fetch · decode · execute · writeback</small></div> : [...cpu.cycleLog].reverse().map((entry) => <article className="cycle-entry" key={entry.id}><div className="cycle-meta"><b>#{entry.id.toString().padStart(3, '0')}</b><span>{entry.mode === 'Input' ? 'INPUT' : entry.mode.toUpperCase()}</span><small>CLOCK {entry.cycle.toString().padStart(3, '0')}</small></div><p>{entry.summary}</p><div className="cycle-paths">{entry.paths.length ? entry.paths.map((path) => <span key={path}>{pathLabels[path] ?? path}</span>) : <span>No data transfer</span>}</div><div className="cycle-signals">{entry.signals.map((signal) => <code key={signal}>{signal}</code>)}</div></article>)}</div>
            </section>
          </div>
        </div>
      </section>

      <section className="lower-grid" id="memory">
        <section className="panel program-panel"><div className="panel-heading"><div><p className="eyebrow">PROGRAM LOADER</p><h3>Program bytes</h3></div><button className="text-button" onClick={loadSample}>Restore sample</button></div><p className="panel-intro">Enter an even number of hexadecimal bytes, in address order. Every instruction uses an opcode byte and an operand byte.</p><label className="program-input"><span>HEX BYTES · MAXIMUM 256</span><textarea value={programText} onChange={(event) => setProgramText(event.target.value)} spellCheck={false} /></label><div className="program-actions"><button className="primary-button" onClick={loadProgram}>Load program</button><span>{cpu.lastEvent}</span></div>
          <div className="program-listing"><h4>Loaded instruction listing</h4>{programRows.length ? programRows.map(({ address, opcode, operand, definition }) => <div className="listing-row" key={address}><code>{formatByte(address)}</code><code>{formatByte(opcode)} {formatByte(operand)}</code><b>{definition.mnemonic}</b><span>{definition.operand === 'none' ? '—' : formatByte(operand)}</span></div>) : <p>No program bytes are loaded.</p>}</div>
        </section>

        <section className="panel memory-panel"><div className="panel-heading"><div><p className="eyebrow">256 × 8 STORAGE</p><h3>RAM inspector</h3></div><span className="memory-count">{formatByte(cpu.mar)} selected</span></div><div className="memory-table" role="table" aria-label="RAM addresses 00 through 1F"><div className="memory-row table-header" role="row"><span>ADDRESS</span><span>BYTE</span><span>CONTENTS</span></div>{visibleMemory.map((value, address) => <div className={`memory-row ${cpu.mar === address ? 'current-address' : ''} ${address < cpu.programLength ? 'program-address' : ''}`} role="row" key={address}><span>{formatByte(address)}</span><b>{formatByte(value)}</b><span>{address < cpu.programLength ? 'Program' : 'Data / free'}</span></div>)}</div><div className="memory-edit"><Field label="Address" value={memoryEdit.address} onChange={(value) => setMemoryEdit((old) => ({ ...old, address: value }))} helper="0–255 decimal" /><Field label="Byte value" value={memoryEdit.value} onChange={(value) => setMemoryEdit((old) => ({ ...old, value }))} /><button className="secondary-button" onClick={editMemory}>Write RAM</button><p className="selected-memory">RAM[{formatByte(memoryEdit.address)}] contains <b>{formatByte(cpu.memory[memoryEdit.address] ?? 0)}</b></p></div></section>
      </section>

      <section className="panel register-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE PROCESSOR STATE</p><h3>Registers, output, and flags</h3></div><span className="register-caption">8-bit values shown in hexadecimal</span></div><div className="register-grid">{[
        ['PC', cpu.pc, 'Next byte address'], ['MAR', cpu.mar, 'RAM address'], ['MDR', cpu.mdr, 'Memory data'], ['IR', cpu.ir, 'Opcode'], ['OP', cpu.operand, 'Operand byte'],
        ['A', cpu.a, 'General register'], ['B', cpu.b, 'General register'], ['ALU A', cpu.aluA, 'ALU input'], ['ALU B', cpu.aluB, 'ALU input'], ['Z', cpu.zRegister, 'Result register'], ['OUT', cpu.output, 'Output latch'],
      ].map(([name, value, description]) => <div className="register-card" key={name as string}><span>{name}</span><strong>{formatByte(value as number)}</strong><small>{description}</small></div>)}<div className="register-card flag-card"><span>FLAGS</span><strong>Z {cpu.zero ? 1 : 0} · C {cpu.carry ? 1 : 0}</strong><small>Zero · carry / no borrow</small></div></div></section>
    </main>
    <footer className="site-footer"><span>8 BIT MINI CPU</span><span>Clocked 8-bit datapath · React + TypeScript</span><a href="./documentation.md" target="_blank" rel="noreferrer">Technical documentation</a></footer>
  </div>
}

export default SimulatorPage
