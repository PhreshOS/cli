import { createHash } from "node:crypto"
import { connect } from "node:net"
import { join } from "node:path"
import phreshosHome from "./home.ts"

/** Resolve the one owner-local gateway address for the selected System home. */
export function gatewayPath(home = phreshosHome(), platform = process.platform) {

    if (platform !== "win32") return join(home, "gateway.sock")

    const owner = home.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()
    const identity = createHash("sha256").update(owner).digest("hex").slice(0, 32)

    return `\\\\.\\pipe\\phreshos-${identity}-gateway`
}

/** Stream one Program lifecycle request over the shared gateway. */
export function streamProgram(request: unknown, heard: (event: GatewayEvent) => void, path = gatewayPath(), signal?: AbortSignal) {

    return new Promise<void>(function (resolve, reject) {

        const socket = connect(path)
        let buffer = ""
        let failure: Error | null = null
        let cancelled = false
        const cancel = () => {

            cancelled = true
            socket.destroy()
        }

        if (signal?.aborted) cancel()
        else signal?.addEventListener("abort", cancel, { once: true })

        socket.on("connect", () => socket.write(`${JSON.stringify({ target: "program", request })}\n`))
        socket.on("data", function (chunk) {

            buffer += String(chunk)

            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) if (line.trim()) {

                const event = JSON.parse(line) as GatewayEvent

                if (event.event === "error") failure = new Error(String(event.message))
                else heard(event)
            }
        })
        socket.on("error", () => {

            if (!cancelled) reject(new Error(`No System gateway is listening at ${path} — start PhreshOS first`))
        })
        socket.on("close", () => {

            signal?.removeEventListener("abort", cancel)

            if (cancelled) reject(new Error("The attached launch was stopped"))
            else if (failure) reject(failure)
            else resolve()
        })
    })
}

/** Execute one short request over the shared gateway. */
export function requestSystem(request: unknown, path = gatewayPath(), signal?: AbortSignal) {

    return new Promise<unknown>((resolve, reject) => {

        const socket = connect(path)
        let buffer = ""
        let settled = false
        const finish = (work: () => void) => {

            if (settled) return
            settled = true
            signal?.removeEventListener("abort", cancel)
            socket.destroy()
            work()
        }
        const cancel = () => finish(() => reject(signal?.reason instanceof Error ? signal.reason : new Error("The request was cancelled")))

        signal?.addEventListener("abort", cancel, { once: true })
        socket.on("connect", () => socket.write(`${JSON.stringify({ target: "system", request })}\n`))
        socket.on("data", function (chunk) {

            buffer += String(chunk)

            const boundary = buffer.indexOf("\n")

            if (boundary < 0) return

            let outcome: Outcome

            try { outcome = JSON.parse(buffer.slice(0, boundary)) as Outcome }
            catch { return finish(() => reject(new Error("The System returned an invalid gateway response"))) }

            if (outcome.success) finish(() => resolve(outcome.result))
            else finish(() => reject(new Error(outcome.error)))
        })
        socket.on("error", () => finish(() => reject(new Error(`No System gateway is listening at ${path} — start PhreshOS first`))))
        socket.on("close", () => finish(() => reject(new Error("The System closed the gateway request without an answer"))))

        if (signal?.aborted) cancel()
    })
}

export interface GatewayEvent {

    event?: string
    [key: string]: unknown
}

type Outcome = Readonly<{ success: true, result: unknown }> | Readonly<{ success: false, error: string }>
