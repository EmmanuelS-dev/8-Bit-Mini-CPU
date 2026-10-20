# 8 Bit Mini CPU — Project Documentation

## Project scope

This React and TypeScript website is a browser-based teaching model of an 8-bit processor datapath. The supplied `8BIT_MINI_CPU.circ` remains an unmodified reference; the site neither edits nor loads the Logisim file. Processor state and the clocked transition function live in `src/cpu.ts`. Both the manual-clock and control-unit screens call that same transition function, so the diagram reflects the modeled state and micro-step.

The simulator demonstrates register transfers and instruction behavior. It is not a gate-level circuit simulator and does not model analog propagation delay, bus contention, interrupts, or a Logisim runtime.

## Architecture

| Component | Width | Purpose |
| --- | ---: | --- |
| PC | 8 bits | Address of the next instruction byte; wraps from `FFh` to `00h`. |
| MAR | 8 bits | Holds a RAM address for the external memory interface. |
| RAM | 256 × 8 bits | Stores program and data bytes at addresses `00h`–`FFh`. |
| MDR | 8 bits | Buffer for a byte read from or written to RAM. |
| IR | 8 bits | Holds the opcode byte currently being decoded. |
| Operand register | 8 bits | Holds the second byte of the fixed-width instruction. |
| A and B | 8 bits each | General registers and ALU inputs. |
| ALU | 8 bits | Performs ADD and SUB. The result wraps to eight bits. |
| Z result register | 8 bits | Holds an ALU result for the following writeback edge. |
| Output register | 8 bits | Captures A when the OUT instruction executes. |
| Zero / Carry flags | 1 bit each | Zero marks a zero result; Carry marks addition overflow or no borrow for subtraction. |
| Internal bus | 8 bits | Shared datapath between CPU registers, the ALU inputs, and result/writeback registers. One selected source drives it per edge. |

### Internal and external buses

The vertical bus in the diagram is the CPU’s single shared 8-bit internal bus. Its taps are shown as dots. A micro-step selects one source and one destination; register reads into the ALU and writes from the ALU result register happen on separate edges.

RAM is outside the internal bus. It has a separate 8-bit address connection from MAR, a bidirectional 8-bit data connection through MDR, and a control connection carrying read, write, and memory-complete activity. The diagram uses separate colors for the internal transfer, memory address/data, and control paths. The current micro-step’s routes are highlighted; other routes stay muted. Crossings without a bus tap are not connected.

## Instruction encoding

The previous prototype placed a 4-bit operand inside an opcode byte while also displaying an 8-bit address bus. The current simulator resolves that mismatch with a fixed two-byte format:

```text
Byte 0: opcode (8 bits)
Byte 1: operand (8 bits)
```

Every instruction occupies two consecutive RAM bytes. PC increments by one each time a byte address is transferred to MAR, so it advances by two bytes for each complete instruction. All values and addresses fit the 8-bit registers, and RAM addresses cover the full `00h`–`FFh` range. Instructions without an operand use `00h` as their second byte. Programs must contain an even number of bytes.

| Opcode | Mnemonic | Operand | Behavior |
| ---: | --- | --- | --- |
| `00h` | NOP | Unused | Completes without changing a data register. |
| `10h` | LDI A | 8-bit value | `A ← operand`; updates Zero. |
| `11h` | LDI B | 8-bit value | `B ← operand`. |
| `20h` | LDA | 8-bit address | `A ← RAM[address]`; updates Zero. |
| `21h` | LDB | 8-bit address | `B ← RAM[address]`. |
| `30h` | ADD | Unused | `A ← A + B` modulo 256; updates Zero and Carry. |
| `31h` | SUB | Unused | `A ← A − B` modulo 256; Carry is set when no borrow occurs. |
| `40h` | STA | 8-bit address | `RAM[address] ← A`. |
| `41h` | STB | 8-bit address | `RAM[address] ← B`. |
| `50h` | OUT | Unused | `OUT ← A`. |
| `60h` | JMP | 8-bit address | `PC ← address`. |
| `61h` | JZ | 8-bit address | Branch when Zero is set; otherwise continue after the instruction. |
| `FFh` | HLT | Unused | Stops the processor after fetching both instruction bytes. |

An unknown opcode also halts safely. There are no implicit registers or undocumented opcodes.

## Clock controls and micro-steps

Every **Step Clock** click is one rising clock edge. It advances one micro-step, increments the cycle count once, updates the registers assigned by that edge, and adds a record to Clock history. The current edge’s control signals and transfer routes are shown beside the diagram. The current route animates from source to destination and remains highlighted until the next edge.

- **Manual clock:** the user advances one edge at a time. The next signal recipe is displayed before it is applied. There is no Run or Step Instruction action in this mode.
- **With control unit:** the same CPU micro-step model is driven by the teaching control sequence. Step Clock advances one edge; Step Instruction advances through the current instruction; Run advances individual edges at the selected interval; Pause stops the sequence.
- **Reset:** restores the documented initial state, including the built-in program in RAM, zeroed registers/flags/output, PC=`00h`, and an empty clock trace.
- **Load program:** accepts hexadecimal bytes separated by spaces, commas, or line breaks. It validates byte width, even program length, and the 256-byte RAM limit, then loads at address `00h` and resets processor state.
- **RAM inspector:** shows the first 32 memory bytes and allows any of the 256 addresses to be edited using decimal address/value inputs. RAM edits are recorded as input events, not clock edges.

### Fetch/decode/execute sequence

The control sequence is shared by both modes. With no control unit, the user provides each edge manually; with the unit, the simulator chooses when to issue each edge.

1. **Fetch opcode address:** PC drives the internal bus into MAR. The local incrementer advances PC by one byte.
2. **Read opcode:** MAR presents the address on the external address bus. RAM returns the byte through the external data bus into MDR; the edge shows MEM_READ and WMFC.
3. **Load and decode:** MDR transfers the opcode to IR. The decoder identifies the operation and selects its micro-sequence.
4. **Fetch operand byte:** PC transfers the next byte address to MAR and increments. RAM returns the operand through MDR, then MDR transfers it to the operand register.
5. **Execute:** the operation selects the necessary path. Memory access puts the operand address in MAR; ALU operations transfer A and B to separate ALU inputs on separate edges; immediate loads transfer the operand byte to A or B; branches test Zero.
6. **Writeback/output:** memory loads move MDR to a register; stores move A or B to MDR and then write RAM; arithmetic moves the ALU result through Z to A; OUT moves A to the output register.
7. **Halt:** HLT sets the halted state and disables further clock edges until Reset.

The order is recorded in the trace with cycle number, micro-step name, active transfer path(s), and active control signals. A memory-read edge can show both the external address and data lanes because they are distinct buses; only one source uses the internal bus in an edge.

## Built-in 11 + 4 program

The default program is loaded at RAM address `00h`:

| Address | Bytes | Instruction | Effect |
| ---: | --- | --- | --- |
| `00h` | `10 0B` | `LDI A 0Bh` | A receives decimal 11. |
| `02h` | `11 04` | `LDI B 04h` | B receives decimal 4. |
| `04h` | `30 00` | `ADD` | A receives 11 + 4 = 15 (`0Fh`); Zero=0, Carry=0. |
| `06h` | `50 00` | `OUT` | Output register receives `0Fh`. |
| `08h` | `FF 00` | `HLT` | Processor halts; PC is `0Ah`. |

The program listing is shown beside the program editor. Use Step Clock to inspect every transfer or Step Instruction to complete one instruction at a time. The register panel, output register, PC/cycle readout, and trace expose the result.

## Home page visual effect

The React Bits LightTunnel implementation is mounted only on the home page. It uses WebGL 2 for subtle white cable/pulse lines over black. The effect’s source pauses when the document is hidden or the element is off-screen; it renders a still frame when reduced motion is requested. When WebGL 2 is unavailable or shader setup fails, a static CSS tunnel pattern is shown. The CPU simulator uses its own charcoal background and has no tunnel canvas behind the circuit.

## Run and build

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Vite opens the development server URL. To create and preview a static production build:

```sh
npm run build
npm run preview
```

The production output is in `dist/`. The project requires no backend or database; state lives in the current browser tab and is not persisted after reload. Google Fonts are optional and have local sans-serif, mono, and serif fallbacks.

## Limitations

- The teaching model uses edge-triggered register transfers but does not simulate gates, electrical contention, or analog timing.
- The default program is 10 bytes. Programs may use up to 256 bytes; instruction fetch wraps through 8-bit addresses and software should avoid overlapping code with data it needs to preserve.
- A fixed two-byte format means the highest complete instruction start address is `FEh`; its operand byte is at `FFh`. If execution continues, PC wraps to `00h`.
- The output register is an on-screen latch, not a modeled external device or memory-mapped port.
- The FuzzyText title is canvas-rendered and the tunnel needs WebGL 2 for animation; the tunnel’s CSS fallback is static.
