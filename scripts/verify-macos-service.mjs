import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import MacOSSystemService from "../dist/system/service/macos.js"

if (process.platform !== "darwin") throw new Error("The macOS service verifier must run on macOS")

const temporary = await mkdtemp(join(tmpdir(), "phresh-macos-service-"))

const label = `com.phreshos.system.verify.${process.pid}`

const entry = join(temporary, "service.mjs")

const output = join(temporary, "service.log")

const service = new MacOSSystemService(temporary, undefined, label)

try {

    await writeFile(entry, "console.log('ready'); setInterval(() => undefined, 1000)\n")

    await service.register({ executable: process.execPath, entry, directory: temporary, output })

    await service.start()

    await waitFor(async () => (await service.inspect()).running)

    const running = await service.inspect()

    assert.equal(running.enabled, true)

    await service.stop()

    const stopped = await service.inspect()

    assert.equal(stopped.running, false)

    assert.equal(stopped.enabled, true)

    console.log("Verified the macOS launchd service lifecycle")
}

finally {

    await service.unregister().catch(() => undefined)

    await rm(temporary, { recursive: true, force: true })
}

async function waitFor(predicate) {

    const until = Date.now() + 5_000

    while (Date.now() < until) {

        if (await predicate()) return

        await new Promise(settle => setTimeout(settle, 50))
    }

    throw new Error("The temporary launchd service did not enter the expected state")
}
