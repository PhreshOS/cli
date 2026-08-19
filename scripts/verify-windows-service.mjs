import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import WindowsSystemService from "../dist/system/service/windows.js"

if (process.platform !== "win32") throw new Error("The Windows service verifier must run on Windows")

const temporary = await mkdtemp(join(tmpdir(), "phresh-windows-service-"))

const entry = join(temporary, "service.mjs")

const output = join(temporary, "state with spaces", "service.log")

const service = new WindowsSystemService(temporary, undefined, `PhreshOS Verify ${process.pid}`)

try {

    await writeFile(entry, "console.log('ready'); setInterval(() => undefined, 1000)\n")

    await service.register({ executable: process.execPath, entry, directory: temporary, output })

    await service.disable()

    await service.start()

    await waitFor(async () => (await service.inspect()).running)

    const running = await service.inspect()

    assert.equal(running.enabled, false)

    await service.stop()

    assert.equal((await service.inspect()).running, false)

    await service.enable()

    assert.equal((await service.inspect()).enabled, true)

    console.log("Verified the Windows scheduled-task service lifecycle")
}

finally {

    await service.unregister().catch(() => undefined)

    await rm(temporary, { recursive: true, force: true })
}

async function waitFor(predicate) {

    const until = Date.now() + 10_000

    while (Date.now() < until) {

        if (await predicate()) return

        await new Promise(settle => setTimeout(settle, 100))
    }

    throw new Error("The temporary Windows scheduled task did not enter the expected state")
}
