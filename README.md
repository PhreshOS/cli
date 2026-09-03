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

The CLI does not define another runtime interface. Its runtime commands map to
the same serialized operations and shared contracts used by the SDKs.

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
```

Use `phresh describe` to inspect the command tree and exact options. See the
[CLI documentation](https://docs.phreshos.com/sdks/cli) for Program project,
System, and runtime commands.

## Development

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` checks the scripts, builds the CLI and bundled starter, runs the
command tests, and validates the package artifact.

## Related repositories

- [`@phreshos/node`](https://github.com/PhreshOS/node) owns the Project and
  external System APIs composed by the CLI.
- [`@phreshos/core`](https://github.com/PhreshOS/core) owns the shared command
  and runtime contracts.
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
