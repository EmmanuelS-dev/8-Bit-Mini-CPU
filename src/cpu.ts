export type Operation = 'ADD' | 'SUB' | 'MULT' | 'DIV' | 'AND' | 'OR' | 'XOR' | 'HLT'
export type SourceKind = 'A' | 'B' | 'RAM'
export type DestinationKind = SourceKind | 'OUT'

export type SourceConfig = { kind: SourceKind; address: number | null }
export type DestinationConfig = { kind: DestinationKind; address: number | null }
export type InstructionConfig = {
  id: number
  operation: Operation
  left: SourceConfig
  right: SourceConfig
  destination: DestinationConfig
}
export type RamInitialValue = { address: number | null; value: number | null }

export type Microstep =
  | 'fetch-address' | 'fetch-opcode' | 'load-ir' | 'decode'
  | 'field-address' | 'field-read' | 'field-load' | 'halt-instruction'
  | 'source1-register' | 'source1-address' | 'source1-read' | 'source1-load'
  | 'source2-register' | 'source2-address' | 'source2-read' | 'source2-load'
  | 'alu-load-a' | 'alu-load-b' | 'alu-execute' | 'alu-result' | 'destination-writeback'
  | 'destination-address' | 'destination-data' | 'destination-store' | 'halted'

export type CycleRecord = {
  id: number
  cycle: number
  phase: string
  summary: string
  paths: string[]
  signals: string[]
}

export type CpuState = {
  pc: number
  mar: number
  mdr: number
  ir: number
  a: number
  b: number
  operand1: number
  operand2: number
  aluA: number
  aluB: number
  aluResult: number
  zRegister: number
  output: number
  zero: boolean
  negative: boolean
  carry: boolean
  halted: boolean
  cycles: number
  completedInstructions: number
  instructionAddress: number
  microstep: Microstep
  instructionName: string
  instructionFields: number[]
  fieldIndex: number
  leftSource: SourceConfig | null
  rightSource: SourceConfig | null
  destination: DestinationConfig | null
  memory: number[]
  programBytes: number[]
  initialRam: Array<{ address: number; value: number }>
  activePaths: string[]
  activeSignals: string[]
  lastEvent: string
  cycleLog: CycleRecord[]
}

export const OPERATIONS: Operation[] = ['ADD', 'SUB', 'MULT', 'DIV', 'AND', 'OR', 'XOR', 'HLT']
const operationCodes: Record<Operation, number> = {
  ADD: 0x10, SUB: 0x11, MULT: 0x12, DIV: 0x13,
  AND: 0x14, OR: 0x15, XOR: 0x16, HLT: 0xff,
}
const operationsByCode = new Map(Object.entries(operationCodes).map(([name, code]) => [code, name as Operation]))
const sourceCodes: Record<SourceKind, number> = { A: 0, B: 1, RAM: 2 }
const destinationCodes: Record<DestinationKind, number> = { A: 0, B: 1, RAM: 2, OUT: 3 }
const byte = (value: number) => value & 0xff
const blankRam = () => Array(256).fill(0) as number[]

export function formatByte(value: number) {
  return `${byte(value).toString(16).toUpperCase().padStart(2, '0')}h`
}

export const DEMO_RAM_INITIAL: RamInitialValue[] = [
  { address: 0x80, value: 11 },
  { address: 0x81, value: 4 },
  { address: 0x82, value: 3 },
]

export const DEMO_INSTRUCTIONS: InstructionConfig[] = [
  { id: 1, operation: 'ADD', left: { kind: 'RAM', address: 0x80 }, right: { kind: 'RAM', address: 0x81 }, destination: { kind: 'A', address: null } },
  { id: 2, operation: 'SUB', left: { kind: 'A', address: null }, right: { kind: 'RAM', address: 0x81 }, destination: { kind: 'B', address: null } },
  { id: 3, operation: 'MULT', left: { kind: 'B', address: null }, right: { kind: 'RAM', address: 0x82 }, destination: { kind: 'A', address: null } },
  { id: 4, operation: 'DIV', left: { kind: 'A', address: null }, right: { kind: 'RAM', address: 0x82 }, destination: { kind: 'B', address: null } },
  { id: 5, operation: 'AND', left: { kind: 'A', address: null }, right: { kind: 'B', address: null }, destination: { kind: 'A', address: null } },
  { id: 6, operation: 'OR', left: { kind: 'A', address: null }, right: { kind: 'B', address: null }, destination: { kind: 'B', address: null } },
  { id: 7, operation: 'XOR', left: { kind: 'A', address: null }, right: { kind: 'B', address: null }, destination: { kind: 'OUT', address: null } },
  { id: 8, operation: 'ADD', left: { kind: 'RAM', address: 0x80 }, right: { kind: 'RAM', address: 0x81 }, destination: { kind: 'OUT', address: null } },
  { id: 9, operation: 'HLT', left: { kind: 'A', address: null }, right: { kind: 'A', address: null }, destination: { kind: 'OUT', address: null } },
]

export function encodeInstructions(instructions: InstructionConfig[]) {
  if (!instructions.length) throw new Error('Add at least one instruction before loading the program.')
  const bytes: number[] = []
  for (const [index, instruction] of instructions.entries()) {
    const operation = operationCodes[instruction.operation]
    if (operation === undefined) throw new Error(`Instruction ${index + 1} has an unknown operation.`)
    if (instruction.operation === 'HLT') {
      bytes.push(operation, 0, 0, 0, 0, 0, 0)
      continue
    }
    const sourceByte = (source: SourceConfig, field: string) => {
      if (!(source.kind in sourceCodes)) throw new Error(`Instruction ${index + 1}: choose a valid ${field} source.`)
      if (source.kind === 'RAM' && (!Number.isInteger(source.address) || source.address === null || source.address < 0 || source.address > 255)) {
        throw new Error(`Instruction ${index + 1}: ${field} RAM address must be 0–255.`)
      }
      return [sourceCodes[source.kind], source.kind === 'RAM' ? source.address! : 0]
    }
    const destination = instruction.destination
    if (!(destination.kind in destinationCodes)) throw new Error(`Instruction ${index + 1}: choose a valid destination.`)
    if (destination.kind === 'RAM' && (!Number.isInteger(destination.address) || destination.address === null || destination.address < 0 || destination.address > 255)) {
      throw new Error(`Instruction ${index + 1}: destination RAM address must be 0–255.`)
    }
    bytes.push(operation, ...sourceByte(instruction.left, 'first operand'), ...sourceByte(instruction.right, 'second operand'), destinationCodes[destination.kind], destination.kind === 'RAM' ? destination.address! : 0)
  }
  if (bytes.length > 256) throw new Error('The program exceeds the 256-byte RAM capacity. Remove instructions to continue.')
  return bytes
}

const demoBytes = encodeInstructions(DEMO_INSTRUCTIONS)

export function initialCpuState(programBytes = demoBytes, initialRam = DEMO_RAM_INITIAL): CpuState {
  const memory = blankRam()
  programBytes.forEach((value, address) => { memory[address] = byte(value) })
  for (const entry of initialRam) if (entry.address !== null && entry.value !== null) memory[entry.address] = byte(entry.value)
  return {
    pc: 0, mar: 0, mdr: 0, ir: 0, a: 0, b: 0, operand1: 0, operand2: 0, aluA: 0, aluB: 0,
    aluResult: 0, zRegister: 0, output: 0, zero: false, negative: false, carry: false,
    halted: false, cycles: 0, completedInstructions: 0, instructionAddress: 0,
    microstep: 'fetch-address', instructionName: '—', instructionFields: [], fieldIndex: 0,
    leftSource: null, rightSource: null, destination: null, memory, programBytes: [...programBytes],
    initialRam: initialRam.filter((entry): entry is { address: number; value: number } => entry.address !== null && entry.value !== null).map((entry) => ({ ...entry })),
    activePaths: [], activeSignals: [], lastEvent: 'Ready. Step the clock to fetch the first instruction.', cycleLog: [],
  }
}

export function resetCpu(state?: CpuState) {
  return state ? initialCpuState(state.programBytes, state.initialRam) : initialCpuState()
}

export function loadConfiguredProgram(state: CpuState, instructions: InstructionConfig[], ramValues: RamInitialValue[]) {
  try {
    const bytes = encodeInstructions(instructions)
    const initialRam: Array<{ address: number; value: number }> = []
    const seen = new Set<number>()
    for (const [index, entry] of ramValues.entries()) {
      if (!Number.isInteger(entry.address) || entry.address === null || entry.address < 0 || entry.address > 255) throw new Error(`RAM value ${index + 1}: address must be 0–255.`)
      if (!Number.isInteger(entry.value) || entry.value === null || entry.value < 0 || entry.value > 255) throw new Error(`RAM value ${index + 1}: byte value must be 0–255.`)
      if (entry.address < bytes.length) throw new Error(`RAM[${formatByte(entry.address)}] overlaps the ${bytes.length}-byte program. Choose an address from ${formatByte(bytes.length)} to FFh.`)
      if (seen.has(entry.address)) throw new Error(`RAM address ${formatByte(entry.address)} is listed more than once.`)
      seen.add(entry.address)
      initialRam.push({ address: entry.address, value: entry.value })
    }
    const next = initialCpuState(bytes, initialRam)
    next.lastEvent = `${instructions.length} instruction${instructions.length === 1 ? '' : 's'} loaded (${bytes.length} bytes). Ready at PC 00h.`
    return { state: next, error: '' }
  } catch (error) {
    return { state: { ...state, lastEvent: 'Program was not loaded. Correct the configuration below and try again.' }, error: error instanceof Error ? error.message : 'Program configuration is invalid.' }
  }
}

const phaseLabels: Record<Microstep, string> = {
  'fetch-address': 'Fetch · PC → MAR', 'fetch-opcode': 'Fetch · RAM → MDR', 'load-ir': 'Fetch · MDR → IR', decode: 'Decode · IR → control unit',
  'field-address': 'Decode fields · PC → MAR', 'field-read': 'Decode fields · RAM → MDR', 'field-load': 'Decode fields · MDR → instruction registers', 'halt-instruction': 'Halt instruction',
  'source1-register': 'Read operand 1 · register → operand latch', 'source1-address': 'Read operand 1 · address → MAR', 'source1-read': 'Read operand 1 · RAM → MDR', 'source1-load': 'Read operand 1 · MDR → operand latch',
  'source2-register': 'Read operand 2 · register → operand latch', 'source2-address': 'Read operand 2 · address → MAR', 'source2-read': 'Read operand 2 · RAM → MDR', 'source2-load': 'Read operand 2 · MDR → operand latch',
  'alu-load-a': 'ALU input · operand 1 → ALU A', 'alu-load-b': 'ALU input · operand 2 → ALU B',
  'alu-execute': 'Execute · ALU operation', 'alu-result': 'Write result · ALU → Z', 'destination-writeback': 'Write result · Z → destination',
  'destination-address': 'Write result · destination address → MAR', 'destination-data': 'Write result · Z → MDR', 'destination-store': 'Write result · MDR → RAM', halted: 'Processor halted',
}

export function microstepLabel(step: Microstep) { return phaseLabels[step] }

function finishInstruction(state: CpuState) {
  return { ...state, microstep: 'fetch-address' as const, completedInstructions: state.completedInstructions + 1, instructionFields: [], fieldIndex: 0 }
}

function sourceFromFields(kind: number, address: number): SourceConfig | null {
  if (kind === 0) return { kind: 'A', address: null }
  if (kind === 1) return { kind: 'B', address: null }
  if (kind === 2) return { kind: 'RAM', address }
  return null
}

function nextSourceStep(source: SourceConfig | null, which: 1 | 2): Microstep {
  if (!source) return 'halted'
  return source.kind === 'RAM' ? `source${which}-address` : `source${which}-register`
}

function arithmetic(operation: Operation, left: number, right: number) {
  let raw: number
  let carry: boolean
  switch (operation) {
    case 'ADD': raw = left + right; carry = raw > 0xff; break
    case 'SUB': raw = left - right; carry = left >= right; break
    case 'MULT': raw = left * right; carry = raw > 0xff; break
    case 'DIV': raw = right === 0 ? 0 : Math.floor(left / right); carry = right === 0; break
    case 'AND': raw = left & right; carry = false; break
    case 'OR': raw = left | right; carry = false; break
    case 'XOR': raw = left ^ right; carry = false; break
    default: raw = 0; carry = false
  }
  const result = byte(raw)
  return { result, zero: result === 0, negative: (result & 0x80) !== 0, carry }
}

export function stepClock(state: CpuState): CpuState {
  if (state.halted || state.microstep === 'halted') return state
  const next: CpuState = { ...state, memory: [...state.memory], cycles: state.cycles + 1, activePaths: [], activeSignals: [] }
  const paths: string[] = ['clock-edge', 'cu-control']
  const signals: string[] = ['CU_STEP']
  let summary = ''
  const definition = operationsByCode.get(state.ir)
  const complete = () => Object.assign(next, finishInstruction(next))

  switch (state.microstep) {
    case 'fetch-address': {
      const address = state.pc
      next.instructionAddress = address
      next.mar = address
      next.pc = byte(address + 1)
      next.microstep = 'fetch-opcode'
      paths.push('pc-mar', 'pc-increment')
      signals.push('PC_OUT', 'MAR_IN', 'PC_INCREMENT', 'CLOCK_RISE')
      summary = `PC → MAR at ${formatByte(address)}; PC increments by one byte.`
      break
    }
    case 'fetch-opcode':
      next.mdr = state.memory[state.mar] ?? 0
      next.microstep = 'load-ir'
      paths.push('mar-ram', 'ram-mdr', 'ram-read')
      signals.push('MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN', 'CLOCK_RISE')
      summary = `RAM[${formatByte(state.mar)}] → MDR (${formatByte(next.mdr)}); memory read completed.`
      break
    case 'load-ir':
      next.ir = state.mdr
      next.instructionName = operationsByCode.get(state.mdr) ?? 'INVALID'
      next.microstep = 'decode'
      paths.push('mdr-ir')
      signals.push('MDR_OUT', 'IR_IN', 'CLOCK_RISE')
      summary = `MDR → IR (${formatByte(state.mdr)}); opcode is held for decoding.`
      break
    case 'decode':
      if (!definition) {
        next.halted = true; next.microstep = 'halted'
        signals.push('INVALID_OPCODE', 'CLOCK_RISE')
        summary = `Unknown opcode ${formatByte(state.ir)}; processor halted safely.`
      } else {
        next.instructionName = definition
        next.instructionFields = []
        next.fieldIndex = 0
        next.microstep = 'field-address'
        paths.push('ir-control')
        signals.push('IR_OUT', 'DECODE', `OP_${definition}`, 'CLOCK_RISE')
        summary = `Control unit decodes ${definition}; six configuration bytes will be fetched next.`
      }
      break
    case 'field-address': {
      const address = state.pc
      next.mar = address; next.pc = byte(address + 1); next.microstep = 'field-read'
      paths.push('pc-mar', 'pc-increment')
      signals.push('PC_OUT', 'MAR_IN', 'PC_INCREMENT', 'CLOCK_RISE')
      summary = `PC → MAR at ${formatByte(address)} to fetch instruction configuration byte ${state.fieldIndex + 1} of 6.`
      break
    }
    case 'field-read':
      next.mdr = state.memory[state.mar] ?? 0; next.microstep = 'field-load'
      paths.push('mar-ram', 'ram-mdr', 'ram-read')
      signals.push('MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN', 'CLOCK_RISE')
      summary = `RAM[${formatByte(state.mar)}] → MDR (${formatByte(next.mdr)}); configuration byte read completed.`
      break
    case 'field-load': {
      const fields = [...state.instructionFields, state.mdr]
      next.instructionFields = fields
      next.fieldIndex = fields.length
      paths.push('mdr-fields')
      signals.push('MDR_OUT', 'INSTRUCTION_FIELDS_IN', 'CLOCK_RISE')
      if (fields.length < 6) {
        next.microstep = 'field-address'
        summary = `MDR → instruction field ${fields.length} (${formatByte(state.mdr)}).`
      } else if (state.instructionName === 'HLT') {
        next.microstep = 'halt-instruction'
        summary = 'All HLT fields are read; the processor will stop on the next edge.'
      } else {
        const left = sourceFromFields(fields[0], fields[1])
        const right = sourceFromFields(fields[2], fields[3])
        const destKind = fields[4] === 0 ? 'A' : fields[4] === 1 ? 'B' : fields[4] === 2 ? 'RAM' : fields[4] === 3 ? 'OUT' : null
        if (!left || !right || !destKind) {
          next.halted = true; next.microstep = 'halted'
          signals.push('INVALID_CONFIGURATION')
          summary = 'Instruction source or destination code is invalid; processor halted safely.'
        } else {
          next.leftSource = left
          next.rightSource = right
          next.destination = { kind: destKind, address: destKind === 'RAM' ? fields[5] : null }
          next.microstep = nextSourceStep(left, 1)
          summary = `MDR → instruction field 6 (${formatByte(state.mdr)}); ${state.instructionName} sources and destination are ready.`
        }
      }
      break
    }
    case 'halt-instruction':
      next.halted = true; next.microstep = 'halted'; next.completedInstructions += 1
      signals.push('HALT', 'CLOCK_RISE')
      summary = 'HLT stops the processor. Reset to start again.'
      break
    case 'source1-register': {
      const source = state.leftSource!
      next.operand1 = source.kind === 'A' ? state.a : state.b
      next.microstep = nextSourceStep(state.rightSource, 2)
      paths.push(source.kind === 'A' ? 'a-operand1' : 'b-operand1')
      signals.push(`${source.kind}_OUT`, 'OPERAND1_IN', 'CLOCK_RISE')
      summary = `${source.kind} → operand 1 (${formatByte(next.operand1)}).`
      break
    }
    case 'source1-address':
      next.mar = state.leftSource!.address ?? 0; next.microstep = 'source1-read'
      paths.push('source1-address-mar')
      signals.push('SOURCE1_ADDRESS_OUT', 'MAR_IN', 'CLOCK_RISE')
      summary = `Operand 1 RAM address ${formatByte(next.mar)} → MAR.`
      break
    case 'source1-read':
      next.mdr = state.memory[state.mar] ?? 0; next.microstep = 'source1-load'
      paths.push('mar-ram', 'ram-mdr', 'ram-read')
      signals.push('MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN', 'CLOCK_RISE')
      summary = `RAM[${formatByte(state.mar)}] → MDR (${formatByte(next.mdr)}); operand 1 read completed.`
      break
    case 'source1-load':
      next.operand1 = state.mdr; next.microstep = nextSourceStep(state.rightSource, 2)
      paths.push('mdr-operand1')
      signals.push('MDR_OUT', 'OPERAND1_IN', 'CLOCK_RISE')
      summary = `MDR → operand 1 (${formatByte(state.mdr)}).`
      break
    case 'source2-register': {
      const source = state.rightSource!
      next.operand2 = source.kind === 'A' ? state.a : state.b
      next.microstep = 'alu-load-a'
      paths.push(source.kind === 'A' ? 'a-operand2' : 'b-operand2')
      signals.push(`${source.kind}_OUT`, 'OPERAND2_IN', 'CLOCK_RISE')
      summary = `${source.kind} → operand 2 (${formatByte(next.operand2)}).`
      break
    }
    case 'source2-address':
      next.mar = state.rightSource!.address ?? 0; next.microstep = 'source2-read'
      paths.push('source2-address-mar')
      signals.push('SOURCE2_ADDRESS_OUT', 'MAR_IN', 'CLOCK_RISE')
      summary = `Operand 2 RAM address ${formatByte(next.mar)} → MAR.`
      break
    case 'source2-read':
      next.mdr = state.memory[state.mar] ?? 0; next.microstep = 'source2-load'
      paths.push('mar-ram', 'ram-mdr', 'ram-read')
      signals.push('MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN', 'CLOCK_RISE')
      summary = `RAM[${formatByte(state.mar)}] → MDR (${formatByte(next.mdr)}); operand 2 read completed.`
      break
    case 'source2-load':
      next.operand2 = state.mdr; next.microstep = 'alu-load-a'
      paths.push('mdr-operand2')
      signals.push('MDR_OUT', 'OPERAND2_IN', 'CLOCK_RISE')
      summary = `MDR → operand 2 (${formatByte(state.mdr)}).`
      break
    case 'alu-load-a':
      next.aluA = state.operand1; next.microstep = 'alu-load-b'
      paths.push('operand1-alu')
      signals.push('OPERAND1_OUT', 'ALU_A_IN', 'CLOCK_RISE')
      summary = `Operand 1 (${formatByte(state.operand1)}) → ALU input A.`
      break
    case 'alu-load-b':
      next.aluB = state.operand2; next.microstep = 'alu-execute'
      paths.push('operand2-alu')
      signals.push('OPERAND2_OUT', 'ALU_B_IN', 'CLOCK_RISE')
      summary = `Operand 2 (${formatByte(state.operand2)}) → ALU input B.`
      break
    case 'alu-execute': {
      const flags = arithmetic(state.instructionName as Operation, state.aluA, state.aluB)
      next.aluResult = flags.result; next.zero = flags.zero; next.negative = flags.negative; next.carry = flags.carry
      next.microstep = 'alu-result'
      paths.push('alu-flags')
      signals.push(`ALU_${state.instructionName}`, 'FLAGS_IN', 'CLOCK_RISE')
      summary = state.instructionName === 'DIV' && state.aluB === 0
        ? 'DIV by zero produces 00h; Carry is set and writeback continues.'
        : `ALU computes ${formatByte(state.aluA)} ${state.instructionName} ${formatByte(state.aluB)} = ${formatByte(flags.result)}; flags updated.`
      break
    }
    case 'alu-result':
      next.zRegister = state.aluResult
      next.microstep = state.destination?.kind === 'RAM' ? 'destination-address' : 'destination-writeback'
      paths.push('alu-z')
      signals.push('ALU_OUT', 'Z_IN', 'CLOCK_RISE')
      summary = `ALU result ${formatByte(state.aluResult)} → Z result register.`
      break
    case 'destination-writeback': {
      const destination = state.destination!
      if (destination.kind === 'A') paths.push('z-a')
      if (destination.kind === 'B') paths.push('z-b')
      if (destination.kind === 'OUT') paths.push('z-output')
      if (destination.kind === 'A') next.a = state.zRegister
      if (destination.kind === 'B') next.b = state.zRegister
      if (destination.kind === 'OUT') next.output = state.zRegister
      signals.push('Z_OUT', `${destination.kind}_IN`, 'INSTRUCTION_DONE', 'CLOCK_RISE')
      summary = `Z (${formatByte(state.zRegister)}) → ${destination.kind === 'OUT' ? 'output register' : `Register ${destination.kind}`}.`
      complete()
      break
    }
    case 'destination-address':
      next.mar = state.destination?.address ?? 0; next.microstep = 'destination-data'
      paths.push('destination-address-mar')
      signals.push('DESTINATION_ADDRESS_OUT', 'MAR_IN', 'CLOCK_RISE')
      summary = `Destination RAM address ${formatByte(next.mar)} → MAR.`
      break
    case 'destination-data':
      next.mdr = state.zRegister; next.microstep = 'destination-store'
      paths.push('z-mdr')
      signals.push('Z_OUT', 'MDR_IN', 'CLOCK_RISE')
      summary = `Z (${formatByte(state.zRegister)}) → MDR for the RAM write.`
      break
    case 'destination-store':
      next.memory[state.mar] = state.mdr
      paths.push('mar-ram', 'mdr-ram', 'ram-write')
      signals.push('MAR_OUT', 'MDR_OUT', 'MEM_WRITE', 'CLOCK_RISE')
      summary = `MDR (${formatByte(state.mdr)}) → RAM[${formatByte(state.mar)}]; write completed.`
      complete()
      break
  }

  next.activePaths = paths
  next.activeSignals = signals
  next.lastEvent = summary
  next.cycleLog = [...state.cycleLog, {
    id: state.cycleLog.length + 1,
    cycle: next.cycles,
    phase: phaseLabels[state.microstep],
    summary,
    paths: [...paths],
    signals: [...signals],
  }].slice(-240)
  return next
}
