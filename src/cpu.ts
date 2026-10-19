export type CpuState = {
  pc: number
  mar: number
  mdr: number
  ir: number
  a: number
  b: number
  zero: boolean
  carry: boolean
  halted: boolean
  cycles: number
  memory: number[]
  activePaths: string[]
  lastEvent: string
  instructionName: string
}

export type ManualSignals = {
  pcIncrement: boolean
  marFromPc: boolean
  marFromOperand: boolean
  marFromInput: boolean
  ramRead: boolean
  ramWrite: boolean
  mdrLoad: boolean
  irLoad: boolean
  loadA: boolean
  loadB: boolean
  aFromAlu: boolean
  aluSubtract: boolean
  reset: boolean
}

export const instructionSet = [
  { opcode: 0x0, mnemonic: 'NOP', description: 'No operation' },
  { opcode: 0x1, mnemonic: 'LDA', description: 'Load A from RAM[operand]' },
  { opcode: 0x2, mnemonic: 'LDB', description: 'Load B from RAM[operand]' },
  { opcode: 0x3, mnemonic: 'ADD', description: 'A ← A + B' },
  { opcode: 0x4, mnemonic: 'SUB', description: 'A ← A − B' },
  { opcode: 0x5, mnemonic: 'STA', description: 'Store A in RAM[operand]' },
  { opcode: 0x6, mnemonic: 'LDIA', description: 'Load operand into A' },
  { opcode: 0x7, mnemonic: 'LDIB', description: 'Load operand into B' },
  { opcode: 0x8, mnemonic: 'JMP', description: 'Jump to operand address' },
  { opcode: 0x9, mnemonic: 'JZ', description: 'Jump when zero flag is set' },
  { opcode: 0xa, mnemonic: 'AND', description: 'A ← A AND B' },
  { opcode: 0xb, mnemonic: 'OR', description: 'A ← A OR B' },
  { opcode: 0xc, mnemonic: 'XOR', description: 'A ← A XOR B' },
  { opcode: 0xd, mnemonic: 'NOT', description: 'A ← NOT A' },
  { opcode: 0xe, mnemonic: 'CMP', description: 'Set zero from A − B' },
  { opcode: 0xf, mnemonic: 'HLT', description: 'Halt execution' },
] as const

export const demoProgram = [0x61, 0x72, 0x31, 0x53, 0xf0]
export function initialCpuState(): CpuState {
  const memory = Array(256).fill(0) as number[]
  demoProgram.forEach((value, address) => { memory[address] = value })
  memory[0x10] = 0x05
  memory[0x11] = 0x03
  return {
    pc: 0, mar: 0, mdr: 0, ir: 0, a: 0, b: 0,
    zero: false, carry: false, halted: false, cycles: 0,
    memory, activePaths: [], lastEvent: 'Ready. Load a program or begin with the sample.',
    instructionName: '—',
  }
}

const byte = (value: number) => value & 0xff
const hex = (value: number, digits = 2) => value.toString(16).toUpperCase().padStart(digits, '0')

export function resetCpu(state: CpuState): CpuState {
  return { ...initialCpuState(), memory: [...state.memory], lastEvent: 'Reset complete. Memory contents were preserved.' }
}

export function runInstruction(state: CpuState): CpuState {
  if (state.halted) return { ...state, activePaths: [], lastEvent: 'CPU is halted. Reset to continue.' }
  const next = { ...state, memory: [...state.memory], cycles: state.cycles + 1, halted: false }
  const address = next.pc
  const instruction = next.memory[address] ?? 0
  const opcode = instruction >> 4
  const operand = instruction & 0x0f
  const definition = instructionSet[opcode]
  next.mar = address
  next.mdr = instruction
  next.ir = instruction
  next.pc = byte(next.pc + 1)
  next.instructionName = definition.mnemonic
  next.activePaths = ['pc-mar', 'mar-ram', 'ram-mdr', 'mdr-ir']
  next.lastEvent = `Fetched ${hex(instruction)} at ${hex(address)}: ${definition.mnemonic}${opcode === 0 || opcode === 0xf ? '' : ` ${hex(operand, 1)}`}.`

  switch (opcode) {
    case 0x0:
      break
    case 0x1:
      next.mar = operand
      next.mdr = next.memory[operand]
      next.a = next.mdr
      next.zero = next.a === 0
      next.activePaths.push('operand-mar', 'mar-ram', 'ram-mdr', 'mdr-a')
      next.lastEvent += ` Loaded A from RAM[${hex(operand)}].`
      break
    case 0x2:
      next.mar = operand
      next.mdr = next.memory[operand]
      next.b = next.mdr
      next.activePaths.push('operand-mar', 'mar-ram', 'ram-mdr', 'mdr-b')
      next.lastEvent += ` Loaded B from RAM[${hex(operand)}].`
      break
    case 0x3: {
      const result = next.a + next.b
      next.a = byte(result)
      next.carry = result > 0xff
      next.zero = next.a === 0
      next.activePaths.push('a-alu', 'b-alu', 'alu-a')
      next.lastEvent += ` ALU result ${hex(next.a)}.`
      break
    }
    case 0x4:
      next.carry = next.a >= next.b
      next.a = byte(next.a - next.b)
      next.zero = next.a === 0
      next.activePaths.push('a-alu', 'b-alu', 'alu-a')
      next.lastEvent += ` ALU result ${hex(next.a)}.`
      break
    case 0x5:
      next.mar = operand
      next.memory[operand] = next.a
      next.activePaths.push('operand-mar', 'a-ram')
      next.lastEvent += ` Stored ${hex(next.a)} in RAM[${hex(operand)}].`
      break
    case 0x6:
      next.a = operand
      next.zero = next.a === 0
      next.activePaths.push('operand-a')
      next.lastEvent += ` Loaded immediate ${hex(operand, 1)} into A.`
      break
    case 0x7:
      next.b = operand
      next.activePaths.push('operand-b')
      next.lastEvent += ` Loaded immediate ${hex(operand, 1)} into B.`
      break
    case 0x8:
      next.pc = operand
      next.activePaths.push('operand-pc')
      next.lastEvent += ` PC set to ${hex(operand)}.`
      break
    case 0x9:
      if (next.zero) {
        next.pc = operand
        next.activePaths.push('operand-pc')
        next.lastEvent += ` Zero flag set; PC set to ${hex(operand)}.`
      } else {
        next.lastEvent += ' Zero flag clear; branch not taken.'
      }
      break
    case 0xa:
    case 0xb:
    case 0xc: {
      const result = opcode === 0xa ? next.a & next.b : opcode === 0xb ? next.a | next.b : next.a ^ next.b
      next.a = byte(result)
      next.zero = next.a === 0
      next.carry = false
      next.activePaths.push('a-alu', 'b-alu', 'alu-a')
      next.lastEvent += ` ALU result ${hex(next.a)}.`
      break
    }
    case 0xd:
      next.a = byte(~next.a)
      next.zero = next.a === 0
      next.activePaths.push('a-alu', 'alu-a')
      next.lastEvent += ` ALU result ${hex(next.a)}.`
      break
    case 0xe:
      next.zero = byte(next.a - next.b) === 0
      next.carry = next.a >= next.b
      next.activePaths.push('a-alu', 'b-alu', 'alu-flags')
      next.lastEvent += ` Compare complete; zero flag ${next.zero ? 'set' : 'clear'}.`
      break
    case 0xf:
      next.halted = true
      next.activePaths = ['pc-mar', 'mar-ram', 'ram-mdr', 'mdr-ir']
      next.lastEvent += ' CPU halted.'
      break
  }
  return next
}

export function applyManualSignals(
  state: CpuState,
  signals: ManualSignals,
  values: { dataA: number; dataB: number; operand: number; ramAddress: number; memoryValue: number },
): CpuState {
  if (signals.reset) return resetCpu(state)
  const next = { ...state, memory: [...state.memory], cycles: state.cycles + 1, activePaths: [] as string[] }
  const operand = values.operand & 0x0f
  const dataA = byte(values.dataA)
  const dataB = byte(values.dataB)
  const address = byte(values.ramAddress)
  const paths = next.activePaths
  if (signals.marFromPc) { next.mar = next.pc; paths.push('pc-mar') }
  if (signals.marFromOperand) { next.mar = operand; paths.push('operand-mar') }
  if (signals.marFromInput) { next.mar = address; paths.push('input-mar') }
  if (signals.ramRead) { next.mdr = next.memory[next.mar]; paths.push('mar-ram', 'ram-mdr') }
  if (signals.ramWrite) { next.memory[next.mar] = byte(values.memoryValue); paths.push('mdr-ram') }
  if (signals.mdrLoad) { next.mdr = byte(values.memoryValue); paths.push('input-mdr') }
  if (signals.irLoad) { next.ir = next.mdr; paths.push('mdr-ir') }
  if (signals.loadA) { next.a = signals.aFromAlu ? (signals.aluSubtract ? byte(next.a - dataB) : byte(next.a + dataB)) : dataA; next.zero = next.a === 0; paths.push(signals.aFromAlu ? 'a-alu' : 'input-a', ...(signals.aFromAlu ? ['b-alu', 'alu-a'] : [])) }
  if (signals.loadB) { next.b = dataB; paths.push('input-b') }
  if (signals.pcIncrement) { next.pc = byte(next.pc + 1); paths.push('pc-increment') }
  next.lastEvent = paths.length ? `Manual clock edge ${next.cycles}: ${paths.length} datapath signal${paths.length === 1 ? '' : 's'} applied.` : `Manual clock edge ${next.cycles}: no control signals asserted.`
  return next
}

export function installProgram(state: CpuState, source: string): CpuState {
  const tokens = source.split(/[\s,;]+/).filter(Boolean).map((part) => part.replace(/^0x/i, ''))
  const validBytes = tokens.every((token) => /^[0-9a-f]{1,2}$/i.test(token))
  const values = tokens.map((part) => Number.parseInt(part, 16))
  if (!values.length || !validBytes) {
    return { ...state, lastEvent: 'Program not loaded. Enter hexadecimal bytes from 00 to FF, separated by spaces or new lines.' }
  }
  const memory = Array(256).fill(0) as number[]
  values.slice(0, 256).forEach((value, index) => { memory[index] = value })
  return { ...initialCpuState(), memory, lastEvent: `${Math.min(values.length, 256)} byte${values.length === 1 ? '' : 's'} loaded at address 00.` }
}

export function hexByte(value: number) { return hex(value) }
