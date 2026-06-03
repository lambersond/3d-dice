# 3d-dice

A 3D dice roller for the web: a Next.js app plus the framework-agnostic packages
that power it. Rolls are parsed from text (like `2d6 + 3 adv`), resolved by a roll
engine, and animated in a real three.js + cannon-es physics simulation.

## What's inside

A monorepo containing the demo web app and three published packages:

```
.
├── src/                  # the Next.js 16 / React 19 app
└── packages/
    ├── 3d-dice-core/     # @lambersond/3d-dice-core
    ├── 3d-dice-engine/   # @lambersond/3d-dice-engine
    └── 3d-dice-react/    # @lambersond/3d-dice-react
```

**The app** (`src/`) is a dice-roller room: a dice tray for assembling rolls, a
roll log, and a chat panel, with rolls and chat persisted to local storage and
customizable dice themes.

**The packages:**

| Package | What it is |
| ------- | ---------- |
| [`@lambersond/3d-dice-core`](packages/3d-dice-core) | Framework-agnostic building blocks: the roll engine, expression parser, formatters, tray state machine, theme presets, and a WebGL renderer controller. No UI framework. |
| [`@lambersond/3d-dice-engine`](packages/3d-dice-engine) | A vendored fork of [`@3d-dice/dice-box-threejs`](https://github.com/3d-dice/dice-box-threejs): the three.js + cannon-es engine that renders and simulates the dice, plus the texture and sound assets. |
| [`@lambersond/3d-dice-react`](packages/3d-dice-react) | React hooks and providers over core (renderer, tray, theme, preferences). |

Each package has its own README with the full API.

## Requirements

- Node `v22.17.1` (see [`.nvmrc`](.nvmrc))

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Dice textures and sounds are served from `public/3d-dice/`. Both `npm run dev` and
`npm run build` populate that folder automatically via the `copy:dice-assets`
script (wired into `predev`/`prebuild`), copying the assets out of
`@lambersond/3d-dice-engine`.

## Scripts

App scripts, run from the repo root:

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` / `lint:fix` | Lint, optionally autofixing. |
| `npm run test` | Run the app's Jest tests. |
| `npm run copy:dice-assets` | Copy engine assets into `public/3d-dice/` (runs automatically before dev and build). |

The packages form their own workspace. Build, test, and publish them from
`packages/`:

```bash
cd packages
npm run build            # build every package
npm run test             # test every package
npm run publish:core     # publish one package (also publish:engine, publish:react)
```

See [`packages/package.json`](packages/package.json) and each package's README for
the full set.

## Tech stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS
- three.js + cannon-es (via the dice engine)
- Jest and Testing Library

## License

The published packages are MIT licensed; see each package for details.
