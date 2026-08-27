import { connect } from "node:net"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import intakeAddress from "./intake-address.ts"

/**
 * Speak to the owner-local Program intake.
 *
 * One line carries the request. Installation and attached execution may emit
 * multiple events; the System closes the connection when the operation ends.
 */
export function programIntakePath(environment: NodeJS.ProcessEnv = process.env, userHome = homedir()) {

    const instanceHome = environment.PHRESHOS_HOME

    if (instanceHome === undefined) return intakeAddress(join(userHome, ".phreshos"))

    if (!isAbsolute(instanceHome)) throw new Error("PHRESHOS_HOME must be an absolute filesystem path")

    return intakeAddress(instanceHome)
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
