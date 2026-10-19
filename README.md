# 8-Bit CPU Lab

An interactive, frontend-only teaching simulation of the datapath in `8BIT_MINI_CPU.circ`. It presents two ways to explore the same register, RAM, and ALU model:

- **Without control unit:** select control signals and data inputs, then apply a clock edge yourself.
- **With control unit:** load an 8-bit program and let an instruction decoder select the datapath operations.

The CPU schematic file is used as a read-only design reference. The website does not modify or load that file at runtime.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create a static production build:

```sh
npm run build
npm run preview
```

The generated site is in `dist/` and can be hosted by any static website host. There is no server or database requirement. Google Fonts are requested by the stylesheet when online; the site falls back to local sans-serif and serif fonts otherwise.

## Sample program

The initial program is `61 72 31 53 F0`:

1. `61` loads immediate value 1 into A.
2. `72` loads immediate value 2 into B.
3. `31` adds B to A.
4. `53` stores A at RAM address 3.
5. `F0` halts.

After execution, A is `03`, and RAM address `03` contains `03`.

## Project structure

- `src/cpu.ts` contains CPU state, manual signal application, instruction execution, and program loading.
- `src/App.tsx` contains the React interface and interactive SVG datapath.
- `src/styles.css` contains the responsive visual theme and datapath signal states.
- `documentation.md` describes the model, instruction format, controls, and known boundaries.

## Design reference and scope

The Logisim circuit labels its flow as `PC → MAR → RAM → MDR → IR` followed by an A/B register and add/subtract ALU datapath. This website models those named components and signals in TypeScript. The original circuit does not define an instruction set or a control unit; the automatic mode therefore uses the documented teaching ISA in `documentation.md`. It is a coherent extension for demonstration, not a claim that the ISA is encoded in the Logisim file.
