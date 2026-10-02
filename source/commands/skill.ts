import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { textOutput } from "./schemas.ts"

/**
 * What an agent needs before its first command: what PhreshOS is, what it is about to operate, and
 * where to look next. It explains the ideas; the exact contracts stay with `--help`, `describe`,
 * and each Program's own agent documentation, so this text never has to follow them.
 */
export const skill = `# PhreshOS

PhreshOS is an operating system for programs built with web technology. It
runs as a service on this machine, the System, for one owner: the user of
this machine who installed it. Its Programs run inside it, and the owner uses
them from the Desktop, in a browser. You use the same Programs, through
\`phresh\`, at the same time as the owner.

## You act as the owner

\`phresh\` speaks to the System with the owner's full authority. Nothing you
ask is limited for you, so what you do is done as if the owner did it. Read
before you change; confirm with the owner before anything they cannot undo,
such as removing a Program, deleting data, or ending what they are using.

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

## Programs are how you work

What a System can do is what its Programs offer. To do something, find the
Program that offers it, read its agent documentation, then use it the way it
says, usually by asking one of its Services:

    phresh program list
    phresh program agent --program <identity>
    phresh service ask --program <identity> --process <name> --endpoint server --event <event>

Use what a Program offers rather than going around it: the owner sees and
relies on the same Programs. When no Program offers what you need, the System's
own operations are reachable through \`phresh execute\`; \`phresh operation
list\` names them.

## Do not guess

Every command explains itself. \`phresh <command> --help\` describes one;
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
