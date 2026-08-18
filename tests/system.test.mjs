import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import AdmZip from "adm-zip"
import SystemInstallation from "../dist/system/installation.js"
import SystemLifecycle from "../dist/system/lifecycle.js"
import systemPaths from "../dist/system/paths.js"
import { downloadSystemRelease, selectSystemRelease } from "../dist/system/release.js"
import MacOSSystemService from "../dist/system/service/macos.js"
import LinuxSystemService from "../dist/system/service/linux.js"

test("selects the newest complete release from the compatible stable line", function () {

    const selected = selectSystemRelease([

        release("v0.1.1"),

        release("v0.2.0"),

        release("v0.1.4", { prerelease: true }),

        release("v0.1.3"),

        release("v0.1.5", { assets: [] })
    ])

    assert.equal(selected.version, "0.1.3")
})

test("refuses release bytes that do not match the declared filename and digest", async function () {

    const bytes = Buffer.from("system")

    const digest = createHash("sha256").update(bytes).digest("hex")

    const selected = { version: "0.1.0", archive: "https://example.test/archive", checksum: "https://example.test/checksum" }

    const valid = await downloadSystemRelease(selected, async url => new Response(url.endsWith("archive") ? bytes : `${digest}  phreshos@0.1.0.zip\n`))

    assert.equal(valid.digest, digest)

    await assert.rejects(

        downloadSystemRelease(selected, async url => new Response(url.endsWith("archive") ? Buffer.from("changed") : `${digest}  phreshos@0.1.0.zip\n`)),

        /does not match/
    )
})

test("keeps installation files separate from persistent System state", function () {

    const paths = systemPaths("darwin", "/Users/person", { PHRESHOS_HOME: "/temporary" })

    assert.equal(paths.root, "/Users/person/Library/Application Support/PhreshOS/System")

    assert.equal(paths.intake, "/Users/person/.phreshos/intake.sock")
})

test("stages, validates, activates, and reads one production distribution", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-system-installation-"))

    const paths = {

        root: join(temporary, "system"),

        releases: join(temporary, "system", "releases"),

        current: join(temporary, "system", "current"),

        storage: join(temporary, "storage"),

        intake: join(temporary, "storage", "intake.sock"),

        log: join(temporary, "storage", "service.log")
    }

    let dependencies

    const installation = new SystemInstallation(paths, async directory => dependencies = directory)

    try {

        const bytes = distribution()

        const prepared = await installation.prepare({

            version: "0.1.0",

            archive: "archive",

            checksum: "checksum",

            bytes,

            digest: createHash("sha256").update(bytes).digest("hex")
        })

        assert.equal(dependencies, prepared.directory)

        const activation = await installation.activate(prepared, undefined)

        assert.deepEqual(await installation.current(), activation.installed)

        await activation.commit()

        assert.deepEqual(await installation.current(), activation.installed)

        assert.match(await readFile(join(activation.installed.directory, "server", "main.js"), "utf8"), /ready/)
    }

    finally {

        await rm(temporary, { recursive: true, force: true })
    }
})

test("serializes operations that can change installation or service state", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-system-lock-"))

    const paths = {

        root: join(temporary, "system"),

        releases: join(temporary, "system", "releases"),

        current: join(temporary, "system", "current"),

        storage: join(temporary, "storage"),

        intake: join(temporary, "storage", "intake.sock"),

        log: join(temporary, "storage", "service.log")
    }

    const installation = new SystemInstallation(paths, async () => undefined)

    let release

    const held = new Promise(settle => release = settle)

    try {

        const first = installation.exclusive(async () => await held)

        await new Promise(settle => setTimeout(settle, 20))

        await assert.rejects(installation.exclusive(async () => undefined), /Another PhreshOS System operation is running/)

        release()

        await first
    }

    finally {

        await rm(temporary, { recursive: true, force: true })
    }
})

test("rolls installation back when the native service cannot start", async function () {

    const events = []

    let rolledBack = false

    let registered

    const paths = {

        root: "/installation",

        releases: "/installation/releases",

        current: "/installation/current",

        storage: "/state",

        intake: "/state/intake.sock",

        log: "/state/service.log"
    }

    const installation = {

        paths,

        async exclusive(work) { return await work() },

        async current() { events.push("current"); return undefined },

        async prepare(release) { events.push("prepare"); return { release, directory: "/staging" } },

        async abandon() { events.push("abandon") },

        async activate() {

            events.push("activate")

            return {

                installed: { version: "0.1.0", digest: "a".repeat(64), directory: "/installation/releases/0.1.0", installedAt: "now" },

                async commit() { events.push("commit") },

                async rollback() { rolledBack = true; events.push("rollback") }
            }
        }
    }

    const service = {

        async inspect() { events.push("inspect"); return { registered: false, enabled: false, running: false } },

        async register(definition) { registered = definition; events.push("register") },

        async unregister() { events.push("unregister") },

        async start() { events.push("start"); throw new Error("service failed") },

        async stop() { events.push("stop") },

        async enable() { events.push("enable") },

        async disable() { events.push("disable") }
    }

    const release = { version: "0.1.0", archive: "archive", checksum: "checksum" }

    const lifecycle = new SystemLifecycle({

        installation,

        service,

        async resolveRelease() { events.push("resolve"); return release },

        async downloadRelease(value) { events.push("download"); return { ...value, bytes: Buffer.alloc(0), digest: "a".repeat(64) } },

        async ready() { return false },

        async wait() { events.push("wait") }
    })

    await assert.rejects(lifecycle.install(), /service failed/)

    assert.equal(rolledBack, true)

    assert.equal(registered.entry, "/installation/current/server/main.js")

    assert.deepEqual(events.slice(-3), ["stop", "rollback", "unregister"])
})

test("native adapters keep startup enablement separate from current execution", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-system-services-"))

    const calls = []

    let macDisabled = false

    const run = async function (_command, args) {

        calls.push(args)

        if (args[0] === "disable") macDisabled = true

        if (args[0] === "enable") macDisabled = false

        if (args[0] === "print-disabled") return {

            code: 0,

            stdout: macDisabled ? '"com.phreshos.system" => disabled' : "",

            stderr: ""
        }

        if (args.includes("show-environment")) return { code: 0, stdout: `HOME=${temporary}\n`, stderr: "" }

        return args.includes("print") || args.includes("is-active")

            ? { code: 1, stdout: "", stderr: "" }

            : { code: 0, stdout: "", stderr: "" }
    }

    const definition = {

        executable: "/absolute/node",

        entry: "/absolute/system/server/main.js",

        directory: "/absolute/system",

        output: join(temporary, "state", "service.log")
    }

    try {

        const mac = new MacOSSystemService(temporary, run)

        await mac.register(definition)

        await mac.enable()

        await mac.disable()

        assert.equal((await mac.inspect()).enabled, false)

        await mac.enable()

        assert.equal((await mac.inspect()).enabled, true)

        const plist = await readFile(join(temporary, "Library", "LaunchAgents", "com.phreshos.system.plist"), "utf8")

        assert.match(plist, /<string>\/absolute\/node<\/string>/)

        assert.equal(calls.some(args => args.includes("bootstrap") || args.includes("kickstart")), false)

        calls.length = 0

        const linux = new LinuxSystemService(temporary, run)

        await linux.register(definition)

        await linux.enable()

        await linux.disable()

        const unit = await readFile(join(temporary, ".config", "systemd", "user", "phreshos.service"), "utf8")

        assert.match(unit, /ExecStart="\/absolute\/node" "\/absolute\/system\/server\/main.js"/)

        assert.match(unit, new RegExp(`StandardOutput=append:${escape(definition.output)}`))

        assert.match(unit, new RegExp(`StandardError=append:${escape(definition.output)}`))

        assert.doesNotMatch(unit, /append:"/)

        assert.match(unit, new RegExp(`WorkingDirectory=${escape(definition.directory)}`))

        assert.equal(calls.some(args => args.includes("start")), false)
    }

    finally {

        await rm(temporary, { recursive: true, force: true })
    }
})

test("Linux containers without systemd run one detached user service", async function () {

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

        await writeFile(launcher, `import Service from ${JSON.stringify(implementation)}\nconst service = new Service(${JSON.stringify(temporary)})\nawait service.register(${JSON.stringify({ executable: process.execPath, entry, directory: temporary, output })})\nawait service.start()\n`)

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

function release(tag, overrides = {}) {

    const version = tag.slice(1)

    return {

        tag_name: tag,

        draft: false,

        prerelease: false,

        assets: [

            { name: `phreshos@${version}.zip`, browser_download_url: `https://example.test/${version}.zip` },

            { name: `phreshos@${version}.zip.sha256`, browser_download_url: `https://example.test/${version}.zip.sha256` }
        ],

        ...overrides
    }
}

function distribution() {

    const archive = new AdmZip()

    archive.addFile("package.json", Buffer.from(JSON.stringify({ type: "module", scripts: { start: "node server/main.js" }, dependencies: {} })))

    archive.addFile("server/main.js", Buffer.from('console.log("ready")'))

    archive.addFile("client/index.html", Buffer.from("<!doctype html>"))

    return archive.toBuffer()
}

function escape(value) {

    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
