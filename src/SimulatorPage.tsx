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
  const busX = 920
  const component = {
    ram: { x: 70, y: 350, w: 340, h: 290, right: 410 },
    mar: { x: 500, y: 365, w: 250, h: 90, left: 500, right: 750, cy: 410 },
    mdr: { x: 500, y: 510, w: 250, h: 90, left: 500, right: 750, cy: 555 },
    alu: { x: 500, y: 680, w: 260, h: 130, left: 500, right: 760, cx: 630 },
    z: { x: 500, y: 865, w: 260, h: 86, right: 760, cx: 630 },
    pc: { x: 1070, y: 125, w: 290, h: 94, left: 1070, right: 1360, cy: 172 },
    ir: { x: 1070, y: 370, w: 300, h: 90, left: 1070, right: 1370, cy: 415 },
    a: { x: 1070, y: 555, w: 300, h: 90, left: 1070, right: 1370, cy: 600 },
    b: { x: 1070, y: 695, w: 300, h: 90, left: 1070, right: 1370, cy: 740 },
    out: { x: 1070, y: 865, w: 300, h: 86, left: 1070, right: 1370, cy: 908 },
    cu: { x: 1430, y: 120, w: 330, h: 170, left: 1430, bottom: 290, cy: 205, right: 1760 },
    clock: { x: 1450, y: 350, w: 300, h: 70, cx: 1600 },
    flags: { x: 1450, y: 555, w: 260, h: 150, left: 1450 },
    operands: { x: 1430, y: 780, w: 330, h: 200, left: 1430 },
  }
  type Point = { x: number; y: number }
  const busRoute = (from: Point, to: Point) => `M${from.x} ${from.y} H${busX} V${to.y} H${to.x}`
  const routeAroundOutput = (fromY: number, to: Point) => `M${component.operands.left} ${fromY} H1400 V1010 H${busX} V${to.y} H${to.x}`
  const paths: Record<string, string> = {
    'pc-mar': busRoute({ x: component.pc.left, y: component.pc.cy }, { x: component.mar.right, y: component.mar.cy }),
    'pc-increment': `M1215 219 V240 M1305 263 H1400 V172 H${component.pc.right}`,
    'mar-ram': `M${component.mar.left} ${component.mar.cy} H${component.ram.right}`,
    'ram-mdr': `M${component.ram.right} ${component.mdr.cy} H${component.mdr.left}`,
    'mdr-ram': `M${component.mdr.left} ${component.mdr.cy} H${component.ram.right}`,
    'mdr-ir': busRoute({ x: component.mdr.right, y: component.mdr.cy }, { x: component.ir.left, y: component.ir.cy }),
    'mdr-fields': `M${component.mdr.right} ${component.mdr.cy} H${busX} V320 H1400 V${component.cu.cy} H${component.cu.left}`,
    'ir-control': `M${component.ir.right} ${component.ir.cy} H1400 V220 H${component.cu.left}`,
    'a-operand1': busRoute({ x: component.a.left, y: component.a.cy }, { x: component.operands.left, y: 825 }),
    'b-operand1': busRoute({ x: component.b.left, y: component.b.cy }, { x: component.operands.left, y: 825 }),
    'a-operand2': busRoute({ x: component.a.left, y: component.a.cy }, { x: component.operands.left, y: 875 }),
    'b-operand2': busRoute({ x: component.b.left, y: component.b.cy }, { x: component.operands.left, y: 875 }),
    'mdr-operand1': busRoute({ x: component.mdr.right, y: component.mdr.cy }, { x: component.operands.left, y: 825 }),
    'mdr-operand2': busRoute({ x: component.mdr.right, y: component.mdr.cy }, { x: component.operands.left, y: 875 }),
    'source1-address-mar': routeAroundOutput(900, { x: component.mar.right, y: component.mar.cy }),
    'source2-address-mar': routeAroundOutput(924, { x: component.mar.right, y: component.mar.cy }),
    'operand1-alu': busRoute({ x: component.operands.left, y: 825 }, { x: component.alu.right, y: 735 }),
    'operand2-alu': busRoute({ x: component.operands.left, y: 875 }, { x: component.alu.right, y: 775 }),
    'alu-z': `M${component.alu.cx} 810 V${component.z.y}`,
    'z-a': busRoute({ x: component.z.right, y: 908 }, { x: component.a.left, y: component.a.cy }),
    'z-b': busRoute({ x: component.z.right, y: 908 }, { x: component.b.left, y: component.b.cy }),
    'z-output': busRoute({ x: component.z.right, y: 908 }, { x: component.out.left, y: component.out.cy }),
    'z-mdr': busRoute({ x: component.z.right, y: 908 }, { x: component.mdr.right, y: component.mdr.cy }),
    'destination-address-mar': routeAroundOutput(948, { x: component.mar.right, y: component.mar.cy }),
    'ram-read': 'M1500 290 H1415 V1035 H450 V620 H410',
    'ram-write': 'M1500 290 H1415 V1035 H450 V620 H410',
    'alu-flags': `M${component.alu.right} 785 H940 V660 H1420 V630 H${component.flags.x}`,
    'clock-edge': `M${component.clock.cx} ${component.cu.bottom} V${component.clock.y}`,
    'cu-control': `M${component.cu.right} 260 H1790 V880 H1760`,
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
  const taps = [172, 263, 410, 415, 555, 600, 630, 660, 735, 740, 775, 825, 875, 908]

  return <div className="diagram-pan" tabIndex={0} aria-label="Scrollable single-bus CPU diagram">
    <svg className="cpu-diagram" viewBox="0 0 1840 1080" role="img" aria-label={`Single internal bus CPU. PC ${formatByte(state.pc)}, IR ${formatByte(state.ir)}, A ${formatByte(state.a)}, B ${formatByte(state.b)}, MAR ${formatByte(state.mar)}, MDR ${formatByte(state.mdr)}, output ${formatByte(state.output)}, Zero ${Number(state.zero)}, Negative ${Number(state.negative)}, Carry ${Number(state.carry)}, cycles ${state.cycles}. External RAM address, data, and control lines are separate.`}>
      {/* Draw all routed wires before the cards so a route never runs over component text. */}
      <path className="internal-bus" d={`M${busX} 80 V1010`} />
      <text className="wire-label internal-label" x={busX} y="62" textAnchor="middle">SINGLE INTERNAL BUS · 8 BITS</text>
      <text className="wire-label bus-caption" x={busX} y="1062" textAnchor="middle">One selected source drives the bus on each rising edge</text>

      <text className="wire-label address-label external-port-label" x="455" y="397" textAnchor="middle">ADDRESS</text>
      <text className="wire-label data-label external-port-label" x="455" y="542" textAnchor="middle">DATA</text>
      <text className="wire-label control-label" x="430" y="648">READ / WRITE / WMFC</text>
      <text className="wire-label control-label external-control-caption" x="920" y="1018" textAnchor="middle">EXTERNAL MEMORY CONTROL · READ / WRITE / WMFC</text>
      <text className="wire-label control-label" x="1195" y="680" textAnchor="middle">FLAG UPDATE</text>

      <path className="control-rail" d={paths['cu-control']} />
      <path className="control-branch" d="M1790 385 H1750 M1790 630 H1710 M1790 850 H1760" />
      {[260, 385, 630, 850].map((y) => <circle className="control-tap" key={y} cx="1790" cy={y} r="4" />)}
      <text className="wire-label control-label" x="1777" y="570" textAnchor="end" transform="rotate(-90 1777 570)">CONTROL SIGNALS</text>
      <path className={`clock-wire${active(state, 'clock-edge') ? ' route-active' : ''}`} d={paths['clock-edge']} />

      {Object.entries(paths).filter(([name]) => !['clock-edge', 'cu-control', 'ram-write', 'mdr-ram'].includes(name)).map(([name, d]) => {
        const isActive = name === 'ram-read'
          ? active(state, 'ram-read') || active(state, 'ram-write')
          : name === 'ram-mdr'
            ? active(state, 'ram-mdr') || active(state, 'mdr-ram')
            : active(state, name)
        const external = name === 'ram-mdr'
        const address = name === 'mar-ram'
        const signal = ['alu-flags', 'decode-control', 'ir-control', 'ram-read'].includes(name)
        return <path key={`${state.cycles}-${name}`} className={`cpu-route${external ? ' external-route' : ''}${address ? ' address-route' : ''}${signal ? ' signal-route' : ''}${isActive ? ' route-active' : ''}`} d={d} />
      })}
      <path className={`control-rail${active(state, 'cu-control') ? ' route-active' : ''}`} d={paths['cu-control']} />
      {taps.map((y) => <circle className="bus-tap" key={y} cx={busX} cy={y} r="5" />)}

      {box('PROGRAM COUNTER · PC', state.pc, component.pc.x, component.pc.y, component.pc.w, component.pc.h, 'NEXT BYTE')}
      <g className="increment-box"><rect x="1125" y="240" width="180" height="46" rx="8" /><text x="1143" y="269">INCREMENT +1</text></g>
      {box('MEMORY ADDRESS · MAR', state.mar, component.mar.x, component.mar.y, component.mar.w, component.mar.h, 'RAM ADDRESS')}
      {box('MEMORY DATA · MDR', state.mdr, component.mdr.x, component.mdr.y, component.mdr.w, component.mdr.h, 'BYTE BUFFER')}

      <g className="cpu-component ram-component">
        <rect x={component.ram.x} y={component.ram.y} width={component.ram.w} height={component.ram.h} rx="14" />
        <text className="cpu-component-title" x="92" y="385">MAIN MEMORY</text>
        <text className="ram-capacity" x="92" y="427">RAM · 256 × 8</text>
        <text className="cpu-component-value" x="92" y="478">{formatByte(state.memory[state.mar] ?? 0)}</text>
        <text className="cpu-component-caption" x="92" y="507">RAM[{formatByte(state.mar)}] · selected</text>
        <text className="ram-port-label" x="92" y="574">A[7:0] · D[7:0] · R/W</text>
        <text className="ram-port-label" x="92" y="604">program and data share RAM</text>
      </g>

      {box('INSTRUCTION REGISTER · IR', state.ir, component.ir.x, component.ir.y, component.ir.w, component.ir.h, state.instructionName)}
      {box('GENERAL REGISTER · A', state.a, component.a.x, component.a.y, component.a.w, component.a.h, '8-BIT')}
      {box('GENERAL REGISTER · B', state.b, component.b.x, component.b.y, component.b.w, component.b.h, '8-BIT')}

      <g className={`cpu-component alu-component${active(state, 'alu-flags') ? ' active-alu' : ''}`}>
        <rect x={component.alu.x} y={component.alu.y} width={component.alu.w} height={component.alu.h} rx="14" />
        <text className="cpu-component-title" x="520" y="710">ALU · 8-BIT</text>
        <text className="alu-op" x="520" y="750">{state.instructionName === '—' ? 'READY' : state.instructionName}</text>
        <text className="cpu-component-caption" x="520" y="782">A {formatByte(state.aluA)} · B {formatByte(state.aluB)}</text>
      </g>
      {box('RESULT REGISTER · Z', state.zRegister, component.z.x, component.z.y, component.z.w, component.z.h, 'WRITEBACK')}
      {box('OUTPUT REGISTER · OUT', state.output, component.out.x, component.out.y, component.out.w, component.out.h, 'RESULT')}

      <g className="cpu-component control-component">
        <rect x={component.cu.x} y={component.cu.y} width={component.cu.w} height={component.cu.h} rx="14" />
        <text className="cpu-component-title" x="1452" y="155">CONTROL UNIT</text>
        <text className="control-op" x="1452" y="190">{state.instructionName}</text>
        <text className="control-detail" x="1452" y="220">1 · {sourceText(state.leftSource)}</text>
        <text className="control-detail" x="1452" y="242">2 · {sourceText(state.rightSource)}</text>
        <text className="control-detail" x="1452" y="264">DEST · {destinationText}</text>
      </g>
      <g className="cpu-component clock-component">
        <rect x={component.clock.x} y={component.clock.y} width={component.clock.w} height={component.clock.h} rx="12" />
        <text className="cpu-component-title" x="1468" y="378">MANUAL CLOCK</text>
        <text className="clock-readout" x="1468" y="404">RISING EDGE · {state.cycles.toString().padStart(3, '0')}</text>
      </g>

      <g className="cpu-component operand-component">
        <rect x={component.operands.x} y={component.operands.y} width={component.operands.w} height={component.operands.h} rx="14" />
        <text className="cpu-component-title" x="1452" y="810">OPERAND / ADDRESS</text>
        <text className="operand-value" x="1452" y="842">1 · {formatByte(state.operand1)}</text>
        <text className="operand-value" x="1452" y="872">2 · {formatByte(state.operand2)}</text>
        <text className="operand-address" x="1452" y="902">SRC 1 · {sourceText(state.leftSource)}</text>
        <text className="operand-address" x="1452" y="928">SRC 2 · {sourceText(state.rightSource)}</text>
        <text className="operand-address" x="1452" y="954">DEST · {destinationText}</text>
      </g>
      <g className="cpu-component flag-component">
        <rect x={component.flags.x} y={component.flags.y} width={component.flags.w} height={component.flags.h} rx="14" />
        <text className="cpu-component-title" x="1470" y="585">FLAGS</text>
        <text className="flag-value" x="1470" y="624">Z · {Number(state.zero)}</text>
        <text className="flag-value" x="1572" y="624">C · {Number(state.carry)}</text>
        <text className="flag-value" x="1470" y="656">N · {Number(state.negative)}</text>
        <text className="cpu-component-caption" x="1470" y="684">Zero · Negative · Carry</text>
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
    <LightTunnel className="simulator-light-tunnel" cableColor="#ffffff" pulseColor="#ffffff" cableCount={56} pulseDensity={0.2} flowDirection="inward" mouseInteraction={false} clickSurge={false} tunnelColor="#101116" tunnelOpacity={0} speed={0.045} pulseSpeed={1.2} pulseLength={0.18} pulseBlend={0.45} pulseWidth={0.65} thickness={0.18} rimWidth={0.1} waviness={0.18} sway={0.22} bend={0.25} glow={0.36} size={1} fadeNear={0.55} fadeFar={2} brightness={0.26} colorVariance={false} grain={false} intro lightMode={false} />
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
