# 8 Bit Mini CPU

A React + TypeScript teaching simulator for an 8-bit single-bus CPU. The home page introduces the project; the simulator page lets you inspect a routed datapath, edit/load a program, and advance real clocked micro-steps.

The `.circ` file in this project is a read-only reference. The website does not modify it.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Create and preview a static build with:

```sh
npm run build
npm run preview
```

The built site is in `dist/` and can be served from a static host. No backend or database is required.

## Simulator

- **Manual clock** lets you advance exactly one rising edge per click and inspect the transfer and signals for that micro-step.
- **With control unit** provides Step Clock, Step Instruction, Run/Pause, and clock speed controls using the same CPU model.
- The built-in program computes `11 + 4 = 15`, writes `0Fh` to the output register, then halts.
- Program bytes are hexadecimal and use a fixed two-byte instruction format: one opcode byte and one 8-bit value/address byte.
- The CPU diagram shows one 8-bit internal bus plus separate external RAM address, data, and control lines. The active path matches the state transition for that clock edge.

The instruction set, edge sequence, encoding, program trace, limitations, and hosting notes are in [documentation.md](documentation.md).

## Project layout

- `src/cpu.ts` is the CPU state model, instruction table, program loader, and clock-edge transition function.
- `src/SimulatorPage.tsx` renders the actual state, single-bus SVG, controls, trace, program listing, and RAM/register inspectors.
- `src/AboutPage.tsx` is the landing page and team section.
- `src/LightTunnel.tsx` and `src/FuzzyText.tsx` implement the supplied home-page effects.
- `src/styles.css` contains the responsive theme and diagram styles.
- `8BIT_MINI_CPU.circ` is kept as the original reference file.
