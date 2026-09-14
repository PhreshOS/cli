import { expect, onTestFinished, test } from "vitest"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, parse } from "node:path"
import SystemInstallation from "../dist/system/installation.js"
import SystemLifecycle from "../dist/system/lifecycle.js"

test("System purge removes only the selected persistent home", async context => {
    const directory = await mkdtemp(join(tmpdir(), "phresh-system-purge-"))
    context.onTestFinished(() => rm(directory, { recursive: true, force: true }))
    const storage = join(directory, "data")
    const root = join(directory, "installation")
    await mkdir(storage)
    await mkdir(root)
    await writeFile(join(storage, "saved.txt"), "data")
    await writeFile(join(root, "keep.txt"), "installation")
    await new SystemInstallation({ storage, root }).purgeStorage()
    expect(existsSync(storage)).toBe(false)
    expect(existsSync(join(root, "keep.txt"))).toBe(true)
    for (const unsafe of [parse(directory).root, homedir(), directory, root]) {
        await expect(new SystemInstallation({ storage: unsafe, root }).purgeStorage()).rejects.toThrow("cannot be purged")
    }
})

test.each([false, true])("System install and uninstall pass the purge decision at the stopped-service boundary: %s", async purge => {
    const directory = await mkdtemp(join(tmpdir(), "phresh-system-purge-order-"))
    onTestFinished(() => rm(directory, { recursive: true, force: true }))
    const events = []
    let running = true
    let current
    const installed = { version: "0.1.0", digest: "a".repeat(64), directory: "/installation/releases/0.1.0", installedAt: "now" }
    const installation = {
        paths: { root: join(directory, "installation"), current: join(directory, "current"), storage: join(directory, "state"), gateway: join(directory, "gateway"), log: join(directory, "service.log"), homeRequest: join(directory, "home-request"), portRequest: join(directory, "port-request") },
        async exclusive(work) { return work() },
        async current() { return current },
        async prepare(release) { events.push("prepare"); return { release, directory: "/staging" } },
        async purgeStorage() { expect(running).toBe(false); events.push("purge") },
        async activate() {
            events.push("activate"); current = installed
            return { installed, async commit() { events.push("commit") }, async rollback() {} }
        },
        async remove() { events.push("remove") }
    }
    const service = {
        async inspect() { return { registered: true, automaticStartup: false, enabled: false, running } },
        async stop() { running = false; events.push("stop") },
        async start() { running = true; events.push("start") },
        async register() {}, async unregister() { events.push("unregister") }, async disable() {}
    }
    const lifecycle = new SystemLifecycle({
        installation, service,
        async resolveRelease() { return { version: "0.1.0" } },
        async downloadRelease(value) { return value },
        async ready() { return running }, async wait() {}, async provisionSetup() { events.push("setup") }
    })
    await lifecycle.install({ purge })
    expect(events).toEqual(["prepare", "stop", ...(purge ? ["purge"] : []), "activate", "start", "commit", "setup"])
    events.length = 0
    await lifecycle.uninstall({ purge })
    expect(events).toEqual(["stop", "unregister", ...(purge ? ["purge"] : []), "remove"])
})
