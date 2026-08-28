import derive, { type Which } from "./derive.ts"
import { readConfig } from "./project.ts"
import { dim, heading, line } from "./style.ts"
import { relative } from "node:path"
import attach from "./attach.ts"
import { assertClientDevelopmentUrlFree, commandFailure, startClientDevelopment, waitForClientDevelopment } from "./client-development.ts"
import build from "./build-command.ts"

/**
 * Run this program, without installing it, and stay with it.
 *
 * `phresh start` and `phresh dev` are the same act over the same
 * derivation, differing only in where each half is said to be — what the
 * build left, or where the source is.
 *
 * What the derivation produced is shown before it is sent, because it is
 * worth seeing rather than inferring from what happens next. Shown, not
 * dumped: the whole program.json is a wall of braces an author already
 * knows, and what they cannot know at a glance is which of their two
 * answers each half took. So each half says where it came from, and a
 * path is shortened back to the form they typed — the absolute one is
 * the machine's business, and they are standing in the directory it is
 * relative to.
 *
 * Nothing is installed. This local project is authoritative for attached
 * use of its declared identity: the system ends and forgets any runtime
 * Program already there, then registers this run as the sole uninstalled
 * occupant. Installed files and storage are not removed. Its root process
 * tethers the whole replacement to this command: when the process ends, the
 * registry record and any remaining processes go too.
 * **Attached means not installed; installed means persistent** — a
 * program meant to outlive a terminal is installed rather than run.
 *
 * A client development command belongs to this local authoring session,
 * never to the Program sent to the system. The declared client location
 * has to become reachable before that Program is launched, so the first
 * window does not open onto a destination already known to be absent.
 *
 * Its output arrives here because it has somewhere to arrive: the system
 * pipes a launched program only when someone is listening, and this is
 * the someone.
 */
export default async function launch(which: Which, directory = process.cwd(), options: Record<string, string> = {}) {

    const config = await readConfig(directory)

    if (which === "production") await build(config, directory)

    const program = derive(config, directory, which)

    const clientDevelopmentConfig = which === "development" && program.client && (program.client.start ?? true)

        ? config.client?.development

        : undefined

    const clientStartCommand = clientDevelopmentConfig?.startCommand

    heading(`${program.name ?? program.identity}${program.version ? ` ${program.version}` : ""}`, which)

    if (program.server) line(program.server.startCommand ? "server" : "server worker", String(program.server.startCommand ?? program.server.entryFile), place(directory, program.server.location))

    if (program.client) line("client", clientStartCommand ?? place(directory, program.client.location), clientStartCommand ? place(directory, program.client.location) : undefined)

    line("storage", place(directory, String(program.storage)))

    console.log("")

    if (clientStartCommand && program.client) await assertClientDevelopmentUrlFree(program.client.location)

    const clientDevelopment = clientDevelopmentConfig

        ? startClientDevelopment(clientStartCommand, directory)

        : null

    const controller = new AbortController()

    let signalled = false

    const stopOnSignal = () => {

        if (signalled) return

        signalled = true

        controller.abort()

        void (clientDevelopment?.stop() ?? Promise.resolve()).finally(() => process.exit(130))
    }

    // A signal ends this command, and ending this command closes the
    // socket, and closing the socket stops the program. A client development
    // command is another child of the same session, so it is ended first.
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, stopOnSignal)

    let status = 0

    try {

        if (clientDevelopmentConfig && program.client) await waitForClientDevelopment(program.client.location, clientDevelopment)

        if (Object.keys(options).length) line("options", Object.entries(options).map(([name, value]) => `${name}=${value}`).join("  "))

        const attachment = attach(program, options, {

            started: identity => console.log(`${clientDevelopment ? "\n" : ""}  ${dim("running as")} ${identity}\n`),

            output: (stream, text) => (stream === "err" ? process.stderr : process.stdout).write(text)
        }, undefined, controller.signal)

        const ended = clientDevelopment ? await Promise.race([

            attachment,

            clientDevelopment.exited.then(exit => {

                if (clientDevelopment.stopping) return new Promise<never>(() => undefined)

                controller.abort()

                throw commandFailure(exit)
            })

        ]) : await attachment

        console.log(`\n  ${dim(ended.signal ? `ended on ${ended.signal}` : `ended with ${ended.code ?? 0}`)}\n`)

        status = ended.signal ? 128 : ended.code ?? 0
    }

    finally {

        for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, stopOnSignal)

        await clientDevelopment?.stop()
    }

    // Its status is this command's status: whoever ran the program is
    // owed what the program said on the way out.
    process.exit(status)
}

// A URL as written; a path as the author typed it.
function place(directory: string, where: string) {

    return /^https?:\/\//i.test(where) ? where : `./${relative(directory, where)}`
}
