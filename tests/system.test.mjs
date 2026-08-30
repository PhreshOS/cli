import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, normalize, resolve } from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import AdmZip from "adm-zip"
import SystemInstallation from "../dist/system/installation.js"
import SystemLifecycle from "../dist/system/lifecycle.js"
import systemPaths from "../dist/system/paths.js"
import { downloadSystemRelease, selectSystemRelease } from "../dist/system/release.js"
import MacOSSystemService from "../dist/system/service/macos.js"
import LinuxSystemService from "../dist/system/service/linux.js"
import WindowsSystemService from "../dist/system/service/windows.js"
import { minimumSystemNodeVersion, supportsSystemNode } from "../dist/system/node.js"
import { gatewayPath } from "../dist/gateway.js"
import { waitForGateway } from "../dist/system/gateway-readiness.js"
import npmInvocation from "../dist/system/npm.js"

test("requires the Node release that provides the supported built-in SQLite API", function () {

    assert.equal(minimumSystemNodeVersion, "24.15.0")

    assert.equal(supportsSystemNode("24.14.1"), false)

    assert.equal(supportsSystemNode("24.15.0"), true)

    assert.equal(supportsSystemNode("25.0.0"), true)

    assert.equal(supportsSystemNode("24.15.0-rc.1"), false)
})

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

    const storage = normalize("/temporary")

    assert.equal(paths.root, join("/Users/person", "Library", "Application Support", "PhreshOS", "System"))

    assert.equal(paths.storage, storage)

    assert.equal(paths.gateway, join("/temporary", "gateway.sock"))

    assert.equal(paths.transientHome, storage)

    assert.equal(paths.homeRequest, join(paths.root, "next-home"))
})

test("gives each Windows user or isolated instance one stable named pipe", function () {

    const first = gatewayPath("C:\\Users\\Person\\.phreshos", "win32")

    assert.match(first, /^\\\\\.\\pipe\\phreshos-[a-f0-9]{32}-gateway$/)

    assert.equal(first, gatewayPath("c:/users/person/.phreshos/", "win32"))

    assert.notEqual(first, gatewayPath("C:\\Users\\Other\\.phreshos", "win32"))
})

test("runs Windows npm through Node instead of a command-shell shim", function () {

    const invocation = npmInvocation(["install", "--omit=dev"], "win32", "C:\\Runtime\\node.exe")

    assert.deepEqual(invocation, {

        command: "C:\\Runtime\\node.exe",

        args: ["C:\\Runtime\\node_modules\\npm\\bin\\npm-cli.js", "install", "--omit=dev"]
    })
})

test("allows a native service time to enter its running state", async function () {

    let checks = 0

    await assert.rejects(

        waitForGateway(join(tmpdir(), `missing-gateway-${process.pid}`), async () => ++checks > 1, 250),

        /did not become ready/
    )

    assert.ok(checks > 1)
})

test("detects a service that stops after it was running", async function () {

    let checks = 0

    await assert.rejects(

        waitForGateway(join(tmpdir(), `missing-gateway-${process.pid}`), async () => ++checks === 2, 1_000),

        /stopped before its gateway became ready/
    )
})

test("stages, validates, activates, and reads one production distribution", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-system-installation-"))

    const paths = {

        root: join(temporary, "system"),

        releases: join(temporary, "system", "releases"),

        current: join(temporary, "system", "current"),

        storage: join(temporary, "storage"),

        gateway: join(temporary, "storage", "gateway.sock"),

        homeRequest: join(temporary, "system", "next-home"),

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

        gateway: join(temporary, "storage", "gateway.sock"),

        homeRequest: join(temporary, "system", "next-home"),

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

        gateway: "/state/gateway.sock",

        homeRequest: "/installation/next-home",

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

    assert.equal(registered.entry, join("/installation/current", "server", "main.js"))

    assert.deepEqual(registered.arguments.slice(-2), ["--home-request", "/installation/next-home"])

    assert.deepEqual(events.slice(-3), ["stop", "rollback", "unregister"])
})

test("provisions Setup after the System commits and before installation returns", async function () {

    const events = []

    const installed = { version: "0.1.0", digest: "a".repeat(64), directory: "/installation/releases/0.1.0", installedAt: "now" }

    let current

    let running = false

    const installation = {

        paths: {

            root: "/installation",

            releases: "/installation/releases",

            current: "/installation/current",

            storage: "/state",

            gateway: "/state/gateway.sock",

            homeRequest: "/installation/next-home",

            log: "/state/service.log"
        },

        async exclusive(work) { return await work() },

        async current() { return current },

        async prepare(release) { events.push("prepare"); return { release, directory: "/staging" } },

        async activate() {

            events.push("activate")

            current = installed

            return {

                installed,

                async commit() { events.push("commit") },

                async rollback() { events.push("rollback") }
            }
        }
    }

    const service = {

        async inspect() { return { registered: running, automaticStartup: false, enabled: false, running } },

        async register() { events.push("register") },

        async unregister() { events.push("unregister") },

        async start() { running = true; events.push("start") },

        async stop() { running = false; events.push("stop") },

        async enable() {},

        async disable() {}
    }

    const lifecycle = new SystemLifecycle({

        installation,

        service,

        async resolveRelease() { return { version: "0.1.0", archive: "archive", checksum: "checksum" } },

        async downloadRelease(release) { return { ...release, bytes: Buffer.alloc(0), digest: installed.digest } },

        async ready() { return running },

        async wait() { events.push("ready") },

        async provisionSetup() { events.push("setup") }
    })

    const status = await lifecycle.install()

    assert.equal(status.installed?.version, "0.1.0")

    assert(events.indexOf("start") < events.indexOf("ready"))

    assert(events.indexOf("ready") < events.indexOf("commit"))

    assert(events.indexOf("commit") < events.indexOf("setup"))
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

        arguments: [],

        directory: "/absolute/system",

        output: join(temporary, "state", "service.log")
    }

    try {

        const mac = new MacOSSystemService(temporary, run, undefined, 501, { PATH: "/custom/bin:/usr/bin" })

        await mac.register(definition)

        await mac.enable()

        await mac.disable()

        assert.equal((await mac.inspect()).enabled, false)

        calls.length = 0

        await mac.start()

        assert.equal((await mac.inspect()).enabled, false)

        assert.equal(calls.some(args => args[0] === "enable" && args.includes("gui/501/com.phreshos.system")), true)

        const definitionPath = join(temporary, "Library", "Application Support", "PhreshOS", "System", "com.phreshos.system.plist")

        assert.equal(calls.some(args => args[0] === "bootstrap" && args.at(-1) === definitionPath), true)

        calls.length = 0

        await mac.enable()

        assert.equal((await mac.inspect()).enabled, true)

        const plist = await readFile(join(temporary, "Library", "LaunchAgents", "com.phreshos.system.plist"), "utf8")

        assert.match(plist, /<string>\/absolute\/node<\/string>/)

        assert.match(plist, /<key>PATH<\/key>\s*<string>\/custom\/bin:\/usr\/bin<\/string>/)

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

test("macOS migrates a disabled legacy service into a manually startable definition", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-system-macos-migration-"))

    const startup = join(temporary, "Library", "LaunchAgents", "com.phreshos.system.plist")

    const canonical = join(temporary, "Library", "Application Support", "PhreshOS", "System", "com.phreshos.system.plist")

    const calls = []

    let disabled = true

    await mkdir(dirname(startup), { recursive: true })

    await writeFile(startup, "legacy service")

    const run = async function (_command, args) {

        calls.push(args)

        if (args[0] === "print-disabled") return { code: 0, stdout: disabled ? '"com.phreshos.system" => disabled' : "", stderr: "" }

        if (args[0] === "enable") disabled = false

        return args[0] === "print"

            ? { code: 1, stdout: "", stderr: "" }

            : { code: 0, stdout: "", stderr: "" }
    }

    try {

        const service = new MacOSSystemService(temporary, run, undefined, 501)

        await service.start()

        assert.equal(await readFile(canonical, "utf8"), "legacy service")

        assert.equal(existsSync(startup), false)

        assert.equal(disabled, false)

        assert.equal((await service.inspect()).enabled, false)

        assert.equal(calls.some(args => args[0] === "bootstrap" && args.at(-1) === canonical), true)
    }

    finally { await rm(temporary, { recursive: true, force: true }) }
})

test("Windows keeps scheduled startup separate from current execution", async function () {

    const temporary = await mkdtemp(join(tmpdir(), "phresh-windows-service-"))

    let registered = false

    let enabled = false

    let running = false

    let xml

    const run = async function (command, args) {

        if (command === "powershell.exe") {

            const script = args.at(-1)

            if (script.includes("WindowsIdentity")) return { code: 0, stdout: "S-1-5-21-1000", stderr: "" }

            return registered

                ? { code: 0, stdout: `${running ? 4 : enabled ? 3 : 1},${enabled ? 1 : 0}`, stderr: "" }

                : { code: 3, stdout: "", stderr: "" }
        }

        if (args[0] === "/Create") {

            xml = await readFile(args[args.indexOf("/XML") + 1], "utf16le")

            registered = true

            enabled = true
        }

        if (args[0] === "/Run") running = true

        if (args[0] === "/End") running = false

        if (args[0] === "/Delete") registered = false

        if (args[0] === "/Change") enabled = args.includes("/Enable")

        return { code: 0, stdout: "", stderr: "" }
    }

    const definition = {

        executable: "C:\\Program Files\\nodejs\\node.exe",

        entry: "C:\\People & Work\\System\\server\\main.js",

        arguments: [],

        directory: "C:\\People & Work\\System",

        output: join(temporary, "state with spaces", "service.log")
    }

    const service = new WindowsSystemService(temporary, run)

    try {

        await service.register(definition)

        assert.equal((await service.inspect()).running, false)

        assert.match(xml, /<LogonTrigger>/)

        assert.match(xml, /<LogonType>InteractiveToken<\/LogonType>/)

        assert.match(xml, /<RestartOnFailure>[\s\S]*<Interval>PT1M<\/Interval>/)

        assert.match(xml, /<WorkingDirectory>C:\\People &amp; Work\\System<\/WorkingDirectory>/)

        assert.match(xml, /<Command>C:\\Program Files\\nodejs\\node\.exe<\/Command>/)

        const encoded = /<Arguments>&quot;.*windows-runner\.js&quot; ([A-Za-z0-9_-]+)<\/Arguments>/.exec(xml)?.[1]

        assert.ok(encoded)

        const invocation = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))

        assert.equal(invocation.definition.executable, "C:\\Program Files\\nodejs\\node.exe")

        assert.equal(invocation.definition.entry, "C:\\People & Work\\System\\server\\main.js")

        await service.disable()

        await service.start()

        assert.equal((await service.inspect()).running, true)

        assert.equal((await service.inspect()).enabled, false)

        await service.stop()

        await service.unregister()

        assert.equal((await service.inspect()).registered, false)
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

    archive.addFile("package.json", Buffer.from(JSON.stringify({

        type: "module",

        scripts: { start: "node server/main.js" },

        engines: { node: ">=24.15.0" },

        dependencies: {}
    })))

    archive.addFile("server/main.js", Buffer.from('console.log("ready")'))

    archive.addFile("client/index.html", Buffer.from("<!doctype html>"))

    return archive.toBuffer()
}

function escape(value) {

    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
