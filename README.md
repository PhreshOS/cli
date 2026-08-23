# @phreshos/cli

The `phresh` command for creating and operating Programs, and for installing
and managing the PhreshOS System on the current machine.

## Package status

This package is one component of a larger architecture that is still under
active testing. The architecture's components will be released in stages as
their contracts and integrations are verified.

`@phreshos/cli` is not intended to be used independently of that architecture.
Its Program commands depend on `@phreshos/core`, and its runtime operations
require a compatible system installation.

```bash
phresh create app # create a complete new Program
phresh init     # describe this program, once
phresh pack     # run the optional build, then package its result
phresh install  # lay this program out on this machine
phresh uninstall # remove its installed form
phresh start    # run what your build left, and stay with it
phresh dev      # run from source, and stay with it
phresh system status # inspect the local System and its background service
```

`phresh --help` lists them, `phresh <command> --help` explains one, and
`phresh --version` says which CLI you have. Nothing is guessed: an
unknown command, an unknown flag and a malformed option are each refused
and named.

Every top-level Program command acts on the current project, and that list ends
there. It accepts no arbitrary Program identity and has no word for a Process,
Window, store, or setting. Machine lifecycle is isolated under `phresh system`;
it manages the System installation and native service, not the state inside the
System.

## System lifecycle

```bash
phresh system install
phresh system uninstall
phresh system status
phresh system version
phresh system start
phresh system stop
phresh system enable
phresh system disable
```

`install` resolves the newest compatible stable release from the official
[`PhreshOS/system`](https://github.com/PhreshOS/system) GitHub Releases. It
downloads the production archive and adjacent checksum, verifies every byte,
installs production dependencies into a staged version directory, atomically
points the stable `current` path at it, then registers, enables, and starts the
native per-user service. The selected release and the service entry therefore
cannot become two competing sources of truth if installation is interrupted.
It never reads a source checkout and never requires Bun or TypeScript.

The System runs under `launchd` on macOS, a real `systemd --user` manager on
Linux, and a least-privilege per-user scheduled task on Windows. In Linux
containers with no init manager, it runs as a detached user-owned background
process that survives the terminal but ends with the container. Automatic
startup is unavailable there rather than being reported as enabled. `start`
and `stop` change current execution only; where a native manager exists,
`enable` and `disable` change automatic startup only. Successful installation
and startup show the desktop address. `status` reports that same address with
the installed version, service readiness, and automatic startup without
changing them; `version` reports only the installed System release.

Installation files and persistent System state have separate homes. Removing
the System unregisters its service and removes its release files while keeping
`~/.phreshos`, including Programs and owner data. Local Program intake uses an
owner-only socket file on POSIX and an owner-created duplex named pipe on
Windows; neither becomes a network endpoint or introduces a bearer secret.

## create

`phresh create <directory>` creates a complete Server and Client Program from
the maintained `PhreshOS/phresh-program` repository. The CLI build downloads
the newest complete stable release, validates its source identity and version,
removes repository-only material, and bundles that exact authoring project.
The resolved source digest is recorded with the bundle. The installed CLI
therefore creates projects offline without reading a live branch or maintaining
a release pin or second template by hand.

The directory name becomes the stable kebab-case Program identity. In a
terminal, `create` asks for the directory when it is omitted, the readable
Program name, and the package manager. With no terminal, the directory is the
first argument and every optional choice is named:

```bash
phresh create status-board \
    --name "Status Board" \
    --package-manager npm
```

Dependencies are installed by default. `--no-install` creates the same valid
project and leaves installation as the first reported next step. Generated and
initialized Programs always use the published package ranges embedded in the
CLI; repository layout never changes dependency meaning.

## Saying something to a program you start

```bash
phresh dev --run-option-path=/notes.md --run-option-line=42
```

Read back by name, on either half:

```ts
const path = await current.option("path")
```

**Options are text, all of them.** An option must mean the same thing
however the process was started, and a command line can only hand over
text — a number made here would be a guess about your program's meaning
by the one party with no way to know it. Is `--run-option-id=007` seven,
or a string with two noughts in front? Only your program knows, so your
program decides: `Number(...)`, once, where the meaning is.

Which is what argv and the environment have always been, for the same
reason. The prefix is long because these share a line with the tool's
own flags, and a program wanting an option called `client` should not
have to fight the CLI for the word.

## phresh.config is not a program's configuration

A program's configuration is **derived** from it — three times, and the
derivations differ only in where each half is said to be. That is the
rule everything else here follows from.

It follows that every field which lands in a `program.json` is spelled
the way the contract spells it and crosses untouched: `size`, not a
width and a height; `startCommand`, not a command.

An optional top-level `buildCommand` is authoring metadata. `phresh start`,
`phresh install`, and `phresh pack` run it from this project before consuming
the production files. It never crosses into `program.json` or the system.
`phresh dev` uses the development declarations and does not build.

Everything else is yours: where each half is left.

```ts
import { defineConfig } from "@phreshos/core"

export default defineConfig({

    identity: "file-manager",      // kebab-case: the program's stable address

    name: "File Manager",          // what a person reads

    version: "0.1.0",

    description: "A file manager",

    icon: "icon.png",

    buildCommand: "bun run build",

    server: {

        location: "build/server",

        installCommand: "npm ci",

        startCommand: "node main.js",

        development: {

            startCommand: "tsx server/main.ts"
        }
    },

    client: {

        location: "dist",

        size: { width: "1/2", height: 440 },

        position: { x: 60, y: 40 },

        development: {

            url: "http://localhost:5173",

            startCommand: "bun run dev"
        }
    }
})
```

**`identity` identifies; `name` is read.** The identity is kebab-case
because it is also the directory the system lays your program out in, so
it is a path component before anything else. The name is free-form,
identifies nothing, and absent means the identity serves for both.

`identity`, `version` and `description` begin from your `package.json`
during `init`; the readable `name` is asked for. They are written into
the config rather than read from the manifest later. `pack` says so if
the two versions have drifted apart.

A window's `size` and `position` are finite pixel numbers or linear
expressions. Fractions and percentages are equivalent relative terms, so
`"1/2"` and `"50%"` mean the same thing; pixel offsets may be combined with
them, as in `"50% + 10"`. Every value survives derivation unchanged.

## development — what `phresh dev` needs

`phresh init` offers to configure development for each declared half. It uses
the project's `dev` script as a suggested command when one exists, but records
nothing unless the author chooses it. If development is left unconfigured,
`phresh dev` refuses and names the declarations it needs:

```
Nothing here says how this program is developed.

Say how the server runs or where the client is served:

    server: { …, development: { startCommand: "tsx source/server/main.ts" } }
    client: { …, development: { url: "http://localhost:5173", startCommand: "bun run dev" } }
```

Each half may carry a `development` block, but the two shapes are deliberately
different. A server block requires `startCommand`; `phresh dev` runs it from the
directory containing `phresh.config.ts`, and that directory becomes the derived
server location. A client block requires an HTTP(S) `url`; development clients
are never resolved from filesystem paths.

The client development shape may also declare `startCommand`. `phresh dev`
runs it from the project directory as a foreground development tool; the
command is never derived into the Program sent to the system. The tool and
the attached Program share one lifetime, so ending either ends the other.

Before launching the Program, `phresh dev` waits up to 15 seconds for the client
development URL to respond. While it remains unavailable, the URL is printed
every two seconds. A command that exits first is reported immediately. This
means the window is never deliberately opened onto a client that the authoring
tool already knows is unavailable.

## init

`phresh init` turns an existing package into a Program project. It reads the
identity, version, and description from `package.json`, ensures the project has
the matching `@phreshos/core` development dependency, and writes the typed
`phresh.config.ts` authoring description.

In a terminal, `init` asks for the production locations and commands needed by
`start` and `install`, including whether a package build should prepare those
locations. It then offers the development command and URL needed by `dev`.
Existing `build` and `dev` package scripts become editable suggestions, never
silent assumptions. A single Endpoint defaults to `dist`; when both Endpoints
exist, their defaults are `dist/server` and `dist/client`. API documentation is
opt-in and defaults to disabled even when a likely document already exists.

Outside a terminal it never waits for input; the same values are supplied as
named options:

```bash
phresh init --client \
    --client-location dist \
    --build-command "bun run build" \
    --client-development-url http://localhost:5173 \
    --client-development-start-command "bun run dev"

phresh init --server \
    --server-location dist \
    --server-start-command "node main.js"
```

Use `phresh init --help` for the complete option list. An existing config is
never replaced silently: a terminal asks, while automation must say `--force`.

A Program must declare a Server endpoint, a Client endpoint, or both. Neither is
refused during the interview rather than at the border, which is the
earliest place it can be refused.

The final `Next` line is derived from the resulting config. It always shows
`phresh start` and `phresh install`; it shows `phresh dev` only when at least
one Endpoint received a development declaration.

Visual and advanced runtime defaults remain for the author to add deliberately:
`icon`, `size`, `position`, `installCommand`, `start`, layers, and minimization
are not guessed. An omitted `start` is `true`; only a default-off Endpoint needs to
say `start: false`.

## start and dev

Both **run your program without installing it, and stay attached.** They
print the `program.json` it will be declared as, hand that to the system
through the socket below the selected system home. With no override, that is
`~/.phreshos/intake.sock`. Set `PHRESHOS_HOME` to an absolute system home to
address another system instance; the CLI derives
`<PHRESHOS_HOME>/intake.sock` from it. The socket is not selected
separately from its instance. Only your account can open it, so nothing is
sent to prove anything, and then the command holds.

**The connection is the tether, in both directions.** Ctrl-C and your
program stops. Close the window it opened and the command returns, with
your program's own exit status as its own. Its `stdout` and `stderr`
arrive in your terminal as well as its system log. The system always
drains a server process; attachment adds the terminal as an audience
rather than changing how the process starts.

Nothing has to promise to clean up, which is the point — a promise would
not survive `kill -9`, a closed terminal, or a dropped ssh session. All
three end the command without running a line of it, and all three still
close the socket, which is what the system is watching.

**Attached means not installed; installed means persistent.** A program
meant to outlive your terminal is installed rather than run.

The run is registered as an ordinary uninstalled Program under the identity
declared by this project. Before registration, the system ends and forgets any
runtime Program already using that identity, whether it was installed or
uninstalled. Forgetting never uninstalls: installed files and storage remain
untouched while the attached Program becomes the sole runtime occupant. Its
root process tethers the whole Program to this command; when it exits, remaining
processes end and the runtime record disappears. A later `phresh install` can
replace the preserved installed files and immediately register the identity as
installed again. If no system is listening, the intake says so plainly rather
than exposing `ENOENT`.

An attached Program still owns persistent project storage. The authoring tool
declares `<project>/storage` explicitly, so `start` and `dev` keep the same
database, store, data, cache, and logs as any other runtime form without
inventing a path from the system's working directory. Installation changes
where Program files are laid out; it does not change the logging contract.

They are one derivation over one config, differing only in where each
half is said to be:

| | locations from | derived form |
|---|---|---|
| `pack` | `location` | none — the system lays an installed program out |
| `start` | `location` | absolute |
| `dev` | project root for a declared server development block; `development.url` for a declared client block | server absolute, client URL |

Every derived filesystem path is absolute because relative paths resolve
against the `program.json` they were read from, and a derived one does not live
beside your source. A client development URL remains the URL the author wrote.

## install

**A program has two ways of being used: run it, or install it.**

```bash
phresh install   # this project, laid out on this machine
```

**It takes no package, and neither does the system.** What is sent is
the description this directory derives, and the system copies what it
names into place — your program's parts are already on this disk at the
locations it names, so there is nothing an archive would carry that the
description does not already point at. `phresh pack` is for when you have
somewhere to send a program; installing here is a different act.

If `buildCommand` is declared, it completes successfully before anything is
sent to the system. Without it, install uses the production files exactly as
they stand.

Installing is the persistent one — laid out under `~/.phreshos/programs/<identity>`,
marked installed, and reconstructed after a restart. Running is the other one:
`phresh start` / `phresh dev` register it under its declared identity and
attach its whole lifetime to your terminal.

The command installs through the machine's local intake. A running
Program may also install itself through the server SDK; installation is not a
client capability.

That is also why it names **paths** rather than sending bytes: install
used to want an upload because the installer was a browser, which has
bytes and no path. You have the paths.

## uninstall

```bash
phresh uninstall
phresh uninstall --everything
```

Ordinary uninstall removes the installed Program files while preserving its
running Processes, stored data, and runtime Program. `--everything` explicitly
ends those Processes, removes everything the system owns for the Program, and
forgets its runtime record.

The identity comes from this project's `phresh.config.ts`; the command does not
accept an arbitrary Program identity.

## What pack produces

`pack` takes what is at each half's `location` and writes
`<identity>@<version>.zip`. Your program may leave its halves anywhere; the
package always keeps them in the same places, so the artifact's shape
belongs to the contract rather than to your project. That is why the
`program.json` it writes names `server` and `client` explicitly — those
are the canonical locations the package just created. An explicit
`start: false` crosses with its half; an omitted value remains omitted
and means `true`. At least one declared half must resolve to true.

There is **no wrapping directory**: `program.json`, `server/`, `client/`,
optional `icon.png`, and declared `server-docs.md` or `client-docs.md` sit at
the package's root. The system names the directory it installs into from your
program's `identity`. Endpoint Service documentation is installed with its
Program so its policies can be inspected before the Endpoint starts.

Nothing about the system moves because this exists. `program.json` is
still the only thing the system reads, and a package assembled by hand
is still a package. This just means you do not have to.
