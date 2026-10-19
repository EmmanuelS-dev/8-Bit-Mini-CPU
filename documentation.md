# 8-Bit CPU Lab — Technical Documentation

## Purpose

This browser application demonstrates the 8-bit datapath described in `8BIT_MINI_CPU.circ`. The reference circuit calls out four stages: instruction fetch (`PC → MAR → RAM → MDR → IR`), instruction decode, an arithmetic datapath with accumulator A and register B, and external control signals.

The circuit does not provide an instruction set or a control unit. The automatic mode supplies a small teaching control unit and instruction set so a user can run programs. The manual mode exposes data inputs and control signals directly. Both modes update the same CPU state and memory.

## Architecture

| Component | Width | Role |
| --- | ---: | --- |
| PC | 8 bits | Address of the next instruction; wraps from FF to 00. |
| MAR | 8 bits | Address presented to RAM. |
| RAM | 256 × 8 bits | Stores program bytes and data. |
| MDR | 8 bits | Byte read from RAM or loaded on the manual data input. |
| IR | 8 bits | Current instruction byte. |
| A | 8 bits | Accumulator and primary ALU input/result. |
| B | 8 bits | Secondary ALU input. |
| Z | 1 bit | Set when a result or comparison is zero. |
| C | 1 bit | Addition carry; for subtraction, indicates no borrow. |

All byte writes are masked to eight bits. RAM addresses span `00` through `FF`.

## Instruction format

Each instruction is one byte: the high nibble selects the opcode and the low nibble is the operand. Immediate values and instruction operands are therefore in the range `0` to `15`. `LDA`, `LDB`, and `STA` use the operand as a zero-extended RAM address. `JMP` and `JZ` set the 8-bit PC to the operand address, so branches target `00` through `0F` in this version.

| Opcode | Mnemonic | Operation |
| ---: | --- | --- |
| 0 | NOP | No operation. |
| 1 | LDA | `A ← RAM[operand]`; updates Z. |
| 2 | LDB | `B ← RAM[operand]`. |
| 3 | ADD | `A ← A + B`; updates Z and C. |
| 4 | SUB | `A ← A − B`; updates Z and no-borrow C. |
| 5 | STA | `RAM[operand] ← A`. |
| 6 | LDIA | `A ← operand`; updates Z. |
| 7 | LDIB | `B ← operand`. |
| 8 | JMP | `PC ← operand`. |
| 9 | JZ | If Z is set, `PC ← operand`. |
| A | AND | `A ← A AND B`; updates Z and clears C. |
| B | OR | `A ← A OR B`; updates Z and clears C. |
| C | XOR | `A ← A XOR B`; updates Z and clears C. |
| D | NOT | `A ← NOT A` across eight bits; updates Z. |
| E | CMP | Set Z from `A − B`; A and B are unchanged. C indicates no borrow. |
| F | HLT | Stop automatic execution. |

Hex bytes are entered in program order, separated by spaces, commas, or line breaks. Loading a program clears RAM, writes the entered bytes starting at `00`, and resets the registers and PC. Values outside `00`–`FF` are rejected. The sample `61 72 31 53 F0` loads 1 and 2 into A and B, adds them, stores 3 at RAM address 3, and halts.

## Simulation modes

### Without control unit

The user selects control signals and input values, then presses **Apply clock edge**. Enabled actions occur on that edge:

- `PC → MAR` copies the current PC to MAR.
- `Operand → MAR` copies the 4-bit operand to MAR with zero extension.
- `Input address → MAR` copies the 8-bit RAM address input to MAR.
- `RAM read` copies `RAM[MAR]` to MDR.
- `RAM write` copies the RAM write data field to `RAM[MAR]`.
- `Load MDR input` copies RAM write data to MDR.
- `MDR → IR` copies MDR to IR.
- `Load register A` copies data input A to A, unless `ALU → A` is also selected.
- `ALU → A` computes A plus data input B, or A minus data input B when **ALU subtract** is selected.
- `Load register B` copies data input B to B.
- `Increment PC` increments PC by one.

When multiple signals are enabled, they are applied on the same edge in the order represented by the simulator. This is intended for teaching the data path; it does not model Logisim's gate delay or undefined/bus-contention states.

### With control unit

**Step instruction** fetches the byte at PC, increments PC, decodes the opcode, and performs the instruction. The same action updates fetch and execute state; the highlight shows every path used by that instruction. **Run** repeats this process at the selected interval and stops at HLT. **Reset** clears CPU registers and flags while preserving RAM.

## Datapath visualization

The SVG diagram follows the labeled fetch and arithmetic paths in the reference circuit. Signal paths used in the most recent clock or instruction action change to teal. The live panels display register values in hexadecimal, the current RAM byte at MAR, the decoded instruction, and Z/C flags. In the RAM inspector, address 00–0F are listed; the address/value editor displays and can write any of the 256 RAM cells. Manual mode can also place any 8-bit address in MAR via **Input address → MAR**.

## Implementation and hosting

- React 19 renders controls and CPU state.
- TypeScript implements the CPU as pure state transitions in `src/cpu.ts`.
- Vite serves the development app and creates a static build in `dist/`.
- No API, server, database, or account is required. CPU state is held in the browser tab and is not persisted after a reload.
- The visual theme uses DM Sans, DM Mono, and Playfair Display when Google Fonts are reachable, with system fallbacks for offline use.

## Model boundaries

This is a browser teaching model based on the circuit's named components and annotated data flow. It is not a gate-level simulator and does not parse or execute the Logisim XML. The original circuit does not specify the teaching ISA above. The automatic control unit executes one full instruction per step rather than exposing separate internal fetch/decode/execute microcycles. The 4-bit instruction operand constrains immediate values and automatic branch/data addresses even though RAM itself has 256 addresses. Manual mode can address all RAM locations through its 8-bit address input or the RAM editor.
