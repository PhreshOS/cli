# `@phreshos/cli`

The `phresh` command for creating and operating Programs and managing the
PhreshOS System on the current machine.

The CLI uses the same public System interface as the Node and Server SDKs. It
adds command parsing, terminal presentation, project workflows, packaging, and
native service management.

## Installation

| Package manager | Command |
| --- | --- |
| npm | `npm install --global @phreshos/cli` |
| pnpm | `pnpm add --global @phreshos/cli` |
| Bun | `bun add --global @phreshos/cli` |
| Yarn Classic | `yarn global add @phreshos/cli` |

Node.js 20.10 or newer is required.

## Program projects

```sh
phresh create
phresh init
phresh dev
phresh start
phresh install
phresh uninstall
phresh pack
```

`create` produces the official starter Program. The remaining commands operate
on the current Program project, derive its concrete definition, and delegate
runtime operations to the connected System.

## System

```sh
phresh system install
phresh system status
phresh system start
phresh system stop
phresh system enable
phresh system disable
phresh system uninstall
```

System installation acquires and verifies the official release archive and
configures the native per-user service. Starting and stopping control current
execution; enabling and disabling control automatic startup.

## Runtime

```sh
phresh program list
phresh process list --program my-program
phresh endpoint inspect \
  --program my-program \
  --process main \
  --endpoint server
phresh window inspect --program my-program --process main
```

The command hierarchy follows the runtime ownership hierarchy. Unknown
commands, flags, and malformed values reject rather than being guessed.

```sh
phresh describe
phresh describe program
phresh describe process list
```

`describe` exposes the command tree and exact options as machine-readable
contracts.

## Development

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` checks the scripts, builds the CLI and bundled starter, runs the
command tests, and validates the package artifact.

See the [CLI documentation](https://github.com/PhreshOS/docs/blob/main/content/docs/sdks/cli.mdx)
for the command model.

## Repository boundary

This repository owns terminal interaction, project commands, packaging, System
acquisition, and host service integration. Node owns the external JavaScript
interface, Core owns shared contracts, and the System owns authoritative state.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository workflow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Zohayr SLILEH.
