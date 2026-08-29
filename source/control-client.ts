import type { SystemControlClient, SystemControlRequest } from "@phreshos/core"
import { gatewayAddress, resolveHome } from "@phreshos/node"
import { connect } from "node:net"

/** Owner-local client for the authoritative running-System contract. */
export default class LocalSystemControl implements SystemControlClient {

    public async execute(request: SystemControlRequest, signal?: AbortSignal) {
        const address = gatewayAddress(resolveHome())

        return await new Promise<unknown>((resolve, reject) => {

            const socket = connect(address)

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

            socket.on("data", chunk => {

                buffer += String(chunk)

                const boundary = buffer.indexOf("\n")

                if (boundary < 0) return

                try {

                    const outcome = JSON.parse(buffer.slice(0, boundary)) as Outcome

                    if (outcome.success) finish(() => resolve(outcome.result))

                    else finish(() => reject(new Error(outcome.error)))
                }

                catch { finish(() => reject(new Error("The System returned an invalid response"))) }
            })

            socket.on("error", () => finish(() => reject(new Error(`No System is listening at ${address} — start PhreshOS first`))))

            socket.on("close", () => finish(() => reject(new Error("The System closed the request without an answer"))))

            if (signal?.aborted) cancel()
        })
    }
}

type Outcome = Readonly<{ success: true, result: unknown }> | Readonly<{ success: false, error: string }>
