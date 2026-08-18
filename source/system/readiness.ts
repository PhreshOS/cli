import { connect } from "node:net"

export async function intakeReady(path: string) {

    return await new Promise<boolean>(function (settle) {

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

            settle(ready)
        }
    })
}

export async function waitForIntake(path: string, running: () => Promise<boolean>, timeout = 15_000) {

    const until = Date.now() + timeout

    while (Date.now() < until) {

        if (await intakeReady(path)) return

        if (!await running()) throw new Error("The PhreshOS System stopped before its intake became ready")

        await new Promise(settle => setTimeout(settle, 100))
    }

    throw new Error(`The PhreshOS System did not become ready within ${Math.ceil(timeout / 1000)} seconds`)
}
