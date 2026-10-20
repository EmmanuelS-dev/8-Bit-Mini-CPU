export type Microstep =
  | 'fetch-address' | 'fetch-opcode' | 'load-ir' | 'decode'
  | 'operand-address' | 'fetch-operand' | 'load-operand' | 'execute'
  | 'ldi-writeback' | 'data-address' | 'data-read' | 'data-writeback'
  | 'store-data' | 'store-memory' | 'alu-a' | 'alu-b' | 'alu-execute'
  | 'alu-result' | 'alu-writeback' | 'output' | 'branch' | 'halted'

export type StepMode = 'Manual' | 'Automatic' | 'Input'

export type CycleRecord = {
  id: number
  cycle: number
  mode: StepMode
  microstep: string
  summary: string
  paths: string[]
  signals: string[]
}

export type CpuState = {
  pc: number
  mar: number
  mdr: number
  ir: number
  operand: number
  a: number
  b: number
  aluA: number
  aluB: number
  aluResult: number
  zRegister: number
  output: number
  zero: boolean
  carry: boolean
  halted: boolean
  cycles: number
  completedInstructions: number
  instructionAddress: number
  microstep: Microstep
  instructionName: string
  memory: number[]
  programLength: number
  activePaths: string[]
  activeSignals: string[]
  lastEvent: string
  cycleLog: CycleRecord[]
}

export type InstructionDefinition = {
  opcode: number
  mnemonic: string
  description: string
  operand: 'value' | 'address' | 'none'
}

export const instructionSet: InstructionDefinition[] = [
  { opcode: 0x00, mnemonic: 'NOP', description: 'No operation.', operand: 'none' },
  { opcode: 0x10, mnemonic: 'LDI A', description: 'Load the 8-bit immediate byte into register A.', operand: 'value' },
  { opcode: 0x11, mnemonic: 'LDI B', description: 'Load the 8-bit immediate byte into register B.', operand: 'value' },
  { opcode: 0x20, mnemonic: 'LDA', description: 'Load A from the 8-bit RAM address.', operand: 'address' },
  { opcode: 0x21, mnemonic: 'LDB', description: 'Load B from the 8-bit RAM address.', operand: 'address' },
  { opcode: 0x30, mnemonic: 'ADD', description: 'Add B to A; store the low byte in A and update Zero and Carry.', operand: 'none' },
  { opcode: 0x31, mnemonic: 'SUB', description: 'Subtract B from A; store the low byte in A and update Zero and no-borrow Carry.', operand: 'none' },
  { opcode: 0x40, mnemonic: 'STA', description: 'Store A at the 8-bit RAM address.', operand: 'address' },
  { opcode: 0x41, mnemonic: 'STB', description: 'Store B at the 8-bit RAM address.', operand: 'address' },
  { opcode: 0x50, mnemonic: 'OUT', description: 'Copy A to the output register.', operand: 'none' },
  { opcode: 0x60, mnemonic: 'JMP', description: 'Jump to the 8-bit address.', operand: 'address' },
  { opcode: 0x61, mnemonic: 'JZ', description: 'Jump to the 8-bit address if Zero is set.', operand: 'address' },
  { opcode: 0xff, mnemonic: 'HLT', description: 'Stop the processor.', operand: 'none' },
]

const instructionByOpcode = new Map(instructionSet.map((instruction) => [instruction.opcode, instruction]))
const byte = (value: number) => value & 0xff
const blankRam = () => Array(256).fill(0) as number[]
const demoBytes = [0x10, 0x0b, 0x11, 0x04, 0x30, 0x00, 0x50, 0x00, 0xff, 0x00]

export const demoProgram = [...demoBytes]
export const demoProgramText = demoBytes.map((value) => value.toString(16).toUpperCase().padStart(2, '0')).join(' ')

export function getInstruction(opcode: number) {
  return instructionByOpcode.get(byte(opcode)) ?? { opcode: byte(opcode), mnemonic: 'INVALID', description: 'Unknown opcode. The processor will halt safely.', operand: 'none' as const }
}

export function formatByte(value: number) {
  return `${byte(value).toString(16).toUpperCase().padStart(2, '0')}h`
}

export function initialCpuState(): CpuState {
  const memory = blankRam()
  demoBytes.forEach((value, address) => { memory[address] = value })
  return {
    pc: 0, mar: 0, mdr: 0, ir: 0, operand: 0, a: 0, b: 0,
    aluA: 0, aluB: 0, aluResult: 0, zRegister: 0, output: 0,
    zero: false, carry: false, halted: false, cycles: 0, completedInstructions: 0,
    instructionAddress: 0, microstep: 'fetch-address', instructionName: '—', memory, programLength: demoBytes.length,
    activePaths: [], activeSignals: [], lastEvent: 'Ready. Step the clock to begin fetching the sample program.', cycleLog: [],
  }
}

export function resetCpu(_state?: CpuState): CpuState {
  return initialCpuState()
}

const labels: Record<Microstep, string> = {
  'fetch-address': 'Fetch · PC to MAR',
  'fetch-opcode': 'Fetch · memory read to MDR',
  'load-ir': 'Fetch · MDR to IR',
  decode: 'Decode instruction',
  'operand-address': 'Fetch operand · PC to MAR',
  'fetch-operand': 'Fetch operand · memory read to MDR',
  'load-operand': 'Fetch operand · MDR to operand register',
  execute: 'Execute instruction',
  'ldi-writeback': 'Immediate · operand to register',
  'data-address': 'Memory access · operand to MAR',
  'data-read': 'Memory access · RAM to MDR',
  'data-writeback': 'Memory access · MDR to register',
  'store-data': 'Memory access · register to MDR',
  'store-memory': 'Memory access · MDR to RAM',
  'alu-a': 'ALU input · A to ALU',
  'alu-b': 'ALU input · B to ALU',
  'alu-execute': 'ALU operation',
  'alu-result': 'ALU result to Z',
  'alu-writeback': 'Writeback · Z to A',
  output: 'Output · A to output register',
  branch: 'Branch decision',
  halted: 'Processor halted',
}

export function microstepLabel(step: Microstep) {
  return labels[step]
}

function finishInstruction(state: CpuState): CpuState {
  return { ...state, microstep: 'fetch-address', completedInstructions: state.completedInstructions + 1 }
}

export function stepClock(state: CpuState, mode: StepMode = 'Manual'): CpuState {
  if (state.halted || state.microstep === 'halted') return state

  const next: CpuState = { ...state, memory: [...state.memory], cycles: state.cycles + 1, activePaths: [], activeSignals: [] }
  const opcode = next.ir
  const definition = getInstruction(opcode)
  const paths: string[] = []
  let signals: string[] = []
  let summary = ''
  const complete = () => Object.assign(next, finishInstruction(next))

  switch (state.microstep) {
    case 'fetch-address': {
      const address = state.pc
      next.instructionAddress = address
      next.mar = address
      next.pc = byte(address + 1)
      next.microstep = 'fetch-opcode'
      paths.push('pc-mar', 'pc-increment')
      signals = ['PC_OUT', 'MAR_IN', 'PC_INCREMENT']
      summary = `PC (${formatByte(address)}) drives the internal bus; MAR captures the opcode address while PC advances by one byte.`
      break
    }
    case 'fetch-opcode':
      next.mdr = state.memory[state.mar] ?? 0
      next.microstep = 'load-ir'
      paths.push('mar-ram', 'ram-mdr')
      signals = ['MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN']
      summary = `RAM[${formatByte(state.mar)}] returns opcode ${formatByte(next.mdr)} to MDR; WMFC confirms the read.`
      break
    case 'load-ir':
      next.ir = state.mdr
      next.instructionName = getInstruction(state.mdr).mnemonic
      next.microstep = 'decode'
      paths.push('mdr-ir')
      signals = ['MDR_OUT', 'IR_IN']
      summary = `MDR transfers ${formatByte(state.mdr)} into IR.`
      break
    case 'decode':
      next.instructionName = definition.mnemonic
      next.microstep = 'operand-address'
      signals = ['IR_OUT', 'DECODE', `OP_${definition.mnemonic.replaceAll(' ', '_')}`]
      summary = `Decoder identifies ${definition.mnemonic}: ${definition.description}`
      break
    case 'operand-address': {
      const address = state.pc
      next.mar = address
      next.pc = byte(address + 1)
      next.microstep = 'fetch-operand'
      paths.push('pc-mar', 'pc-increment')
      signals = ['PC_OUT', 'MAR_IN', 'PC_INCREMENT']
      summary = `PC places the second instruction byte address ${formatByte(address)} in MAR and advances by one.`
      break
    }
    case 'fetch-operand':
      next.mdr = state.memory[state.mar] ?? 0
      next.microstep = 'load-operand'
      paths.push('mar-ram', 'ram-mdr')
      signals = ['MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN']
      summary = `RAM[${formatByte(state.mar)}] returns operand ${formatByte(next.mdr)} to MDR.`
      break
    case 'load-operand':
      next.operand = state.mdr
      next.microstep = 'execute'
      paths.push('mdr-operand')
      signals = ['MDR_OUT', 'OPERAND_IN']
      summary = `MDR transfers ${formatByte(state.mdr)} into the operand register.`
      break
    case 'execute':
      switch (definition.mnemonic) {
        case 'NOP':
          signals = ['NOP', 'INSTRUCTION_DONE']
          summary = 'NOP completes without changing a data register.'
          complete()
          break
        case 'LDI A':
        case 'LDI B':
          next.microstep = 'ldi-writeback'
          signals = ['OPERAND_SELECT', definition.mnemonic === 'LDI A' ? 'A_IN' : 'B_IN']
          summary = `The decoder selects the operand byte ${formatByte(state.operand)} as the ${definition.mnemonic.endsWith('A') ? 'A' : 'B'} input.`
          break
        case 'LDA': case 'LDB': case 'STA': case 'STB':
          next.microstep = 'data-address'
          signals = ['OPERAND_OUT', 'MAR_IN']
          summary = `The operand ${formatByte(state.operand)} is selected as the RAM address.`
          break
        case 'ADD': case 'SUB':
          next.microstep = 'alu-a'
          signals = ['ALU_SELECT', `ALU_${definition.mnemonic}`]
          summary = `${definition.mnemonic} is decoded. A and B will be placed on the shared bus in separate clock edges.`
          break
        case 'OUT':
          next.microstep = 'output'
          signals = ['A_OUT', 'OUTPUT_IN']
          summary = 'A is selected for transfer to the output register.'
          break
        case 'JMP': case 'JZ':
          next.microstep = 'branch'
          signals = ['BRANCH_TEST', ...(definition.mnemonic === 'JZ' ? ['ZERO_TEST'] : [])]
          summary = definition.mnemonic === 'JMP' ? `Unconditional branch target is ${formatByte(state.operand)}.` : `Zero flag is ${state.zero ? 'set' : 'clear'}; conditional target is ${formatByte(state.operand)}.`
          break
        case 'HLT': case 'INVALID':
          next.halted = true
          next.microstep = 'halted'
          next.completedInstructions += 1
          signals = [definition.mnemonic === 'HLT' ? 'HALT' : 'INVALID_OPCODE']
          summary = definition.mnemonic === 'HLT' ? 'HLT stops the processor.' : `Opcode ${formatByte(state.ir)} is not defined; processor halted safely.`
          break
        default:
          next.halted = true
          next.microstep = 'halted'
          next.completedInstructions += 1
          signals = ['INVALID_OPCODE']
          summary = `Opcode ${formatByte(state.ir)} is not defined; processor halted safely.`
      }
      break
    case 'ldi-writeback':
      if (definition.mnemonic === 'LDI A') {
        next.a = state.operand
        next.zero = state.operand === 0
        paths.push('operand-a')
        signals = ['OPERAND_OUT', 'A_IN', 'FLAGS_IN']
        summary = `Operand ${formatByte(state.operand)} travels on the internal bus into A.`
      } else {
        next.b = state.operand
        paths.push('operand-b')
        signals = ['OPERAND_OUT', 'B_IN']
        summary = `Operand ${formatByte(state.operand)} travels on the internal bus into B.`
      }
      complete()
      break
    case 'data-address':
      next.mar = state.operand
      paths.push('operand-mar')
      signals = ['OPERAND_OUT', 'MAR_IN']
      if (definition.mnemonic === 'LDA' || definition.mnemonic === 'LDB') {
        next.microstep = 'data-read'
        summary = `Operand ${formatByte(state.operand)} is latched in MAR as the RAM read address.`
      } else {
        next.microstep = 'store-data'
        summary = `Operand ${formatByte(state.operand)} is latched in MAR as the RAM write address.`
      }
      break
    case 'data-read':
      next.mdr = state.memory[state.mar] ?? 0
      next.microstep = 'data-writeback'
      paths.push('mar-ram', 'ram-mdr')
      signals = ['MAR_OUT', 'MEM_READ', 'WMFC', 'MDR_IN']
      summary = `RAM[${formatByte(state.mar)}] returns ${formatByte(next.mdr)} to MDR.`
      break
    case 'data-writeback':
      if (definition.mnemonic === 'LDA') {
        next.a = state.mdr
        next.zero = state.mdr === 0
        paths.push('mdr-a')
        signals = ['MDR_OUT', 'A_IN', 'FLAGS_IN']
        summary = `MDR transfers ${formatByte(state.mdr)} into A.`
      } else {
        next.b = state.mdr
        paths.push('mdr-b')
        signals = ['MDR_OUT', 'B_IN']
        summary = `MDR transfers ${formatByte(state.mdr)} into B.`
      }
      complete()
      break
    case 'store-data':
      if (definition.mnemonic === 'STA') {
        next.mdr = state.a
        paths.push('a-mdr')
        signals = ['A_OUT', 'MDR_IN']
        summary = `A (${formatByte(state.a)}) transfers to MDR for the RAM write.`
      } else {
        next.mdr = state.b
        paths.push('b-mdr')
        signals = ['B_OUT', 'MDR_IN']
        summary = `B (${formatByte(state.b)}) transfers to MDR for the RAM write.`
      }
      next.microstep = 'store-memory'
      break
    case 'store-memory':
      next.memory[state.mar] = state.mdr
      paths.push('mar-ram', 'mdr-ram')
      signals = ['MAR_OUT', 'MDR_OUT', 'MEM_WRITE']
      summary = `MDR writes ${formatByte(state.mdr)} to RAM[${formatByte(state.mar)}].`
      complete()
      break
    case 'alu-a':
      next.aluA = state.a
      next.microstep = 'alu-b'
      paths.push('a-alu')
      signals = ['A_OUT', 'ALU_A_IN']
      summary = `A (${formatByte(state.a)}) drives the shared bus into ALU input A.`
      break
    case 'alu-b':
      next.aluB = state.b
      next.microstep = 'alu-execute'
      paths.push('b-alu')
      signals = ['B_OUT', 'ALU_B_IN']
      summary = `B (${formatByte(state.b)}) drives the shared bus into ALU input B.`
      break
    case 'alu-execute': {
      const result = definition.mnemonic === 'ADD' ? state.aluA + state.aluB : state.aluA - state.aluB
      next.aluResult = byte(result)
      next.zero = byte(result) === 0
      next.carry = definition.mnemonic === 'ADD' ? result > 0xff : state.aluA >= state.aluB
      next.microstep = 'alu-result'
      signals = [`ALU_${definition.mnemonic}`, 'FLAGS_IN']
      summary = `ALU computes ${formatByte(state.aluA)} ${definition.mnemonic === 'ADD' ? '+' : '−'} ${formatByte(state.aluB)} = ${formatByte(result)}; flags are updated.`
      break
    }
    case 'alu-result':
      next.zRegister = state.aluResult
      next.microstep = 'alu-writeback'
      paths.push('alu-z')
      signals = ['ALU_OUT', 'Z_IN']
      summary = `ALU result ${formatByte(state.aluResult)} transfers over the bus into result register Z.`
      break
    case 'alu-writeback':
      next.a = state.zRegister
      next.microstep = 'fetch-address'
      next.completedInstructions += 1
      paths.push('z-a')
      signals = ['Z_OUT', 'A_IN', 'INSTRUCTION_DONE']
      summary = `Z transfers ${formatByte(state.zRegister)} to A; instruction complete.`
      break
    case 'output':
      next.output = state.a
      signals = ['A_OUT', 'OUTPUT_IN', 'INSTRUCTION_DONE']
      paths.push('a-output')
      summary = `A transfers ${formatByte(state.a)} to the output register.`
      complete()
      break
    case 'branch': {
      const taken = definition.mnemonic === 'JMP' || (definition.mnemonic === 'JZ' && state.zero)
      signals = [definition.mnemonic === 'JMP' ? 'JUMP' : 'ZERO_TEST', ...(taken ? ['PC_IN'] : ['BRANCH_NOT_TAKEN'])]
      if (taken) {
        next.pc = state.operand
        paths.push('operand-pc')
        summary = `${definition.mnemonic} transfers ${formatByte(state.operand)} to PC.`
      } else {
        summary = `JZ not taken; Zero is clear and PC remains ${formatByte(state.pc)}.`
      }
      complete()
      break
    }
  }

  next.activePaths = paths
  next.activeSignals = signals
  next.lastEvent = `Clock ${next.cycles} · ${labels[state.microstep]}. ${summary}`
  next.cycleLog = [...state.cycleLog, {
    id: state.cycleLog.length + 1,
    cycle: next.cycles,
    mode,
    microstep: labels[state.microstep],
    summary: next.lastEvent,
    paths: [...paths],
    signals: [...signals],
  }].slice(-200)
  return next
}

export function stepInstruction(state: CpuState, mode: StepMode = 'Automatic'): CpuState {
  if (state.halted) return state
  const completed = state.completedInstructions
  let next = state
  let attempts = 0
  while (!next.halted && next.completedInstructions === completed && attempts < 20) {
    next = stepClock(next, mode)
    attempts += 1
  }
  return next
}

export function installProgram(state: CpuState, source: string): CpuState {
  const tokens = source.split(/[\s,;]+/).filter(Boolean).map((part) => part.replace(/^0x/i, ''))
  const valid = tokens.every((token) => /^[0-9a-f]{1,2}$/i.test(token))
  const values = tokens.map((part) => Number.parseInt(part, 16))
  if (!valid || values.length === 0 || values.length > 256 || values.length % 2 !== 0) {
    return { ...state, lastEvent: 'Program not loaded. Enter an even number of 1–2 digit hex bytes (maximum 256 bytes); each instruction uses two bytes.' }
  }
  const memory = blankRam()
  values.forEach((value, index) => { memory[index] = value })
  const next = initialCpuState()
  next.memory = memory
  next.programLength = values.length
  next.lastEvent = `${values.length / 2} instruction${values.length === 2 ? '' : 's'} loaded at address 00.`
  next.cycleLog = [...state.cycleLog, {
    id: state.cycleLog.length + 1, cycle: 0, mode: 'Input' as const, microstep: 'Program loader',
    summary: next.lastEvent, paths: [], signals: [],
  }].slice(-200)
  return next
}
