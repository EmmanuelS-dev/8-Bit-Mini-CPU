import { useEffect, useMemo, useState } from 'react'
import {
  demoProgram, hexByte, initialCpuState, installProgram,
  instructionSet, resetCpu, runInstruction, type CpuState,
} from './cpu'
import SiteHeader from './SiteHeader'

type Mode = 'manual' | 'automatic'
type OperandSource = 'ram' | 'a' | 'b'
type Operation = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR'
type ResultTarget = 'a' | 'b' | 'ram'
type GuidedConfig = { operation: Operation; sourceA: OperandSource; sourceB: OperandSource; valueA: number; valueB: number; target: ResultTarget }
type GuidedStage = { title: string; summary: string; paths: string[]; signals: string[]; apply: (state: CpuState) => CpuState }
const demoSource = demoProgram.map(hexByte).join(' ')
const pathLabels: Record<string, string> = {
  'pc-mar': 'PC → MAR', 'mar-ram': 'MAR → RAM', 'ram-mdr': 'RAM → MDR', 'mdr-ir': 'MDR → IR',
  'mdr-a': 'MDR → A', 'mdr-b': 'MDR → B', 'operand-a': 'Operand → A', 'operand-b': 'Operand → B',
  'a-alu': 'A → ALU', 'b-alu': 'B → ALU', 'alu-a': 'ALU → A', 'alu-flags': 'ALU → flags',
  'a-ram': 'A → RAM', 'mdr-ram': 'MDR → RAM', 'input-a': 'Input → A', 'input-b': 'Input → B',
  'input-mar': 'Address input → MAR', 'input-mdr': 'Input → MDR', 'operand-mar': 'Operand → MAR',
  'operand-pc': 'Operand → PC', 'pc-increment': 'PC increment',
  'alu-b': 'ALU → B', 'alu-ram': 'ALU → RAM',
}

function makeGuidedStages(config: GuidedConfig): GuidedStage[] {
  const stages: GuidedStage[] = []
  const add = (stage: GuidedStage) => stages.push(stage)
  add({ title: 'Fetch address', summary: 'PC places the instruction address in MAR. Memory read begins while PC advances.', paths: ['pc-mar', 'pc-increment'], signals: ['PC_OUT', 'MAR_IN', 'MEM_READ', 'PC_INCREMENT'], apply: (state) => ({ ...state, mar: state.pc, pc: (state.pc + 1) & 0xff }) })
  add({ title: 'Wait for memory', summary: 'WMFC: memory returns the instruction byte at MAR into MDR.', paths: ['mar-ram', 'ram-mdr'], signals: ['WMFC', 'MDR_IN'], apply: (state) => ({ ...state, mdr: state.memory[state.mar] ?? 0 }) })
  add({ title: 'Load instruction register', summary: 'MDR transfers the fetched instruction into IR.', paths: ['mdr-ir'], signals: ['IR_IN'], apply: (state) => ({ ...state, ir: state.mdr }) })
  add({ title: 'Decode instruction', summary: `The instruction decoder identifies ${config.operation} and selects the operand and destination paths.`, paths: [], signals: ['IR_OUT', 'DECODE', `ALU_${config.operation}`], apply: (state) => ({ ...state, instructionName: config.operation }) })

  const operand = (side: 'A' | 'B', source: OperandSource, slot: number) => {
    const targetPath = side === 'A' ? 'mdr-a' : 'mdr-b'
    if (source === 'ram') {
      add({ title: `Address operand ${side}`, summary: `MAR selects the prepared RAM operand slot ${format(slot)}.`, paths: ['operand-mar'], signals: ['MAR_IN'], apply: (state) => ({ ...state, mar: slot }) })
      add({ title: `Read operand ${side}`, summary: `MAR_OUT and MEM_READ request the operand from RAM[${format(slot)}].`, paths: ['operand-mar', 'mar-ram'], signals: ['MAR_OUT', 'MEM_READ'], apply: (state) => state })
      add({ title: `Wait for operand ${side}`, summary: `WMFC: RAM[${format(slot)}] returns through MDR.`, paths: ['mar-ram', 'ram-mdr'], signals: ['WMFC', 'MDR_IN'], apply: (state) => ({ ...state, mdr: state.memory[slot] ?? 0 }) })
      add({ title: `Load operand ${side}`, summary: `MDR latches the fetched byte into register ${side}.`, paths: [targetPath], signals: [side === 'A' ? 'A_IN' : 'B_IN'], apply: (state) => ({ ...state, [side.toLowerCase()]: state.mdr }) as CpuState })
    } else {
      const path = source === 'a' ? 'a-alu' : 'b-alu'
      add({ title: `Select register ${source.toUpperCase()} for operand ${side}`, summary: `Register ${source.toUpperCase()} is selected as ALU operand ${side}.`, paths: [path], signals: [`${source.toUpperCase()}_OUT`, `${side}_SELECT`], apply: (state) => state })
    }
  }
  operand('A', config.sourceA, 0x10)
  operand('B', config.sourceB, 0x11)
  const resolve = (state: CpuState, source: OperandSource, side: 'A' | 'B') => source === 'ram' ? (side === 'A' ? state.a : state.b) : source === 'a' ? config.valueA : config.valueB
  add({ title: 'Execute in ALU', summary: `The ALU performs ${config.operation} on the selected A and B operands.`, paths: ['a-alu', 'b-alu', 'alu-flags'], signals: ['ALU_ENABLE', `ALU_${config.operation}`, 'FLAGS_IN'], apply: (state) => {
    const a = resolve(state, config.sourceA, 'A') & 0xff
    const b = resolve(state, config.sourceB, 'B') & 0xff
    const raw = config.operation === 'ADD' ? a + b : config.operation === 'SUB' ? a - b : config.operation === 'AND' ? a & b : config.operation === 'OR' ? a | b : a ^ b
    const result = raw & 0xff
    return { ...state, aluResult: result, zero: result === 0, carry: config.operation === 'ADD' ? raw > 0xff : config.operation === 'SUB' ? a >= b : false }
  } })
  if (config.target === 'ram') {
    add({ title: 'Select result address', summary: 'MAR selects the prepared result slot RAM[12h].', paths: ['operand-mar'], signals: ['MAR_IN'], apply: (state) => ({ ...state, mar: 0x12 }) })
    add({ title: 'Write result to RAM', summary: 'The ALU result is written to RAM[12h].', paths: ['alu-ram'], signals: ['ALU_OUT', 'MAR_OUT', 'MEM_WRITE'], apply: (state) => { const memory = [...state.memory]; memory[0x12] = state.aluResult; return { ...state, memory } } })
  } else {
    add({ title: `Write result to register ${config.target.toUpperCase()}`, summary: `The ALU result is latched in register ${config.target.toUpperCase()}.`, paths: [config.target === 'a' ? 'alu-a' : 'alu-b'], signals: [`${config.target.toUpperCase()}_IN`], apply: (state) => ({ ...state, [config.target]: state.aluResult }) as CpuState })
  }
  return stages
}

function format(value: number, bits = 8) {
  return `${value.toString(16).toUpperCase().padStart(bits / 4, '0')}h`
}

function Diagram({ state, mode }: { state: CpuState; mode: Mode }) {
  const lit = (name: string) => state.activePaths.includes(name) ? 'wire lit' : 'wire'
  const control = (active: boolean) => active ? 'control-wire control-lit' : 'control-wire'
  const box = (title: string, value: number | string, x: number, y: number, w: number, h = 76, subtitle = '') => (
    <g className="component" key={title}>
      <rect x={x} y={y} width={w} height={h} rx="9" />
      <text className="component-title" x={x + 14} y={y + 27}>{title}</text>
      <text className="component-value" x={x + 14} y={y + 57}>{typeof value === 'number' ? format(value) : value}</text>
      {subtitle && <text className="component-subtitle" x={x + w - 12} y={y + 57} textAnchor="end">{subtitle}</text>}
    </g>
  )
  const active = state.activePaths
  return (
    <div className="diagram-scroll">
      <svg className="cpu-diagram" viewBox="0 0 960 640" role="img" aria-label="Interactive 8-bit CPU datapath with address, data and control wires.">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#81919c" /></marker>
          <marker id="arrow-lit" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#65d4c0" /></marker>
          <marker id="control-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#d0a477" /></marker>
        </defs>
        <g transform="scale(.75 1)">
        <path className={lit('pc-mar')} d="M215 121 H315" markerEnd="url(#arrow-lit)" />
        <path className={lit('mar-ram')} d="M480 121 H590" markerEnd="url(#arrow-lit)" />
        <path className={lit('ram-mdr')} d="M790 121 H900" markerEnd="url(#arrow-lit)" />
        <path className={lit('mdr-ir')} d="M982 162 V230" markerEnd="url(#arrow-lit)" />
        <path className={lit('mdr-a')} d="M982 162 V342 H360 V365" markerEnd="url(#arrow-lit)" />
        <path className={lit('mdr-b')} d="M900 141 H870 V535 H450" markerEnd="url(#arrow-lit)" />
        <path className={lit('operand-a')} d="M982 312 V350 H360 V365" markerEnd="url(#arrow-lit)" />
        <path className={lit('operand-b')} d="M1065 270 H1200 V580 H450" markerEnd="url(#arrow-lit)" />
        <path className={lit('a-alu')} d="M450 407 H535 V438 H640" markerEnd="url(#arrow-lit)" />
        <path className={lit('b-alu')} d="M450 565 H570 V478 H640" markerEnd="url(#arrow-lit)" />
        <path className={lit('alu-a')} d="M640 405 H500 V430 H450" markerEnd="url(#arrow-lit)" />
        <path className={lit('alu-b')} d="M640 492 H500 V560 H450" markerEnd="url(#arrow-lit)" />
        <path className={lit('alu-ram')} d="M830 455 H855 V186 H700 V173" markerEnd="url(#arrow-lit)" />
        <path className={lit('alu-flags')} d="M830 405 H990 V432 H1015" markerEnd="url(#arrow-lit)" />
        <path className={lit('a-ram')} d="M450 426 H515 V205 H690 V173" markerEnd="url(#arrow-lit)" />
        <path className={lit('mdr-ram')} d="M900 141 H815 V190 H755 V173" markerEnd="url(#arrow-lit)" />
        <path className={lit('operand-mar')} d="M900 250 H880 V190 H400 V162" markerEnd="url(#arrow-lit)" />
        <path className={lit('pc-increment')} d="M132 162 V192 H55 V121 H50" markerEnd="url(#arrow-lit)" />
        <path className={lit('operand-pc')} d="M900 292 H875 V45 H132 V80" markerEnd="url(#arrow-lit)" />
        {mode === 'automatic' && <>
          <path className={`decode-wire ${active.includes('mdr-ir') ? 'control-lit' : ''}`} d="M1065 271 H1090" markerEnd="url(#control-arrow)" />
          <path className={control(active.length > 0)} d="M1090 330 V370 H845" markerEnd="url(#control-arrow)" />
        </>}
        <text className="wire-label" x="244" y="105">ADDRESS · 8 BIT</text>
        <text className="wire-label" x="510" y="105">ADDRESS · 8 BIT</text>
        <text className="wire-label" x="812" y="105">DATA · 8 BIT</text>
        <text className="wire-label" x="690" y="333">REGISTER BUS</text>
        {mode === 'automatic' && <text className="wire-label" x="1080" y="215">DECODE CONTROL</text>}
        {box('PROGRAM COUNTER', state.pc, 50, 80, 165, 82, 'PC')}
        {box('MEMORY ADDRESS', state.mar, 315, 80, 165, 82, 'MAR')}
        {box('RAM 256 × 8', state.memory[state.mar] ?? 0, 590, 68, 200, 105, `@ ${format(state.mar)}`)}
        {box('MEMORY DATA', state.mdr, 900, 80, 165, 82, 'MDR')}
        {box('INSTRUCTION', state.ir, 900, 230, 165, 82, 'IR')}
        {box('ACCUMULATOR A', state.a, 270, 365, 180, 85, 'A')}
        {box('REGISTER B', state.b, 270, 520, 180, 85, 'B')}
        {mode === 'automatic' && <g className="control-unit"><rect x="1090" y="235" width="150" height="95" rx="9" /><text x="1105" y="267">CONTROL UNIT</text><text x="1105" y="295">DECODE · SEQUENCE</text><text x="1105" y="317">{state.instructionName}</text></g>}
        <g className="component alu-box">
          <rect x="640" y="390" width="190" height="125" rx="9" />
          <text className="component-title" x="660" y="422">ALU · 8 BIT</text>
          <text className="alu-operation" x="660" y="460">{state.instructionName === 'SUB' ? 'A − B' : ['AND', 'OR', 'XOR', 'NOT'].includes(state.instructionName) ? state.instructionName : 'A + B'}</text>
          <text className="component-subtitle" x="660" y="490">RESULT {format(state.aluResult)}</text>
        </g>
        <g className="flag-panel"><rect x="1015" y="410" width="145" height="105" rx="9" /><text x="1032" y="442">FLAGS</text><text x="1032" y="472">Z {state.zero ? '1' : '0'}</text><text x="1090" y="472">C {state.carry ? '1' : '0'}</text></g>
        <text className="diagram-note" x="50" y="625">Solid teal = data / address transfer · Dashed amber = control signal · Highlight shows this cycle.</text>
        </g>
      </svg>
    </div>
  )
}

function Field({ label, value, onChange, max = 255, helper, disabled = false }: { label: string; value: number; onChange: (value: number) => void; max?: number; helper?: string; disabled?: boolean }) {
  return <label className="field"><span>{label}</span><input type="number" min={0} max={max} value={value} disabled={disabled} onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))} /><small>{helper ?? `0–${max} decimal`}</small></label>
}

function SimulatorPage() {
  const [mode, setMode] = useState<Mode>('automatic')
  const [cpu, setCpu] = useState(initialCpuState)
  const [programText, setProgramText] = useState(demoSource)
  const [running, setRunning] = useState(false)
  const [runInterval, setRunInterval] = useState(850)
  const [memoryEdit, setMemoryEdit] = useState({ address: 0x10, value: 0x05 })
  const [guidedConfig, setGuidedConfig] = useState<GuidedConfig>({ operation: 'ADD', sourceA: 'ram', sourceB: 'ram', valueA: 5, valueB: 3, target: 'a' })
  const [guidedIndex, setGuidedIndex] = useState(0)
  const [guidedPrepared, setGuidedPrepared] = useState(false)

  useEffect(() => {
    if (!running || mode !== 'automatic') return
    const timer = window.setInterval(() => setCpu((state) => runInstruction(state)), runInterval)
    return () => window.clearInterval(timer)
  }, [running, mode, runInterval])
  useEffect(() => { if (cpu.halted) setRunning(false) }, [cpu.halted])

  const decoded = useMemo(() => instructionSet[cpu.ir >> 4], [cpu.ir])
  const guidedStages = useMemo(() => makeGuidedStages(guidedConfig), [guidedConfig])
  const step = () => setCpu((state) => runInstruction(state))
  const prepareGuidedInstruction = () => {
    setCpu((state) => {
      const next = initialCpuState()
      next.memory[0] = ({ ADD: 0x30, SUB: 0x40, AND: 0xa0, OR: 0xb0, XOR: 0xc0 } as const)[guidedConfig.operation]
      next.memory[0x10] = guidedConfig.valueA & 0xff
      next.memory[0x11] = guidedConfig.valueB & 0xff
      next.a = guidedConfig.valueA & 0xff
      next.b = guidedConfig.valueB & 0xff
      next.cycles = state.cycles
      next.cycleLog = [...state.cycleLog, {
        id: state.cycleLog.length + 1, cycle: state.cycles, mode: 'Input' as const,
        summary: `Prepared ${guidedConfig.operation}: A from ${guidedConfig.sourceA === 'ram' ? 'RAM[10h]' : 'register A'}, B from ${guidedConfig.sourceB === 'ram' ? 'RAM[11h]' : 'register B'}, result to ${guidedConfig.target === 'ram' ? 'RAM[12h]' : `register ${guidedConfig.target.toUpperCase()}`}.`, paths: [],
      }].slice(-100)
      next.instructionName = guidedConfig.operation
      next.lastEvent = `${guidedConfig.operation} instruction prepared. Advance one clock edge to begin fetch.`
      return next
    })
    setGuidedIndex(0)
    setGuidedPrepared(true)
  }
  const pulseGuided = () => {
    const stage = guidedStages[guidedIndex]
    if (!stage) return
    setCpu((state) => {
      const updated = stage.apply({ ...state, memory: [...state.memory] })
      const cycle = state.cycles + 1
      const summary = `Clock ${cycle}: ${stage.title}. ${stage.summary}`
      return { ...updated, cycles: cycle, activePaths: stage.paths, activeSignals: stage.signals, lastEvent: summary,
        cycleLog: [...state.cycleLog, { id: state.cycleLog.length + 1, cycle, mode: 'Manual' as const, summary, paths: [...stage.paths], signals: [...stage.signals] }].slice(-100) }
    })
    setGuidedIndex((index) => index + 1)
  }
  const loadDemo = () => {
    setProgramText(demoSource)
    setCpu((state) => installProgram(state, demoSource))
    setRunning(false)
  }
  const loadProgram = () => {
    setCpu((state) => installProgram(state, programText))
    setRunning(false)
  }
  const editMemory = () => setCpu((state) => {
    const memory = [...state.memory]
    memory[memoryEdit.address] = memoryEdit.value & 0xff
    const summary = `RAM[${format(memoryEdit.address)}] ← ${format(memoryEdit.value)} through the memory editor.`
    return { ...state, memory, lastEvent: summary, cycleLog: [...state.cycleLog, { id: state.cycleLog.length + 1, cycle: state.cycles, mode: 'Input' as const, summary, paths: [] }].slice(-100) }
  })
  const visibleMemory = cpu.memory.slice(0, 0x13)
  const clearLog = () => setCpu((state) => ({ ...state, cycleLog: [] }))

  return (
    <div className="site-frame simulator-frame">
      <SiteHeader page="simulator" />
      <main className="simulator-page">
        <section className="sim-intro" id="guide">
          <p className="eyebrow">SIMULATION GUIDE</p>
          <h1>Understand the flow before you run it.</h1>
          <p className="sim-intro-copy">The CPU moves an address to memory, fetches an instruction, decodes it, and routes data through registers and the ALU. Start with the sample program or advance the manual clock one stage at a time.</p>
          <div className="guide-grid">
            <article className="guide-card"><span>01 / CHOOSE A MODE</span><h3>Automatic control</h3><p>Use <b>Step instruction</b> or <b>Run</b>. The control unit fetches, decodes, and executes one instruction at a time.</p></article>
            <article className="guide-card"><span>02 / FOLLOW THE SIGNALS</span><h3>Read the diagram</h3><p>Teal wires show data and address movement. Amber dashed wires show automatic control signals. Register values update after each step.</p></article>
            <article className="guide-card"><span>03 / TRY MANUAL CONTROL</span><h3>Advance the clock</h3><p>Switch to <b>Without control unit</b>, choose an operation and its sources, then advance one guided datapath stage at a time.</p></article>
          </div>
          <div className="sample-banner"><div><span>READY-TO-RUN SAMPLE</span><code>61 72 31 53 F0</code><p>Loads 1 into A, 2 into B, adds them, stores 3 at address 03, then halts.</p></div><a className="primary-button" href="#circuit">Go to the circuit <span>↓</span></a></div>
        </section>

        <section className="instruction-reference" id="instruction-set">
          <div className="page-section-heading"><div><p className="eyebrow">INSTRUCTION REFERENCE</p><h2>One byte, two fields</h2></div><p>Each instruction uses a 4-bit opcode followed by a 4-bit operand. This teaching set extends the datapath in the circuit reference.</p></div>
          <div className="instruction-grid">{instructionSet.map(({ opcode, mnemonic, description }) => <article className="instruction-card" key={opcode}><code>{opcode.toString(16).toUpperCase()}</code><strong>{mnemonic}</strong><span>{description}</span></article>)}</div>
        </section>

        <section className="circuit-section" id="circuit">
          <div className="page-section-heading circuit-heading"><div><p className="eyebrow">LIVE SIMULATOR</p><h2>8-bit CPU circuit</h2></div><div className="mode-switch" role="group" aria-label="Simulation mode"><button className={mode === 'manual' ? 'selected' : ''} onClick={() => { setMode('manual'); setRunning(false) }}>Without control unit</button><button className={mode === 'automatic' ? 'selected' : ''} onClick={() => setMode('automatic')}>With control unit</button></div></div>
          <div className="cpu-workspace">
          <section className="panel diagram-panel full-width-diagram">
            <div className="panel-heading"><div><h3>Datapath and control signals</h3><p>PC · MAR · RAM · MDR · IR · A / B · ALU</p></div><div className="hero-readout compact-readout"><span>PROCESSOR STATE</span><strong>{cpu.halted ? 'HALTED' : running ? 'RUNNING' : 'READY'}</strong><div><span>PC</span><b>{format(cpu.pc)}</b><span>CYCLES</span><b>{cpu.cycles.toString().padStart(3, '0')}</b></div></div></div>
            <Diagram state={cpu} mode={mode} />
          </section>

          <div className="sim-tools-grid">
            <section className="panel control-panel">
              {mode === 'automatic' ? <>
                <div className="panel-heading"><div><p className="eyebrow">SEQUENCER</p><h3>Control unit</h3></div><span className="mode-chip">AUTOMATIC</span></div>
                <p className="panel-intro">The decoder reads IR and enables the data paths needed by the current instruction.</p>
                <div className="decode-card"><span>DECODED INSTRUCTION</span><strong>{decoded.mnemonic} <small>{format(cpu.ir & 0x0f, 4)}</small></strong><p>{decoded.description}</p></div>
                <div className="action-row"><button className="primary-button" onClick={step} disabled={cpu.halted}>Step instruction <span>→</span></button><button className="secondary-button" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Run'}</button><button className="icon-button" onClick={() => { setRunning(false); setCpu((state) => resetCpu(state)) }}>Reset</button></div>
                <label className="speed-control">Run interval <select value={runInterval} onChange={(event) => setRunInterval(Number(event.target.value))}><option value="1300">Slow · 1.3 s</option><option value="850">Normal · 0.85 s</option><option value="450">Fast · 0.45 s</option></select></label>
              </> : <>
                <div className="panel-heading"><div><p className="eyebrow">SIGNAL PANEL</p><h3>Manual control</h3></div><span className="mode-chip muted">NO CONTROL UNIT</span></div>
                <p className="panel-intro">Choose the operation, operand sources, values, and destination once. Each clock edge advances one visible datapath stage.</p>
                <div className="guided-config">
                  <label className="field"><span>Operation</span><select value={guidedConfig.operation} disabled={guidedPrepared} onChange={(event) => setGuidedConfig((old) => ({ ...old, operation: event.target.value as Operation }))}>{(['ADD', 'SUB', 'AND', 'OR', 'XOR'] as Operation[]).map((operation) => <option key={operation}>{operation}</option>)}</select></label>
                  <div className="operand-config"><label className="field"><span>Operand A source</span><select value={guidedConfig.sourceA} disabled={guidedPrepared} onChange={(event) => setGuidedConfig((old) => ({ ...old, sourceA: event.target.value as OperandSource }))}><option value="ram">Main memory · slot 10h</option><option value="a">General register A</option></select></label><Field label="Operand A value" value={guidedConfig.valueA} disabled={guidedPrepared} onChange={(valueA) => setGuidedConfig((old) => ({ ...old, valueA }))} helper={guidedConfig.sourceA === 'ram' ? 'Preloaded at RAM[10h]' : 'Initial register A value'} /></div>
                  <div className="operand-config"><label className="field"><span>Operand B source</span><select value={guidedConfig.sourceB} disabled={guidedPrepared} onChange={(event) => setGuidedConfig((old) => ({ ...old, sourceB: event.target.value as OperandSource }))}><option value="ram">Main memory · slot 11h</option><option value="b">General register B</option></select></label><Field label="Operand B value" value={guidedConfig.valueB} disabled={guidedPrepared} onChange={(valueB) => setGuidedConfig((old) => ({ ...old, valueB }))} helper={guidedConfig.sourceB === 'ram' ? 'Preloaded at RAM[11h]' : 'Initial register B value'} /></div>
                  <label className="field"><span>Result destination</span><select value={guidedConfig.target} disabled={guidedPrepared} onChange={(event) => setGuidedConfig((old) => ({ ...old, target: event.target.value as ResultTarget }))}><option value="a">Register A</option><option value="b">Register B</option><option value="ram">Main memory · slot 12h</option></select></label>
                </div>
                <div className="stage-card"><span>CLOCK SEQUENCE · {guidedPrepared ? `${Math.min(guidedIndex + 1, guidedStages.length)} / ${guidedStages.length}` : 'NOT STARTED'}</span><strong>{guidedPrepared ? guidedStages[guidedIndex]?.title ?? 'Instruction complete' : 'Configure and prepare an instruction'}</strong><p>{guidedPrepared ? guidedStages[guidedIndex]?.summary ?? 'The result is ready. Prepare another instruction to run a new sequence.' : 'The sample setup uses ADD with values 05h and 03h from RAM slots 10h and 11h.'}</p>{cpu.activeSignals.length > 0 && <div className="active-signal-list"><small>LAST CONTROL SIGNALS</small>{cpu.activeSignals.map((signal) => <code key={signal}>{signal}</code>)}</div>}</div>
                <div className="action-row"><button className="secondary-button" onClick={prepareGuidedInstruction}>{guidedPrepared ? 'Restart sequence' : 'Prepare instruction'}</button><button className="primary-button" onClick={pulseGuided} disabled={!guidedPrepared || guidedIndex >= guidedStages.length}>Advance clock edge <span>→</span></button><button className="icon-button" onClick={() => { setGuidedPrepared(false); setGuidedIndex(0); setCpu((state) => resetCpu(state)) }}>Reset</button></div>
              </>}
            </section>

            <section className="panel cycle-panel" aria-labelledby="cycle-heading">
              <div className="panel-heading"><div><p className="eyebrow">CLOCK HISTORY</p><h3 id="cycle-heading">Cycle log</h3></div><button className="text-button" onClick={clearLog} disabled={cpu.cycleLog.length === 0}>Clear log</button></div>
              <p className="panel-intro">Each clock edge is listed here with the active signals and resulting data movement.</p>
              <div className="cycle-log" aria-live="polite">{cpu.cycleLog.length === 0 ? <div className="empty-log"><span>NO CYCLES YET</span><p>Prepare an instruction in the manual version, then advance its clock. Each stage appears here in order.</p><small>Fetch · wait · decode · operands · ALU · writeback</small></div> : cpu.cycleLog.map((entry) => <article className="cycle-entry" key={entry.id}><div className="cycle-meta"><b>#{entry.id.toString().padStart(2, '0')}</b><span>{entry.mode === 'Input' ? 'MEMORY INPUT' : entry.mode.toUpperCase()}</span><small>CYCLE {entry.cycle.toString().padStart(3, '0')}</small></div><p>{entry.summary.replace(/^Manual clock edge \d+: /, '')}</p><div className="cycle-paths">{entry.paths.map((path) => <span key={path}>{pathLabels[path] ?? path}</span>)}</div>{Boolean(entry.signals?.length) && <div className="cycle-signals">{entry.signals?.map((signal) => <code key={signal}>{signal}</code>)}</div>}</article>)}</div>
            </section>
          </div>
          </div>
        </section>

        <section className="lower-grid" id="memory">
          <section className="panel program-panel"><div className="panel-heading"><div><p className="eyebrow">PROGRAM LOADER</p><h3>Load instructions into RAM</h3></div><button className="text-button" onClick={loadDemo}>Restore sample</button></div><p className="panel-intro">Enter hexadecimal instruction bytes in address order. Spaces and line breaks are allowed. Program starts at address 00.</p><label className="program-input"><span>PROGRAM BYTES · HEX</span><textarea value={programText} onChange={(event) => setProgramText(event.target.value)} spellCheck={false} /></label><div className="program-actions"><button className="primary-button" onClick={loadProgram}>Load program <span>→</span></button><span>{cpu.lastEvent}</span></div></section>
          <section className="panel memory-panel"><div className="panel-heading"><div><p className="eyebrow">256 × 8 STORAGE</p><h3>RAM inspector</h3></div><span className="memory-count">256 addresses</span></div><div className="memory-table" role="table" aria-label="RAM addresses 0 through 18"><div className="memory-row table-header" role="row"><span>ADDRESS</span><span>VALUE</span><span>ROLE</span></div>{visibleMemory.map((value, address) => <div className={`memory-row ${cpu.mar === address ? 'current-address' : ''} ${cpu.pc === address ? 'program-address' : ''}`} role="row" key={address}><span>{format(address)}</span><b>{format(value)}</b><span>{address === 0 ? 'Instruction' : address === 0x10 ? 'Operand A' : address === 0x11 ? 'Operand B' : address === 0x12 ? 'Result' : address < 5 ? 'Program' : 'Available'}</span></div>)}</div><div className="memory-edit"><Field label="Address" value={memoryEdit.address} onChange={(value) => setMemoryEdit((old) => ({ ...old, address: value }))} helper="0–255 decimal" /><Field label="Byte value" value={memoryEdit.value} onChange={(value) => setMemoryEdit((old) => ({ ...old, value }))} /><button className="secondary-button" onClick={editMemory}>Write RAM</button><p className="selected-memory">RAM[{format(memoryEdit.address)}] currently contains <b>{format(cpu.memory[memoryEdit.address] ?? 0)}</b></p></div></section>
        </section>

        <section className="panel register-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE STATE</p><h3>Registers and flags</h3></div><span className="register-caption">Unsigned values · hexadecimal</span></div><div className="register-grid">{[['PC', cpu.pc, 'Program counter'], ['MAR', cpu.mar, 'Memory address'], ['MDR', cpu.mdr, 'Memory data'], ['IR', cpu.ir, 'Instruction'], ['A', cpu.a, 'Accumulator'], ['B', cpu.b, 'General register']].map(([name, value, description]) => <div className="register-card" key={name as string}><span>{name}</span><strong>{format(value as number)}</strong><small>{description}</small></div>)}<div className="register-card flag-card"><span>FLAGS</span><strong>Z {cpu.zero ? 1 : 0} · C {cpu.carry ? 1 : 0}</strong><small>Zero · carry / no borrow</small></div></div></section>
      </main>
      <footer className="site-footer"><span>8 BIT MINI CPU</span><span>Based on the project datapath reference · React + TypeScript</span><a href="./documentation.md" target="_blank" rel="noreferrer">Technical documentation</a></footer>
    </div>
  )
}

export default SimulatorPage
