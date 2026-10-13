import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { textOutput } from "./schemas.ts"

/**
 * What an agent needs before its first command: what PhreshOS is, what it is about to operate, and
 * where to look next. It explains the ideas; the exact contracts stay with `--help`, `describe`,
 * and each Program's own agent documentation, so this text never has to follow them.
 */
export const skill = `# PhreshOS

PhreshOS is a self-hosted system for programs built with web technology.
Its core, the System, runs on this machine as a service, on top of the
machine's own operating system, for one owner: the user of this machine who
installed it. Its Programs run inside it, and the owner uses them from the
Desktop, in a browser. You use the same Programs, through \`phresh\`, at the
same time as the owner.

## You act as the owner

\`phresh\` speaks to the System with the owner's full authority. Nothing you
ask is limited for you, so what you do is done as if the owner did it. Read
before you change; confirm with the owner before anything they cannot undo,
such as removing a Program, deleting data, or ending what they are using.

## Do what was asked, the default way

Every option you leave out means "as usual": as the Program declares, as the
owner set it, or the System's default. Add an option only when the request
asks for something different from that.

The examples in \`--help\` show what each option does, one at a time, with a
comment saying why it is there. They are not a recipe: copy an option from an
example only when you need what its comment says. The first example of a
command is its plain use.

## What is in the System

- A **Program** is software installed in the System. Each one describes
  itself, and many carry documentation written for agents.
- A **Process** is one run of a Program. A Program may run many times at once;
  a run can have a name.
- A Process has up to two **Endpoints**: its **Server**, which runs on this
  machine, and its **Client**, its interface, shown as a **Window** on the
  owner's Desktop.
- A **Service** is an Endpoint offered by name, for other Programs and for you
  to talk to: you publish to it, ask it, and listen to it.
- The **System** holds everything around the Programs: who may reach what, the
  files of this machine, the Appearance, and more.

## Open a Program

Start a run with only its identity. Its Server and Client start as its author
declared, the same as when the owner opens it from the Desktop:

    phresh process create --program <identity>

A run is found later by its identity, or by a name you gave it with \`--name\`;
a name always goes with \`--program\`:

    phresh process create --program <identity> --name main
    phresh process inspect --process main --program <identity>

## Programs are how you work

What a System can do is what its Programs offer. To do something, find the
Program that offers it, read its agent documentation, then do what it says:

    phresh program list
    phresh program agent --program <identity>

Use what a Program offers rather than going around it: the owner sees and
relies on the same Programs.

## Requests, as the System understands them

Everything the System does is a request: a JSON object that names its domain
and its operation, with its fields. \`phresh execute\` passes one as it is and
answers with the result as JSON:

    phresh execute '{"$domain":"endpoint","$operation":"ask","program":"<identity>","process":"<name>","endpoint":"server","event":"<event>","input":{}}'

\`phresh operation list\` names every operation, and
\`phresh operation describe --domain <domain> --operation <operation>\` gives
the exact shape of its request and of its answer, as JSON Schema. Look a request
up rather than guessing a field.

A Program's agent documentation states what it offers as these requests. Send
them through \`phresh execute\` as they are written. Most operations also have
a command of their own, such as \`phresh endpoint ask\`; when you know the one
that does the same, you may use it instead. Either way, the System receives the
same request.

## Windows

Windows live on a plane larger than the screen. **0, 0 is the middle of the
plane**, where a Desktop looks when it opens; it is not a screen's top-left
corner, and it stays where it is when the owner moves their view. A Window's
position is its own top-left corner, so a Window at 0, 0 starts in the middle of
the plane.

A number is pixels. A share, such as \`-1/2\`, \`1/2\`, \`50%\`, or \`1/1\`, is
a part of the view, so the Window fits any screen: the view's edges are
\`-1/2\` and \`1/2\`, and shares and pixels combine, as in \`1/2 - 300\`.

    phresh window move --process main --program <identity> --x -450 --y -320    # a 900 x 640 Window, centered
    phresh window set-geometry --process main --program <identity> --x -1/2 --y -1/2 --width 1/2 --height 1/1    # the left half
    phresh window maximize --process main --program <identity>    # the whole view

## Read, then change, then read

Every command answers with the state after it acts; add \`--json\` for the
whole of it as data. Read before you change something the owner uses, and read
again to see the result. To wait for something to happen rather than poll,
each group has a \`wait\` command, which gives up after 10 seconds unless given
\`--timeout\`.

## Do not guess

Every command explains itself. \`phresh <command> --help\` describes one,
with what each option does and what leaving it out means;
\`phresh describe --all --json\` gives the complete contract of every command.
When something fails, the error names what is wrong; read it before trying
again. \`phresh fetch\` shows the running System at a glance.

## Building Programs

A Program is a web project: a Server, a Client, or both, written with the
PhreshOS SDKs. \`phresh create\` starts one. The documentation explains how
Programs are built and how they reach the System:

- https://phreshos.com/docs
- https://phreshos.com/llms.txt (an index of every page, for agents)
`

/** Prints the skill: the starting point for an agent operating PhreshOS. */
export default function skillCommand(program: Command) {
    defineCommand(program, {
        name: "skill",
        description: "explain PhreshOS to an agent before it starts",
        guidance: ["Read it once before working in PhreshOS; it points to everything else."],
        examples: ["phresh skill"],
        output: textOutput("What PhreshOS is, what an agent operates through phresh, and where to look next")
    }, () => {
        console.log(skill)
    })
}
