import { connect } from "node:net"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"

/**
 * The local Program intake, from the CLI's side.
 *
 * A socket file rather than a port, because the file's permissions are
 * the authorization: only the account that owns this machine can open
 * it, and that account is exactly who may run and install programs on
 * it. Nothing is sent to prove anything, because being able to connect
 * is the proof.
 *
 * A message is a line. Closing our own side to mark the end of a
 * question would make lifetime ambiguous. A line delimiter keeps the
 * connection available for the stream of events that follows a launch.
 *
 * One question, then events until the system closes. Installation confirms
 * each requested outcome — laid out, startup enabled, running — and then
 * ends. Uninstalling says one thing and ends; an attached run says how it
 * began, whatever the Program says, and how it ended. None pretends to be a
 * remote method returning through an unrelated transport.
 */
export function programIntakePath(environment: NodeJS.ProcessEnv = process.env, userHome = homedir()) {

    const instanceHome = environment.PHRESHOS_HOME

    if (instanceHome === undefined) return join(userHome, ".phreshos", "intake.sock")

    if (!isAbsolute(instanceHome)) throw new Error("PHRESHOS_HOME must be an absolute filesystem path")

    return join(instanceHome, "intake.sock")
}

export const socketPath = programIntakePath()

export default function speak(question: unknown, heard: (event: Event) => void, path = socketPath, signal?: AbortSignal) {

    return new Promise<void>(function (settle, refuse) {

        const socket = connect(path)

        let said = ""

        let failed: Error | null = null

        let aborted = false

        const abort = () => {

            aborted = true

            socket.destroy()
        }

        if (signal?.aborted) abort()

        else signal?.addEventListener("abort", abort, { once: true })

        socket.on("connect", () => socket.write(JSON.stringify(question) + "\n"))

        socket.on("data", function (chunk) {

            said += String(chunk)

            const lines = said.split("\n")

            said = lines.pop() ?? ""

            for (const line of lines) if (line.trim()) {

                const event = JSON.parse(line) as Event

                if (event.event === "error") failed = new Error(String(event.message))

                else heard(event)
            }
        })

        // The system is not running, or is running as somebody else. Said
        // plainly, because "ENOENT" is not what went wrong from here.
        socket.on("error", () => { if (!aborted) refuse(new Error(`No system is listening at ${path} — start one, or check that it is yours`)) })

        socket.on("close", () => {

            signal?.removeEventListener("abort", abort)

            if (aborted) refuse(new Error("The attached launch was stopped"))

            else if (failed) refuse(failed)

            else settle()
        })
    })
}

export interface Event {

    event?: string

    [key: string]: unknown
}
