import { connect } from "node:net"

export async function gatewayReady(path: string) {

    return await new Promise<boolean>(function (resolve) {

        const socket = connect(path)
        const timeout = setTimeout(() => finish(false), 500)
        let finished = false

        socket.once("connect", () => finish(true))
        socket.once("error", () => finish(false))

        function finish(ready: boolean) {

            if (finished) return
            finished = true
            clearTimeout(timeout)
            socket.destroy()
            resolve(ready)
        }
    })
}

export async function waitForGateway(path: string, running: () => Promise<boolean>, timeout = 15_000) {

    const until = Date.now() + timeout

    let observedRunning = false

    while (Date.now() < until) {

        if (await gatewayReady(path)) return

        const isRunning = await running()

        if (observedRunning && !isRunning) throw new Error("The PhreshOS System stopped before its gateway became ready")

        observedRunning ||= isRunning

        await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`The PhreshOS System did not become ready within ${Math.ceil(timeout / 1000)} seconds`)
}
