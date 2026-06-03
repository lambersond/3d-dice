# Publishing

How to publish the `@lambersond/*` packages to npm. Every command runs from the
`packages/` workspace, where the publish scripts are defined
([packages/package.json](packages/package.json)).

## Packages

| Package | Builds on publish? | Notes |
| ------- | ------------------ | ----- |
| [`@lambersond/3d-dice-engine`](packages/3d-dice-engine) | No (ships TS source) | three.js + cannon-es engine; also carries the ~2 MB texture/sound assets. |
| [`@lambersond/3d-dice-core`](packages/3d-dice-core) | Yes (`tsc` to `dist/`) | Depends on the engine. |
| [`@lambersond/3d-dice-react`](packages/3d-dice-react) | Yes (`tsc` to `dist/`) | Peer-depends on core. |

All three are public scoped packages (`publishConfig.access` is `public`).

## Prerequisites

- Node `v22.17.1` (see [`.nvmrc`](.nvmrc)).
- Logged in to npm with publish rights to the `@lambersond` scope:

```bash
npm whoami    # confirm you are logged in
npm login     # if you are not
```

## Bump the version

Each package versions independently. Before every real publish, bump the version
of the package you are releasing (npm refuses to republish an existing version):

```bash
cd packages
npm version patch -w @lambersond/3d-dice-core   # or minor / major
```

## Publish a package

From `packages/`:

```bash
cd packages

# 1. Dry run first: builds, then prints the exact tarball contents and uploads nothing.
npm run publish:core -- --dry-run

# 2. Publish for real.
npm run publish:core
```

Swap `publish:core` for `publish:engine` or `publish:react`. What each script does:

| Script | What it does |
| ------ | ------------ |
| `publish:engine` | Publishes the engine as-is (ships `src/`, `types/`, `public/`; no build). |
| `publish:core` | Core's `prepublishOnly` cleans and rebuilds `dist/`, then publishes. |
| `publish:react` | Builds core first (react needs core's built types), then react's `prepublishOnly` rebuilds `dist/` and publishes. |

The `-- --dry-run` flag passes through to the underlying `npm publish`, so it works
with every script. `prepublishOnly` runs on both real publishes and dry runs, so a
stale `dist/` can never be shipped.

## Order for a fresh release

Publish in dependency order so each package resolves when the next is installed:

1. `npm run publish:engine`
2. `npm run publish:core`
3. `npm run publish:react`

For a routine update you can publish just the package that changed.

## After publishing

Confirm the registry has the new version:

```bash
npm view @lambersond/3d-dice-core version
```

The engine's dice textures and sounds are fetched at runtime and must be hosted by
the consumer (see the engine's Asset hosting notes). Consumers populate them with:

```bash
npx @lambersond/3d-dice-engine copy-assets
```

## Notes

- Internal dependency versions are currently `*` (core depends on engine, react
  peer-depends on core). They publish literally as "any version", so consumers
  always resolve the latest. Pin them to real ranges at release time if you want
  stricter resolution.
- The packages are private to your registry account only by access control, not by
  the `private` flag; `private` is `false` on all three so they can publish.
