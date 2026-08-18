# Contributing

The CLI owns the `phresh` command language, Program project workflows, official
System acquisition, and native background-service lifecycle. It consumes
published contracts and release artifacts; it never reaches into another
repository's source checkout.

## Development

Install the pinned toolchain and verify the complete repository:

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` type-checks the source, runs focused lifecycle tests, rebuilds the
pinned Phresh Program template, packs the exact npm artifact, installs it in a
temporary consumer, and exercises its public executable. The separate
`verify:system-release` command downloads, verifies, and stages the official
System release with production dependencies. On macOS,
`verify:macos-service` exercises a uniquely named temporary `launchd` service.

Keep top-level Program commands scoped to the current project. System lifecycle
belongs only under `phresh system`, and native adapters must preserve the
separation between current execution and automatic startup. Add focused tests
for failure and rollback paths whenever lifecycle behavior changes.

## Pull requests

Explain the command or boundary being changed, include the verification that
protects it, and keep each pull request focused on one coherent change.
