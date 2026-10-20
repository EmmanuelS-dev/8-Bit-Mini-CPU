# 8 Bit Mini CPU — Documentation

## Purpose and scope

This website is an interactive frontend demonstration of the datapath represented in `8BIT_MINI_CPU.circ`. The reference file is kept unchanged. Its labeled components include PC, MAR, RAM, MDR, IR, A, B, an 8-bit ALU, and flags. It does not define an instruction set or a control unit, so the website provides a documented teaching ISA and two ways to explore the flow.

The model demonstrates register transfers and instruction-level behavior. It does not emulate individual gates, propagation delays, electrical bus contention, or the Logisim runtime.

## Pages and navigation

The sticky navigation links the About page (`index.html`) and simulator (`simulator.html`). The About page introduces the project and lists Nathan John, Emmanuel S, Sahil Sunil, Aishwarya A, Hrishikesh, and Thulasi. The simulator page places the short guide and ISA before the circuit workspace. Its circuit remains sticky beside the controls on desktop; on narrow screens the controls follow the circuit, which also supports horizontal panning to keep the complete datapath legible.

## Datapath

| Component | Width | Role |
| --- | ---: | --- |
| PC | 8 bits | Address of the next instruction; wraps from `FF` to `00`. |
| MAR | 8 bits | Address presented to RAM. |
| RAM | 256 × 8 bits | Stores instruction and data bytes at addresses `00`–`FF`. |
| MDR | 8 bits | Holds a byte returned by RAM. |
| IR | 8 bits | Holds the fetched instruction. |
| A | 8 bits | Accumulator and ALU input/result register. |
| B | 8 bits | Secondary general purpose ALU register. |
| ALU | 8 bits | Performs arithmetic and bitwise operations. |
| Z | 1 bit | Set when the selected result is zero. |
| C | 1 bit | Addition carry; for subtraction it indicates no borrow. |

All register and memory writes are masked to eight bits. Teal wire highlights show the most recent transfer. Dashed amber wires show control paths in automatic mode. The manual sequence also lists its active control signals next to the current stage.

## Manual sequence without the control unit

The user configures the operation, source for each operand, operand values, and destination before preparing an instruction. The setup has a working sample: `ADD`, values `05h` and `03h`, RAM slots `10h` and `11h`, result to A. The user advances one clock edge at a time; the Cycle history records each stage and its paths.

The sequence is:

1. **Fetch address:** PC is copied to MAR, the memory read is requested, and PC increments to the next instruction address.
2. **WMFC:** Wait for memory function complete; the instruction byte at MAR is copied into MDR.
3. **IR load:** MDR transfers the instruction byte to IR.
4. **Decode:** The selected operation is identified and its operand and destination paths are selected.
5. **Operand selection:** A register source is selected directly. For a RAM source, MAR selects the prepared slot, the memory read begins, WMFC returns the byte to MDR, and MDR loads the relevant ALU register.
6. **Execute:** A and B feed the ALU. The selected operation updates the ALU result and flags.
7. **Writeback:** The result is latched in A or B, or written to RAM at `12h`.

RAM source addresses are fixed for this demonstration: operand A is stored at `10h` and operand B at `11h`. A RAM result is written to `12h`. No address entry is needed for these slots. The RAM inspector shows addresses through `12h` with their roles.

Changing the configuration after preparation is disabled so one sequence stays consistent. Choose **Restart sequence** to prepare the same configuration again, or **Reset** and change configuration before preparing a new one. Reset preserves the RAM contents, in keeping with the simulator reset behavior.

## Automatic mode with the control unit

The browser teaching control unit fetches, decodes, and executes one full instruction with **Step instruction**. **Run** repeats at the selected speed and stops at HLT. The diagram highlights paths touched by that instruction and displays the decoded mnemonic. Reset clears registers and flags while preserving RAM.

### Instruction format

Each instruction byte consists of a 4-bit opcode followed by a 4-bit operand. The operand is zero-extended where used as an address or immediate.

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

Program bytes are entered in hexadecimal, separated by spaces, commas, or line breaks. Loading a program clears RAM, writes bytes beginning at `00`, and resets the registers and PC. The supplied program is `61 72 31 53 F0`: load 1 into A, load 2 into B, add, store A at address 3, then halt. The final A and RAM[`03`] values are `03`.

## Cycle history and memory tools

Cycle history records every manual clock edge and every automatic instruction with its summary and highlighted datapaths. The latest 100 records are retained in the current browser session. The RAM editor can write any of the 256 cells. The register panel shows PC, MAR, MDR, IR, A, B, and Z/C in hexadecimal or bit form.

## Technology and hosting

- React renders the two pages and interactive controls.
- TypeScript holds CPU state and simulation transitions.
- Vite serves local development and produces the static build in `dist/`.
- No backend or database is required; state is held in the browser tab and is not persisted after reload.
- DM Sans and DM Mono provide the main sans and monospaced styles; Playfair Display is used as a serif accent. System fonts provide fallbacks when Google Fonts are unavailable.

Run `npm install`, then `npm run dev` to develop. Use `npm run build` to create the static production site and `npm run preview` to preview that build locally.
