import { gatewayPath, streamProgram } from "./gateway.ts"

/**
 * Run a program on this machine's system, and stay with it.
 *
 * **The connection is the tether, in both directions.** While it is open
 * the program runs; when it closes the system stops the program. So this
 * does not have to promise to clean up, and could not be trusted if it
 * did: a `kill -9`, a closed terminal and a dropped ssh session all end
 * this process without running a line of it, and every one of them still
 * closes the socket. The other direction is the same fact from the other
 * end — when the program ends, the system says so and closes, and this
 * resolves with the program's own status.
 */
export default async function attach(program: unknown, options: Record<string, string> = {}, watching: Watching = {}, path = gatewayPath(), signal?: AbortSignal) {

    let ended: Ended | null = null

    await streamProgram({ word: "run", program, options }, function (event) {

        if (event.event === "started") watching.started?.(String(event.process))

        if (event.event === "output") watching.output?.(event.stream === "err" ? "err" : "out", String(event.text))

        if (event.event === "exited") ended = { code: (event.code ?? null) as number | null, signal: (event.signal ?? null) as string | null }

    }, path, signal)

    // Closed with no ending said: the system went away while the program
    // was running, which is a different thing from the program ending.
    if (!ended) throw new Error("The system closed before the program ended")

    return ended as Ended
}

export interface Watching {

    started?: (identity: string) => void

    output?: (stream: "out" | "err", text: string) => void
}

export interface Ended {

    code: number | null

    signal: string | null
}
