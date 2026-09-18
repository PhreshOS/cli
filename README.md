# `@phreshos/cli`

The `phresh` command for Program projects, runtime operations, and PhreshOS
System management.

[Documentation](https://docs.phreshos.com/sdks/cli) ·
[Installation](https://docs.phreshos.com/installation) ·
[Source](https://github.com/PhreshOS/cli)

## Role

The CLI presents public Project and System operations as human-facing commands.
It owns command parsing, terminal output, packaging presentation, System release
acquisition, and native service management.

The CLI owns its command contract. Runtime command executors use
`@phreshos/node` and Core's shared Execute operation catalog; the CLI does not
define a second System interface or transport request language.

## Installation

| Package manager | Command |
| --- | --- |
| npm | `npm install --global @phreshos/cli` |
| pnpm | `pnpm add --global @phreshos/cli` |
| Bun | `bun add --global @phreshos/cli` |
| Yarn Classic | `yarn global add @phreshos/cli` |

Node.js 20.10 or newer is required.

```sh
phresh create
phresh dev
phresh install
phresh system status
phresh program list
phresh execute '{"$domain":"operation","$operation":"list"}'
```

Use `phresh describe` to inspect a command, or `phresh describe --all --json`
to read the complete machine-discoverable contract. See the
[CLI documentation](https://docs.phreshos.com/sdks/cli) for Program project,
System, and runtime commands.

Runtime commands render direct lists or labeled fields for people by default.
Add `--json` to receive the complete result as one JSON value for automation.
`phresh execute` accepts and returns JSON directly.

## Development

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` checks the scripts, builds the CLI and bundled starter, runs the
command tests, and validates the package artifact.

`check` performs static checks, `build` creates distributable output, and `test`
runs Vitest assertions from `tests/`. Run `build` before testing built artifacts.
`verify` runs `check`, `build`, and `test` in order. Operational tooling belongs
in `scripts/`; tests and their fixtures belong in `tests/`. Verification uses
the committed dependency graph without local package substitutions.

## Related repositories

- [`@phreshos/node`](https://github.com/PhreshOS/node) owns the Project and
  external System APIs composed by the CLI.
- [`@phreshos/core`](https://github.com/PhreshOS/core) owns the shared System
  domain contracts used by the Node SDK.
- [PhreshOS System](https://github.com/PhreshOS/system) provides the managed
  runtime and official release artifact.
- [Phresh Program](https://github.com/PhreshOS/phresh-program) is the starter
  bundled by `phresh create`.
- [PhreshOS Install](https://github.com/PhreshOS/install) bootstraps this CLI on
  clean machines.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository workflow and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Zohayr SLILEH.

`test:platform` explicitly selects native service/installation tests for the
current OS. These may change temporary host services; CI runs them on disposable
runners after building.

`test:live` explicitly selects external-service tests. They require network
access and, for providers, credentials; provider calls may incur costs.
