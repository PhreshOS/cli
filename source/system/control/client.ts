import type { SystemControlClient, SystemControlRequest } from "@phreshos/core"
import { connect } from "node:net"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import { localAddress } from "../../intake-address.ts"

/** Owner-local client for the authoritative System control contract. */
export default class LocalSystemControl implements SystemControlClient {

    public constructor(private readonly path = controlPath()) {}

    public execute(request: SystemControlRequest, signal?: AbortSignal) {

        return new Promise<unknown>((resolve, reject) => {

            const socket = connect(this.path)
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
            socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`))
            socket.on("data", function (chunk) {

                buffer += String(chunk)

                const boundary = buffer.indexOf("\n")

                if (boundary < 0) return

                let outcome: Outcome

                try { outcome = JSON.parse(buffer.slice(0, boundary)) as Outcome }
                catch { return finish(() => reject(new Error("The System returned an invalid control response"))) }

                if (outcome.success) finish(() => resolve(outcome.result))
                else finish(() => reject(new Error(outcome.error)))
            })
            socket.on("error", () => finish(() => reject(new Error(`No System control interface is listening at ${this.path} — start PhreshOS first`))))
            socket.on("close", () => finish(() => reject(new Error("The System closed the control request without an answer"))))

            if (signal?.aborted) cancel()
        })
    }
}

export function controlPath(environment: NodeJS.ProcessEnv = process.env, userHome = homedir()) {

    const selected = environment.PHRESHOS_HOME
    const storage = selected === undefined ? join(userHome, ".phreshos") : selected

    if (!isAbsolute(storage)) throw new Error("PHRESHOS_HOME must be an absolute filesystem path")

    return localAddress(storage, "control")
}

type Outcome = Readonly<{ success: true, result: unknown }> | Readonly<{ success: false, error: string }>
