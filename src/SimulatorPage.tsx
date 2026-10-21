import { useMemo, useState } from 'react'
import LightTunnel from './LightTunnel'
import SiteHeader from './SiteHeader'
import {
  DEMO_INSTRUCTIONS, DEMO_RAM_INITIAL, OPERATIONS, formatByte, initialCpuState,
  loadConfiguredProgram, microstepLabel, resetCpu, stepClock,
  type CpuState, type DestinationKind, type InstructionConfig, type Operation,
  type RamInitialValue, type SourceKind,
} from './cpu'

type DraftRam = { id: number; address: string; value: string }
const initialInstructions = () => DEMO_INSTRUCTIONS.map((item) => ({ ...item, left: { ...item.left }, right: { ...item.right }, destination: { ...item.destination } }))
const initialRamDraft = (): DraftRam[] => DEMO_RAM_INITIAL.map((entry, index) => ({ id: index + 1, address: String(entry.address), value: String(entry.value) }))

const active = (state: CpuState, name: string) => state.activePaths.includes(name)

function CpuDiagram({ state }: { state: CpuState }) {
  const paths: Record<string, string> = {
    'pc-mar': 'M990 170 H810 V330 H720',
    'pc-increment': 'M1110 219 V240 M1150 263 H1248 V170 H1230',
    'mar-ram': 'M520 345 H430 V410 H360',
    'ram-mdr': 'M360 555 H430 V545 H520',
    'mdr-ram': 'M520 545 H430 V555 H360',
    'mdr-ir': 'M720 545 H810 V415 H990',
    'mdr-fields': 'M720 545 H810 V100 H1390 V120',
    'ir-control': 'M1230 415 H1245 V145 H1260',
    'a-operand1': 'M990 600 H810 V825 H1260',
    'b-operand1': 'M990 740 H810 V825 H1260',
    'a-operand2': 'M990 600 H810 V875 H1260',
    'b-operand2': 'M990 740 H810 V875 H1260',
    'mdr-operand1': 'M720 545 H810 V825 H1260',
    'mdr-operand2': 'M720 545 H810 V875 H1260',
    'source1-address-mar': 'M1260 898 H810 V350 H720',
    'source2-address-mar': 'M1260 922 H810 V360 H720',
    'operand1-alu': 'M1260 825 H810 V735 H740',
    'operand2-alu': 'M1260 875 H810 V775 H740',
    'alu-z': 'M620 810 V865',
    'z-a': 'M740 908 H810 V600 H990',
    'z-b': 'M740 908 H810 V740 H990',
    'z-output': 'M740 908 H810 H990',
    'z-mdr': 'M740 908 H810 V545 H720',
    'destination-address-mar': 'M1260 946 H810 V370 H720',
    'ram-read': 'M1520 280 H1580 V1008 H380 V620 H360',
    'ram-write': 'M1520 280 H1580 V1008 H380 V620 H360',
    'alu-flags': 'M740 785 H835 V640 H1270',
    'clock-edge': 'M1380 290 V350',
    'cu-control': 'M1520 260 H1550 V850 H1490',
  }

  const box = (title: string, value: number | string, x: number, y: number, w: number, h: number, subtitle = '', extraClass = '') => (
    <g className={`cpu-component ${extraClass}`} key={title}>
      <rect x={x} y={y} width={w} height={h} rx="12" />
      <text className="cpu-component-title" x={x + 17} y={y + 28}>{title}</text>
      <text className="cpu-component-value" x={x + 17} y={y + 64}>{typeof value === 'number' ? formatByte(value) : value}</text>
      {subtitle && <text className="cpu-component-caption" x={x + w - 15} y={y + 63} textAnchor="end">{subtitle}</text>}
    </g>
  )
  const sourceText = (source: CpuState['leftSource']) => source ? (source.kind === 'RAM' ? `RAM[${formatByte(source.address ?? 0)}]` : source.kind) : '—'
  const destinationText = state.destination ? (state.destination.kind === 'RAM' ? `RAM[${formatByte(state.destination.address ?? 0)}]` : state.destination.kind === 'OUT' ? 'OUT' : state.destination.kind) : '—'
  const taps = [170, 240, 330, 350, 360, 380, 415, 545, 600, 735, 740, 775, 825, 875, 898, 908, 922, 946]

  return <div className="diagram-pan" tabIndex={0} aria-label="Scrollable single-bus CPU diagram">
    <svg className="cpu-diagram" viewBox="0 0 1600 1060" role="img" aria-label={`Single internal bus CPU. PC ${formatByte(state.pc)}, IR ${formatByte(state.ir)}, A ${formatByte(state.a)}, B ${formatByte(state.b)}, MAR ${formatByte(state.mar)}, MDR ${formatByte(state.mdr)}, output ${formatByte(state.output)}, Zero ${Number(state.zero)}, Negative ${Number(state.negative)}, Carry ${Number(state.carry)}, cycles ${state.cycles}. External RAM address, data, and control lines are separate.`}>
      <defs>
        <marker id="cpu-arrow-muted" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8 z" fill="#65717d" /></marker>
        <marker id="cpu-arrow-live" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8 z" fill="#96e7dd" /></marker>
        <marker id="cpu-arrow-address" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8 z" fill="#d6a36d" /></marker>
        <marker id="cpu-arrow-control" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8 z" fill="#efbc86" /></marker>
      </defs>

      <path className="internal-bus" d="M810 100 V960" />
      <text className="wire-label internal-label" x="810" y="78" textAnchor="middle">SINGLE INTERNAL BUS · 8 BITS</text>
      <text className="wire-label bus-caption" x="810" y="1042" textAnchor="middle">One selected source drives the bus on each rising edge</text>

      <path className="external-wire address-wire" d="M520 345 H430 V410 H360" markerEnd="url(#cpu-arrow-address)" />
      <path className="external-wire data-wire" d="M360 555 H430 V545 H520" markerEnd="url(#cpu-arrow-muted)" />
      <path className="external-wire control-wire" d="M1520 280 H1580 V1008 H380 V620 H360" markerEnd="url(#cpu-arrow-control)" />
      <text className="wire-label address-label" x="435" y="438" textAnchor="middle">ADDRESS · 8 BIT</text>
      <text className="wire-label data-label" x="435" y="520" textAnchor="middle">DATA · 8 BIT</text>
      <text className="wire-label control-label" x="390" y="674">READ / WRITE / WMFC</text>
      <text className="wire-label control-label external-control-caption" x="810" y="990" textAnchor="middle">EXTERNAL MEMORY CONTROL · READ / WRITE / WMFC</text>
      <text className="wire-label control-label" x="1060" y="628" textAnchor="middle">FLAG UPDATE</text>

      <path className="control-rail" d="M1520 260 H1550 V880 H1230" markerEnd="url(#cpu-arrow-control)" />
      <path className="control-branch" d="M1550 380 H1490 M1550 630 H1490 M1550 850 H1490" />
      {[280, 380, 630, 850].map((y) => <circle className="control-tap" key={y} cx="1550" cy={y} r="4" />)}
      <text className="wire-label control-label" x="1538" y="560" textAnchor="end" transform="rotate(-90 1538 560)">CONTROL SIGNALS</text>
      <path className={`clock-wire${active(state, 'clock-edge') ? ' route-active' : ''}`} d={paths['clock-edge']} markerEnd={active(state, 'clock-edge') ? 'url(#cpu-arrow-control)' : 'url(#cpu-arrow-muted)'} />

      {Object.entries(paths).filter(([name]) => !['clock-edge', 'cu-control'].includes(name)).map(([name, d]) => {
        const isActive = active(state, name)
        const external = ['mar-ram', 'ram-mdr', 'mdr-ram', 'ram-read', 'ram-write'].includes(name)
        const signal = ['alu-flags', 'decode-control', 'ir-control', 'ram-read', 'ram-write'].includes(name)
        return <path key={`${state.cycles}-${name}`} className={`cpu-route${external ? ' external-route' : ''}${signal ? ' signal-route' : ''}${isActive ? ' route-active' : ''}`} d={d} markerEnd={isActive ? (external ? 'url(#cpu-arrow-address)' : signal ? 'url(#cpu-arrow-control)' : 'url(#cpu-arrow-live)') : 'url(#cpu-arrow-muted)'} />
      })}
      <path className={`control-rail${active(state, 'cu-control') ? ' route-active' : ''}`} d={paths['cu-control']} markerEnd={active(state, 'cu-control') ? 'url(#cpu-arrow-control)' : 'url(#cpu-arrow-muted)'} />
      {taps.map((y) => <circle className="bus-tap" key={y} cx="810" cy={y} r="5" />)}

      {box('PROGRAM COUNTER · PC', state.pc, 990, 125, 240, 94, 'NEXT BYTE')}
      <g className="increment-box"><rect x="990" y="240" width="160" height="46" rx="8" /><text x="1008" y="269">INCREMENT +1</text></g>
      {box('MEMORY ADDRESS · MAR', state.mar, 520, 300, 200, 90, 'RAM ADDRESS')}
      {box('MEMORY DATA · MDR', state.mdr, 520, 500, 200, 90, 'BYTE BUFFER')}

      <g className="cpu-component ram-component">
        <rect x="80" y="350" width="280" height="290" rx="14" />
        <text className="cpu-component-title" x="102" y="385">MAIN MEMORY</text>
        <text className="ram-capacity" x="102" y="427">RAM · 256 × 8</text>
        <text className="cpu-component-value" x="102" y="478">{formatByte(state.memory[state.mar] ?? 0)}</text>
        <text className="cpu-component-caption" x="102" y="507">RAM[{formatByte(state.mar)}] · selected</text>
        <path className="ram-port" d="M360 410 H381 M360 555 H381 M360 620 H381" />
        <text className="ram-port-label" x="102" y="574">A[7:0] · D[7:0] · R/W</text>
        <text className="ram-port-label" x="102" y="604">program and data share RAM</text>
      </g>

      {box('INSTRUCTION REGISTER · IR', state.ir, 990, 370, 240, 90, state.instructionName)}
      {box('GENERAL REGISTER · A', state.a, 990, 555, 240, 90, '8-BIT')}
      {box('GENERAL REGISTER · B', state.b, 990, 695, 240, 90, '8-BIT')}

      <g className={`cpu-component alu-component${active(state, 'alu-flags') ? ' active-alu' : ''}`}>
        <rect x="500" y="680" width="240" height="130" rx="14" />
        <text className="cpu-component-title" x="520" y="710">ALU · 8-BIT</text>
        <text className="alu-op" x="520" y="750">{state.instructionName === '—' ? 'READY' : state.instructionName}</text>
        <text className="cpu-component-caption" x="520" y="782">A {formatByte(state.aluA)} · B {formatByte(state.aluB)}</text>
      </g>
      {box('RESULT REGISTER · Z', state.zRegister, 500, 865, 240, 86, 'WRITEBACK')}
      {box('OUTPUT REGISTER · OUT', state.output, 990, 865, 240, 86, 'RESULT')}

      <g className="cpu-component control-component">
        <rect x="1260" y="120" width="260" height="170" rx="14" />
        <text className="cpu-component-title" x="1282" y="155">CONTROL UNIT</text>
        <text className="control-op" x="1282" y="190">{state.instructionName}</text>
        <text className="control-detail" x="1282" y="220">1 · {sourceText(state.leftSource)}</text>
        <text className="control-detail" x="1282" y="242">2 · {sourceText(state.rightSource)}</text>
        <text className="control-detail" x="1282" y="264">DEST · {destinationText}</text>
      </g>
      <g className="cpu-component clock-component">
        <rect x="1270" y="350" width="220" height="70" rx="12" />
        <text className="cpu-component-title" x="1288" y="378">MANUAL CLOCK</text>
        <text className="clock-readout" x="1288" y="404">RISING EDGE · {state.cycles.toString().padStart(3, '0')}</text>
      </g>

      <g className="cpu-component operand-component">
        <rect x="1260" y="780" width="230" height="200" rx="14" />
        <text className="cpu-component-title" x="1280" y="810">OPERAND / ADDRESS</text>
        <text className="operand-value" x="1280" y="842">1 · {formatByte(state.operand1)}</text>
        <text className="operand-value" x="1280" y="872">2 · {formatByte(state.operand2)}</text>
        <text className="operand-address" x="1280" y="902">SRC 1 · {sourceText(state.leftSource)}</text>
        <text className="operand-address" x="1280" y="928">SRC 2 · {sourceText(state.rightSource)}</text>
        <text className="operand-address" x="1280" y="954">DEST · {destinationText}</text>
      </g>
      <g className="cpu-component flag-component">
        <rect x="1270" y="555" width="220" height="150" rx="14" />
        <text className="cpu-component-title" x="1290" y="585">FLAGS</text>
        <text className="flag-value" x="1290" y="624">Z · {Number(state.zero)}</text>
        <text className="flag-value" x="1290" y="656">N · {Number(state.negative)}</text>
        <text className="flag-value" x="1392" y="624">C · {Number(state.carry)}</text>
        <text className="cpu-component-caption" x="1290" y="684">Zero · Negative · Carry</text>
      </g>
    </svg>
  </div>
}

function SourceFields({ label, value, onChange }: { label: string; value: { kind: SourceKind; address: number | null }; onChange: (value: { kind: SourceKind; address: number | null }) => void }) {
  return <div className="source-config">
    <label>{label}<select value={value.kind} onChange={(event) => onChange({ kind: event.target.value as SourceKind, address: event.target.value === 'RAM' ? value.address ?? 128 : null })}><option value="A">Register A</option><option value="B">Register B</option><option value="RAM">RAM</option></select></label>
    {value.kind === 'RAM' && <label className="address-field">Address<input type="number" min="0" max="255" value={value.address ?? ''} onChange={(event) => onChange({ ...value, address: event.target.value === '' ? null : Number(event.target.value) })} placeholder="0–255" /></label>}
  </div>
}

function DestinationFields({ value, onChange }: { value: { kind: DestinationKind; address: number | null }; onChange: (value: { kind: DestinationKind; address: number | null }) => void }) {
  return <div className="source-config">
    <label>Destination<select value={value.kind} onChange={(event) => onChange({ kind: event.target.value as DestinationKind, address: event.target.value === 'RAM' ? value.address ?? 128 : null })}><option value="A">Register A</option><option value="B">Register B</option><option value="RAM">RAM</option><option value="OUT">Output register</option></select></label>
    {value.kind === 'RAM' && <label className="address-field">Address<input type="number" min="0" max="255" value={value.address ?? ''} onChange={(event) => onChange({ ...value, address: event.target.value === '' ? null : Number(event.target.value) })} placeholder="0–255" /></label>}
  </div>
}

function createInstruction(id: number): InstructionConfig {
  return { id, operation: 'ADD', left: { kind: 'A', address: null }, right: { kind: 'B', address: null }, destination: { kind: 'A', address: null } }
}

export default function SimulatorPage() {
  const [cpu, setCpu] = useState(() => initialCpuState())
  const [instructions, setInstructions] = useState<InstructionConfig[]>(initialInstructions)
  const [ramDraft, setRamDraft] = useState<DraftRam[]>(initialRamDraft)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(true)
  const [nextId, setNextId] = useState(10)

  const listing = useMemo(() => {
    const bytes = cpu.programBytes
    return Array.from({ length: bytes.length / 7 }, (_, index) => {
      const start = index * 7
      return { index, address: start, bytes: bytes.slice(start, start + 7), operation: OPERATIONS.find((op) => ({ ADD: 0x10, SUB: 0x11, MULT: 0x12, DIV: 0x13, AND: 0x14, OR: 0x15, XOR: 0x16, HLT: 0xff }[op] === bytes[start])) ?? 'INVALID' }
    })
  }, [cpu.programBytes])

  const step = () => {
    if (!cpu.halted) {
      setCpu((previous) => stepClock(previous))
      setLoaded(true)
    }
  }
  const reset = () => {
    setCpu((previous) => resetCpu(previous))
    setError('')
  }
  const load = () => {
    const values: RamInitialValue[] = ramDraft.map((entry) => ({
      address: entry.address.trim() === '' ? null : Number(entry.address),
      value: entry.value.trim() === '' ? null : Number(entry.value),
    }))
    const result = loadConfiguredProgram(cpu, instructions, values)
    setCpu(result.state)
    setError(result.error)
    setLoaded(!result.error)
  }
  const restoreDemo = () => {
    setInstructions(initialInstructions())
    setRamDraft(initialRamDraft())
    setNextId(10)
    const result = loadConfiguredProgram(cpu, DEMO_INSTRUCTIONS, DEMO_RAM_INITIAL)
    setCpu(result.state)
    setError(result.error)
    setLoaded(true)
  }
  const updateInstruction = (id: number, update: (instruction: InstructionConfig) => InstructionConfig) => setInstructions((items) => items.map((item) => item.id === id ? update(item) : item))
  const moveInstruction = (index: number, offset: number) => setInstructions((items) => {
    const target = index + offset
    if (target < 0 || target >= items.length) return items
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const markDirty = () => { setLoaded(false); setError('') }
  const editInstruction = (id: number, update: (instruction: InstructionConfig) => InstructionConfig) => { updateInstruction(id, update); markDirty() }
  const reorderInstruction = (index: number, offset: number) => { moveInstruction(index, offset); markDirty() }
  const addRamRow = () => { setRamDraft((rows) => [...rows, { id: Math.max(0, ...rows.map((row) => row.id)) + 1, address: '', value: '' }]); markDirty() }

  return <div className="site-frame simulator-frame">
    <LightTunnel className="circuit-light-tunnel" cableColor="#ffffff" pulseColor="#ffffff" cableCount={56} pulseDensity={0.28} flowDirection="inward" mouseInteraction={false} clickSurge={false} tunnelColor="#101116" tunnelOpacity={0} speed={0.055} pulseSpeed={1.4} pulseLength={0.2} pulseBlend={0.5} pulseWidth={0.7} thickness={0.22} rimWidth={0.12} waviness={0.22} sway={0.28} bend={0.3} glow={0.45} size={1} fadeNear={0.55} fadeFar={2} brightness={0.36} colorVariance={false} grain={false} intro lightMode={false} />
    <SiteHeader page="simulator" />
    <main className="simulator-page">
      <section className="circuit-section" id="circuit" aria-labelledby="circuit-title">
        <div className="circuit-heading"><div><p className="eyebrow">SINGLE-BUS PROCESSOR · MANUAL CONTROL</p><h1 id="circuit-title">Circuit</h1><p>Step one rising clock edge at a time. The lit route and signal list come from that exact CPU micro-operation.</p></div><div className="circuit-status"><span className={cpu.halted ? 'status-indicator halted' : 'status-indicator'} />{cpu.halted ? 'HALTED' : 'READY'}<strong>PC {formatByte(cpu.pc)}</strong></div></div>
        <section className="panel circuit-panel" aria-label="8-bit CPU circuit">
          <div className="diagram-heading"><div><h2>8-bit single internal bus</h2><p>External RAM address, data, and control lines are shown separately. Scroll horizontally on smaller screens.</p></div><span className="bus-legend"><i /> active transfer</span></div>
          <CpuDiagram state={cpu} />
          <div className="circuit-edge-footer">
            <div className="edge-description" aria-live="polite"><span className="eyebrow">LAST EDGE · {cpu.cycleLog.at(-1)?.phase ?? 'READY'}</span><p>{cpu.lastEvent}</p><div className="edge-signals"><span>NEXT · {microstepLabel(cpu.microstep)}</span><span>CYCLE {cpu.cycles.toString().padStart(3, '0')}</span><span>INSTRUCTION {cpu.completedInstructions.toString().padStart(2, '0')}</span><span>PC {formatByte(cpu.pc)} · IR {formatByte(cpu.ir)}</span><span>MAR {formatByte(cpu.mar)} · MDR {formatByte(cpu.mdr)}</span></div>
              <div className="active-signal-list"><small>CONTROL SIGNALS ON THIS EDGE</small>{cpu.activeSignals.length ? cpu.activeSignals.map((signal) => <code key={signal}>{signal}</code>) : <span className="quiet-note">No edge has occurred yet.</span>}</div>
            </div>
            <div className="clock-actions"><button className="primary-button" onClick={step} disabled={cpu.halted || !loaded}>Step Clock</button><button className="secondary-button" onClick={reset}>Reset</button></div>
          </div>
        </section>
      </section>

      <section className="configuration-section" id="guide" aria-labelledby="configuration-title">
        <div className="config-heading"><div><p className="eyebrow">GUIDE & INSTRUCTION SET</p><h2 id="configuration-title">Configure the program</h2><p>Choose two sources and a destination for each operation, set any RAM values, then load and step.</p></div><button className="text-button" onClick={restoreDemo}>Restore example</button></div>
        <div className="encoding-strip"><span><b>7 bytes per instruction</b> · opcode · operand 1 source/address · operand 2 source/address · destination/address</span><details><summary>Operation reference</summary><div className="operation-reference">{OPERATIONS.map((op) => <span key={op}><b>{op}</b> {op === 'DIV' ? 'integer quotient' : op === 'HLT' ? 'stop after fetch' : '8-bit result'}</span>)}</div><p>Addresses and values are 0–255. DIV by zero writes 00h and sets Carry. Code starts at 00h; initial data must follow the program.</p></details></div>
        <section className="panel instruction-config-panel">
          <div className="panel-heading"><div><p className="eyebrow">PROGRAM ORDER</p><h3>Instructions</h3></div><button className="secondary-button" onClick={() => { setInstructions((items) => [...items, createInstruction(nextId)]); setNextId((id) => id + 1); markDirty() }}>Add instruction</button></div>
          <div className="instruction-editor" role="list" aria-label="Program instructions">
            {instructions.map((instruction, index) => <article className="instruction-editor-row" role="listitem" key={instruction.id}>
              <div className="instruction-order"><b>{String(index + 1).padStart(2, '0')}</b><div><button aria-label={`Move instruction ${index + 1} up`} onClick={() => reorderInstruction(index, -1)} disabled={index === 0}>↑</button><button aria-label={`Move instruction ${index + 1} down`} onClick={() => reorderInstruction(index, 1)} disabled={index === instructions.length - 1}>↓</button></div></div>
              <label className="operation-field">Operation<select value={instruction.operation} onChange={(event) => editInstruction(instruction.id, (item) => ({ ...item, operation: event.target.value as Operation }))}>{OPERATIONS.map((operation) => <option key={operation} value={operation}>{operation}</option>)}</select></label>
              {instruction.operation === 'HLT' ? <div className="halt-note">No operands or destination are used.</div> : <>
                <SourceFields label="Operand 1" value={instruction.left} onChange={(left) => editInstruction(instruction.id, (item) => ({ ...item, left }))} />
                <SourceFields label="Operand 2" value={instruction.right} onChange={(right) => editInstruction(instruction.id, (item) => ({ ...item, right }))} />
                <DestinationFields value={instruction.destination} onChange={(destination) => editInstruction(instruction.id, (item) => ({ ...item, destination }))} />
              </>}
              <div className="instruction-row-actions"><code>{instruction.operation === 'HLT' ? 'FF' : ({ ADD: '10', SUB: '11', MULT: '12', DIV: '13', AND: '14', OR: '15', XOR: '16' }[instruction.operation])} · 7 bytes</code><button aria-label={`Remove instruction ${index + 1}`} onClick={() => { setInstructions((items) => items.filter((item) => item.id !== instruction.id)); markDirty() }} disabled={instructions.length <= 1}>Remove</button></div>
            </article>)}
          </div>
        </section>

        <section className="panel ram-initial-panel">
          <div className="panel-heading"><div><p className="eyebrow">DATA MEMORY</p><h3>RAM initial values</h3></div><button className="secondary-button" onClick={addRamRow}>Add RAM value</button></div>
          <p className="compact-help">Program bytes occupy the beginning of RAM. Use a later address for data values; the example uses 80h–82h.</p>
          <div className="ram-editor-list">{ramDraft.map((entry, index) => <div className="ram-editor-row" key={entry.id}><label>Address<input type="number" min="0" max="255" value={entry.address} placeholder="0–255" onChange={(event) => { setRamDraft((items) => items.map((item) => item.id === entry.id ? { ...item, address: event.target.value } : item)); markDirty() }} /></label><label>Byte value<input type="number" min="0" max="255" value={entry.value} placeholder="0–255" onChange={(event) => { setRamDraft((items) => items.map((item) => item.id === entry.id ? { ...item, value: event.target.value } : item)); markDirty() }} /></label><span>RAM[{entry.address === '' ? '—' : formatByte(Number(entry.address))}] = {entry.value === '' ? '—' : formatByte(Number(entry.value))}</span><button className="text-button" onClick={() => { setRamDraft((items) => items.filter((item) => item.id !== entry.id)); markDirty() }} aria-label={`Remove RAM value ${index + 1}`}>Remove</button></div>)}</div>
        </section>

        <div className="load-config-row"><div role={error ? 'alert' : 'status'} className={error ? 'config-message error' : 'config-message'}>{error || (loaded ? cpu.lastEvent : 'Configuration changed. Load the program to apply these settings.')}</div><button className="primary-button" onClick={load}>Load configured program</button></div>

        <section className="panel loaded-program-panel">
          <div className="panel-heading"><div><p className="eyebrow">RAM · PROGRAM BYTES</p><h3>Loaded instruction listing</h3></div><span className="loaded-size">{cpu.programBytes.length} bytes · {listing.length} instructions</span></div>
          <div className="loaded-listing">{listing.map((row) => <article key={row.address} className="loaded-listing-row"><span className="listing-number">{String(row.index + 1).padStart(2, '0')}</span><code>{formatByte(row.address)}</code><b>{row.operation}</b><code>{row.bytes.map((value) => value.toString(16).toUpperCase().padStart(2, '0')).join(' ')}</code></article>)}</div>
        </section>

        <section className="panel trace-panel" aria-labelledby="trace-title">
          <div className="panel-heading"><div><p className="eyebrow">EDGE BY EDGE</p><h3 id="trace-title">Execution trace</h3></div><span>{cpu.cycleLog.length} clock edges</span></div>
          {cpu.cycleLog.length === 0 ? <p className="compact-help">Each Step Clock press will add one micro-operation here.</p> : <div className="trace-list">{[...cpu.cycleLog].reverse().map((edge) => <article className="trace-row" key={edge.id}><b>{edge.cycle.toString().padStart(3, '0')}</b><span>{edge.phase}</span><p>{edge.summary}</p><div>{edge.paths.map((path) => <code key={path}>{path}</code>)}</div></article>)}</div>}
        </section>
      </section>
    </main>
    <footer className="site-footer"><span>8 BIT MINI CPU</span><span>Clocked single-bus datapath · React + TypeScript</span><a href="./documentation.md" target="_blank" rel="noreferrer">Technical documentation</a></footer>
  </div>
}
