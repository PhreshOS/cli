import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import LinuxSystemService from "../dist/system/service/linux.js"
import { test } from "vitest"

test.skipIf(process.platform !== "linux")("Linux containers without systemd run one detached user service", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-container-service-"))

    const entry = join(temporary, "service.mjs")

    const output = join(temporary, "state", "service.log")

    const launcher = join(temporary, "launch.mjs")

    const shim = async () => ({

        code: 0,

        stdout: '"systemd" is not running in this container due to its overhead.\n',

        stderr: ""
    })

    const service = new LinuxSystemService(temporary, shim)

    try {

        await writeFile(entry, "setInterval(() => undefined, 1000)\n")

        const implementation = pathToFileURL(resolve("dist/system/service/background.js")).href

        await writeFile(launcher, `import Service from ${JSON.stringify(implementation)}\nconst service = new Service(${JSON.stringify(temporary)})\nawait service.register(${JSON.stringify({ executable: process.execPath, entry, arguments: [], directory: temporary, output })})\nawait service.start()\n`)

        execFileSync(process.execPath, [launcher])

        const running = await service.inspect()

        assert.equal(running.running, true)

        assert.equal(running.automaticStartup, false)

        assert.equal(running.enabled, false)

        assert.equal(typeof running.pid, "number")

        await assert.rejects(service.enable(), /Automatic System startup is unavailable/)

        await service.stop()

        assert.equal((await service.inspect()).running, false)

        await service.unregister()

        assert.equal((await service.inspect()).registered, false)
    }

    finally {

        await service.unregister().catch(() => undefined)

        await rm(temporary, { recursive: true, force: true })
    }
})
