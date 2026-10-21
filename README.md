# 8 Bit Mini CPU

A React and TypeScript teaching simulator for an 8-bit single-bus CPU. Configure arithmetic and logical operations, choose register or RAM operands and destinations, then follow the actual datapath one rising clock edge at a time.

The `8BIT_MINI_CPU.circ` file remains an unchanged reference. The website does not edit or load it.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Build and preview the static site:

```sh
npm run build
npm run preview
```

No backend or database is required.

## CPU experience

- The Circuit page shows one 8-bit internal bus and separate RAM address, data, and control connections.
- **Step Clock** advances one micro-operation and rising edge; the illuminated route, updated state, signal list, and execution trace come from that same transition.
- Configure ADD, SUB, MULT, DIV, AND, OR, and XOR. Choose A, B, or RAM for each source and A, B, RAM, or OUT as the result destination.
- Instructions have a documented fixed 7-byte format. The built-in program exercises all seven operations, writes `0Fh` (11 + 4 = 15) to OUT, and halts.
- Reset restores the loaded program, initial RAM values, and initial CPU state.

See [documentation.md](documentation.md) for the architecture, instruction encoding, micro-operations, flags, example program, and known limits.

## Project layout

- `src/cpu.ts` contains the CPU state, instruction encoding, program validation, and edge transition function.
- `src/SimulatorPage.tsx` renders the circuit, configurable program, RAM initial values, loaded listing, and trace.
- `src/AboutPage.tsx` contains the landing page and team list.
- `src/LightTunnel.tsx` provides the flowing-lines background used on Home and Circuit.

## GitHub Pages

This repository is a project site deployed below `/8-Bit-Mini-CPU/`. Vite builds both HTML entry points into `dist/` with that base path. The workflow in `.github/workflows/pages.yml` builds the project and deploys the `dist` artifact on pushes to `main`; in repository settings, Pages must use **GitHub Actions** as its source.

The local SVG favicon is adapted from Lucide's CPU icon ([upstream source](https://github.com/lucide-icons/lucide/blob/main/icons/cpu.svg)). Lucide's ISC license and copyright notice are included in `public/LUCIDE-LICENSE.txt`.
- `src/styles.css` defines the site, circuit, responsive layout, and active SVG route effect.
