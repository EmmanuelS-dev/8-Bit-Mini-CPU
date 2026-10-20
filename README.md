# 8 Bit Mini CPU

A frontend only, interactive teaching website for the 8-bit datapath in `8BIT_MINI_CPU.circ`. It is built with React, TypeScript, and Vite. The circuit file is a read-only reference and is not edited or loaded by the site.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Create and preview a static production build with:

```sh
npm run build
npm run preview
```

The production site is in `dist/` and can be hosted on a static host. It needs no API, server, database, or account. CPU state lives in the current browser tab. Google Fonts are used when online, with local sans-serif and serif fallbacks.

## Pages

- `index.html` is the About page with the project title and team: Nathan John, Emmanuel S, Sahil Sunil, Aishwarya A, Hrishikesh, and Thulasi.
- `simulator.html` contains the quick guide, instruction reference, live circuit, clock history, RAM inspector, and register display.

## Simulation modes

- **Without control unit:** set an operation, choose RAM or the corresponding general register for each operand, enter the values, and choose where the result goes. Prepare the instruction, then advance one clock edge at a time. The sequence demonstrates PC/MAR fetch, memory wait (WMFC), MDR/IR transfer, decode, operand selection and reads, ALU execution, and writeback. RAM operands use `10h` and `11h`; a RAM result uses `12h`. These slots appear in the inspector.
- **With control unit:** load the sample or enter hexadecimal instruction bytes. Step executes one instruction; Run continues until paused or halted.

Teal highlights show the latest data or address path. The active control signals are listed beside the clock sequence. Every clock step or automatic instruction is recorded in Cycle history.

## Sample automatic program

The default program is `61 72 31 53 F0`:

1. `61` loads immediate value 1 into A.
2. `72` loads immediate value 2 into B.
3. `31` adds B to A.
4. `53` stores A at RAM address 3.
5. `F0` halts.

After execution, A is `03`, and RAM address `03` contains `03`.

## Project structure

- `src/cpu.ts` implements CPU state, instruction execution, and program loading.
- `src/SimulatorPage.tsx` implements the guided clock sequence, automatic control mode, circuit view, and inspector panels.
- `src/AboutPage.tsx` contains the About page and team names.
- `src/SiteHeader.tsx` provides sticky navigation.
- `src/styles.css` contains the responsive theme and datapath styles.
- `documentation.md` describes the architecture and teaching model in detail.

The circuit reference does not define an instruction set or control unit. The automatic mode therefore uses the documented teaching ISA. This is a browser model of the named datapath, not a gate-level Logisim emulator.
