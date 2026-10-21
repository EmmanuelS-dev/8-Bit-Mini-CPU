# 8 Bit Mini CPU — Technical Documentation

## Project scope

This React and TypeScript website is an edge-stepped teaching model of an 8-bit CPU. Its state and clock transition function are implemented in `src/cpu.ts`; the diagram reads that same state and highlights the paths recorded by each transition. The existing `8BIT_MINI_CPU.circ` file is a read-only architecture reference and is not modified or loaded by the app.

The model demonstrates register transfers, RAM access, instruction decode, ALU operations, flags, and writeback. It is not a gate-level or electrical simulator. It does not model analog timing, interrupts, or bus contention.

## Architecture and widths

| Component | Width | Role |
| --- | ---: | --- |
| PC | 8 bits | Address of the next byte to fetch; increments by one on each instruction-byte fetch. |
| MAR | 8 bits | Holds the address used by the external RAM interface. |
| RAM | 256 × 8 bits | Shared byte memory for the program and data, addresses `00h`–`FFh`. |
| MDR | 8 bits | Buffers bytes read from RAM or prepared for a RAM write. |
| IR | 8 bits | Holds the operation code currently being decoded. |
| A and B | 8 bits each | General-purpose registers; they are available as operand sources and destinations. |
| Operand latches 1 and 2 | 8 bits each | Hold the selected values before the ALU input transfers. |
| ALU A and ALU B | 8 bits each | Capture operands on separate clock edges before the selected operation. |
| ALU result and Z | 8 bits each | ALU produces a wrapped result; Z holds it until destination writeback. |
| OUT | 8 bits | Captures a computed result when selected as the destination. |
| Flags Z, N, C | 1 bit each | Zero, sign bit (Negative), and operation-specific Carry status. |
| Internal bus | 8 bits | One shared CPU datapath. A single selected source drives it for a given transfer edge. |
| Control unit and clock | Control signals | Decode IR, select a micro-operation, and issue one rising edge per Step Clock click. |

### Internal versus external buses

The central vertical line in the circuit is the single 8-bit internal bus. Component routes enter it at visible taps. Only the route or routes recorded for the latest micro-operation are illuminated. Control and clock signals are shown as separate sideband lines; they do not carry data bytes on the internal bus.

RAM has three distinct external connections:

- **Address:** MAR presents an 8-bit address to RAM.
- **Data:** the 8-bit data lane connects RAM and MDR.
- **Control:** the control unit asserts read or write; `WMFC` marks completion of a modeled memory read.

The external address, data, and control routes can be active together during a RAM transaction because they are different wires. This does not select multiple sources for the internal bus.

## Instruction encoding

Each instruction occupies exactly seven bytes. Every instruction, including `HLT`, uses the same width.

| Byte offset | Meaning |
| ---: | --- |
| 0 | Operation code |
| 1 | Operand 1 source: `00` A, `01` B, `02` RAM |
| 2 | Operand 1 RAM address; ignored for A or B |
| 3 | Operand 2 source: `00` A, `01` B, `02` RAM |
| 4 | Operand 2 RAM address; ignored for A or B |
| 5 | Destination: `00` A, `01` B, `02` RAM, `03` OUT |
| 6 | Destination RAM address; ignored unless the destination is RAM |

The operation byte codes are:

| Code | Operation |
| ---: | --- |
| `10h` | ADD |
| `11h` | SUB |
| `12h` | MULT |
| `13h` | DIV |
| `14h` | AND |
| `15h` | OR |
| `16h` | XOR |
| `FFh` | HLT |

All seven operation bytes are followed by six configuration bytes. For HLT, those six bytes are zero-filled. The PC advances once per byte fetch, so it advances seven bytes for each completed instruction. The editor displays every operation as a 7-byte row and prevents a program from exceeding 256 bytes (36 complete instructions).

RAM stores both code and data. The editor loads code from `00h` and applies configured initial data values afterward. It rejects initial data addresses that overlap the encoded program, duplicate data addresses, missing values, and values outside `00h`–`FFh`. Operand and destination RAM fields can select any 8-bit address.

## Operations and destinations

For each arithmetic/logical instruction, the configured sources are read into operand latches 1 and 2. These latches then drive ALU A and ALU B on separate clock edges. The operation writes its result to Z, then to the configured destination:

- **ADD:** `(operand1 + operand2) mod 256`.
- **SUB:** `(operand1 - operand2) mod 256`.
- **MULT:** `(operand1 × operand2) mod 256`.
- **DIV:** unsigned integer quotient, rounded down. Division by zero produces `00h`, sets Carry, and continues through normal writeback to the selected destination.
- **AND, OR, XOR:** bitwise operation on the two 8-bit operands.
- **HLT:** stops the clocked processor after the seven-byte instruction has been fetched.

Destinations are Register A, Register B, a RAM byte, or OUT. RAM writeback first moves the selected address into MAR, then moves Z to MDR, then writes MDR to RAM. These are distinct clock edges and the diagram highlights each one.

## Flags

The ALU updates all three flags when an operation executes:

- **Zero (Z):** set when the 8-bit wrapped result is `00h`.
- **Negative (N):** set when bit 7 of the 8-bit result is 1. Values are unsigned for division, but this flag exposes the result’s high bit.
- **Carry (C):** ADD and MULT set Carry when the unwrapped result exceeds `FFh`; SUB sets Carry when no borrow was needed (`operand1 ≥ operand2`); logical operations clear Carry; DIV clears Carry except on divide by zero, where it sets Carry.

Carry for subtraction therefore means “no borrow,” not a signed overflow flag. The model does not provide a separate signed-overflow flag.

## Fetch, decode, execute, and writeback

Every **Step Clock** click is one rising clock edge and one state transition. It increments the cycle count by one, records a single micro-operation, updates only the state written by that operation, and holds the corresponding active path until the next click.

1. **Fetch address:** PC drives the internal bus to MAR; the PC incrementer advances PC by one byte.
2. **Fetch opcode:** MAR supplies the external RAM address. RAM returns the opcode through the external data bus into MDR; the control signals include read and WMFC.
3. **Load IR and decode:** MDR transfers the opcode to IR. The control unit decodes the operation.
4. **Fetch instruction fields:** PC/MAR and RAM/MDR repeat for each of the six operand/destination bytes. MDR places each byte into the instruction field latches.
5. **Read configured operands:** A or B transfers directly to its operand latch on one edge. A RAM source first places its configured address in MAR, reads RAM into MDR, then transfers MDR to the selected operand latch.
6. **Load ALU inputs:** operand 1 and operand 2 transfer to ALU A and ALU B on separate edges.
7. **Execute:** the ALU computes the operation and updates Z, N, and C.
8. **Write back:** the result transfers from the ALU into Z and then to A, B, OUT, or through MDR to a RAM destination.
9. **Halt:** HLT sets the halted state. Reset restarts the currently loaded program and restores its configured initial RAM values.

The circuit footer shows the phase of the last edge, its plain-language effect, the next micro-operation, clock and instruction counts, PC/IR/MAR/MDR, and control signals. The trace logs the same transition and paths.

## Built-in example program

The default program configures three initial RAM bytes: `RAM[80h]=0Bh`, `RAM[81h]=04h`, and `RAM[82h]=03h`.

| # | Address | Seven bytes | Operation | Sources | Destination | Result |
| ---: | ---: | --- | --- | --- | --- | --- |
| 1 | `00h` | `10 02 80 02 81 00 00` | ADD | RAM[80h], RAM[81h] | A | `0Fh` |
| 2 | `07h` | `11 00 00 02 81 01 00` | SUB | A, RAM[81h] | B | `0Bh` |
| 3 | `0Eh` | `12 01 00 02 82 00 00` | MULT | B, RAM[82h] | A | `21h` |
| 4 | `15h` | `13 00 00 02 82 01 00` | DIV | A, RAM[82h] | B | `0Bh` |
| 5 | `1Ch` | `14 00 00 01 00 00 00` | AND | A, B | A | `01h` |
| 6 | `23h` | `15 00 00 01 00 01 00` | OR | A, B | B | `0Bh` |
| 7 | `2Ah` | `16 00 00 01 00 03 00` | XOR | A, B | OUT | `0Ah` |
| 8 | `31h` | `10 02 80 02 81 03 00` | ADD | RAM[80h], RAM[81h] | OUT | `0Fh` |
| 9 | `38h` | `FF 00 00 00 00 00 00` | HLT | — | — | Processor halts |

The byte listing in the circuit page is generated from the loaded RAM program. Step Clock follows all fetches, field decodes, operand reads, ALU input transfers, execution, and writeback edges. The XOR step shows `0Ah` in OUT; the final ADD writes `0Fh` (decimal 15) to OUT before HLT. The program is 63 bytes long, so PC is `3Fh` when it halts.

## Configure and run

1. Open the Circuit page and edit the ordered instruction rows. Use the arrows to change order and Add/Remove to change the program.
2. Select A, B, or RAM for each source. Selecting RAM reveals an 8-bit address field.
3. Select A, B, RAM, or OUT as the destination. RAM reveals a destination address field.
4. Enter initial RAM address/value pairs. Keep them outside the program’s byte range.
5. Select **Load configured program**. Invalid or incomplete input is reported inline and the current loaded CPU is preserved.
6. Press **Step Clock** to advance one edge. Press **Reset** to restore the loaded program and its initial RAM contents.

To run the site locally, use Node.js 20 or later:

```sh
npm install
npm run dev
```

Create and preview a production build with:

```sh
npm run build
npm run preview
```

The project has no backend. Program edits and CPU state are kept in the current page and reset on reload. The flowing-line background is used on the Home and Circuit pages; the circuit has a tinted panel for contrast. Circuit routes use a restrained animated SVG stroke and become static when reduced motion is preferred. The LightTunnel has a CSS fallback if WebGL initialization is unavailable.

## Limitations

- This is an instruction-level teaching model with edge-triggered transfers, not a gate-accurate CPU or analog timing simulation.
- The fixed instruction width leaves a maximum of 36 complete instructions in the 256-byte RAM.
- There is no branching, stack, interrupt, memory-mapped I/O, or signed-overflow flag.
- RAM is one shared program/data space. The configurator prevents initial data from overwriting code, but a program can still write to its own code addresses at runtime.
- The output register is an on-screen result latch, not an external device.
