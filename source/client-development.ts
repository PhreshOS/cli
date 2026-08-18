import { spawn, type ChildProcess } from "node:child_process"
import { connect } from "node:net"
import { line } from "./style.ts"
import commandEnvironment from "./command-environment.ts"

const timeout = 15_000

const reportEvery = 2_000

const pollEvery = 200

const clientOrigin = "null"

/** A client development command owned by one `phresh dev` session. */
export interface ClientDevelopmentCommand {

    readonly exited: Promise<CommandExit>

    readonly stopping: boolean

    stop(): Promise<void>
}

/** Refuse to start an owned command over a URL already served by something else. */
export async function assertClientDevelopmentUrlFree(url: string) {

    if (!await occupied(url)) return

    throw new Error(`Client development URL is already in use: ${url}`)
}

function occupied(url: string) {

    const location = new URL(url)

    const port = Number(location.port || (location.protocol === "https:" ? 443 : 80))

    return new Promise<boolean>(resolve => {

        const socket = connect({ host: location.hostname, port })

        let settled = false

        const settle = (value: boolean) => {

            if (settled) return

            settled = true

            socket.destroy()

            resolve(value)
        }

        socket.setTimeout(500)

        socket.once("connect", () => settle(true))

        socket.once("error", () => settle(false))

        socket.once("timeout", () => settle(false))
    })
}

interface CommandExit {

    code: number | null

    signal: NodeJS.Signals | null

    error: Error | null
}

/** Start the author's client tool without making it part of ProgramConfig. */
export function startClientDevelopment(command: string | undefined, directory: string): ClientDevelopmentCommand | null {

    if (!command) return null

    const child = spawn(command, {

        cwd: directory,

        env: commandEnvironment(directory),

        shell: true,

        stdio: "inherit",

        // The command and everything it starts are one owned tool. A Vite
        // child must not survive after the shell that launched it is gone.
        detached: true
    })

    let result: CommandExit | null = null

    let stopping = false

    let stoppingTask: Promise<void> | null = null

    let settle: (exit: CommandExit) => void = () => undefined

    const exited = new Promise<CommandExit>(resolve => { settle = resolve })

    const finish = (exit: CommandExit) => {

        if (result) return

        result = exit

        settle(exit)
    }

    child.once("error", error => finish({ code: null, signal: null, error }))

    child.once("exit", (code, signal) => finish({ code, signal, error: null }))

    return {

        exited,

        get stopping() { return stopping },

        async stop() {

            if (!stoppingTask) {

                stopping = true

                stoppingTask = (async () => {

                    if (!running(child)) return

                    terminate(child, "SIGTERM")

                    await waitUntilStopped(child, 1_000)

                    if (running(child)) terminate(child, "SIGKILL")

                    await waitUntilStopped(child, 1_000)
                })()
            }

            await stoppingTask
        }
    }
}

/** Wait for the exact client URL that the derived Program will open. */
export async function waitForClientDevelopment(url: string, command: ClientDevelopmentCommand | null, waiting = timeout, reporting = reportEvery) {

    const began = Date.now()

    let nextReport = began + reporting

    const commandEnded = command?.exited.then(exit => { throw commandFailure(exit) })

    while (Date.now() - began < waiting) {

        const availability = await inspect(url, waiting - (Date.now() - began))

        if (availability === "ready") return

        if (availability === "cors-blocked") {

            throw new Error([

                `Client development URL responded, but does not allow the sandboxed Client origin: ${url}`,

                `Enable CORS so the response includes Access-Control-Allow-Origin: * (for Vite, use server: { cors: true }).`

            ].join("\n"))
        }

        const now = Date.now()

        if (now >= nextReport) {

            line("waiting for", url)

            while (nextReport <= now) nextReport += reporting
        }

        const remaining = waiting - (Date.now() - began)

        if (remaining <= 0) break

        await Promise.race([

            pause(Math.min(pollEvery, remaining)),

            ...(commandEnded ? [commandEnded] : [])
        ])
    }

    const seconds = waiting / 1_000

    throw new Error(`Client development URL did not respond within ${seconds} ${seconds === 1 ? "second" : "seconds"}: ${url}`)
}

export function commandFailure(exit: CommandExit) {

    if (exit.error) return new Error(`Client development command failed: ${exit.error.message}`)

    if (exit.signal) return new Error(`Client development command ended on ${exit.signal}`)

    return new Error(`Client development command exited with ${exit.code ?? 0}`)
}

async function inspect(url: string, remaining: number): Promise<"unavailable" | "cors-blocked" | "ready"> {

    try {

        const response = await fetch(url, {

            headers: { origin: clientOrigin },

            signal: AbortSignal.timeout(Math.max(1, Math.min(500, remaining)))
        })

        const allowedOrigin = response.headers.get("access-control-allow-origin")?.trim()

        await response.body?.cancel()

        return allowedOrigin === "*" || allowedOrigin === clientOrigin ? "ready" : "cors-blocked"
    }

    catch { return "unavailable" }
}

function terminate(child: ChildProcess, signal: NodeJS.Signals) {

    if (!child.pid) return

    try { process.kill(-child.pid, signal) }

    catch { child.kill(signal) }
}

function running(child: ChildProcess) {

    if (!child.pid) return false

    try {

        process.kill(-child.pid, 0)

        return true
    }

    catch { return child.exitCode === null && child.signalCode === null }
}

async function waitUntilStopped(child: ChildProcess, milliseconds: number) {

    const deadline = Date.now() + milliseconds

    while (running(child) && Date.now() < deadline) await pause(20)
}

function pause(milliseconds: number) {

    return new Promise(resolve => setTimeout(resolve, milliseconds))
}
