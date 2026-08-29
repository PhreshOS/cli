import type { SystemService, SystemServiceDefinition } from "../types.ts"
import { execute, type ProcessResult } from "../process.ts"
import { existsSync } from "node:fs"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

const command = "/bin/launchctl"

const defaultLabel = "com.phreshos.system"

export default class MacOSSystemService implements SystemService {

    private readonly definition: string

    private readonly startup: string

    private readonly domain: string

    private readonly target: string

    public constructor(

        userHome: string,

        private readonly run: (command: string, args: string[]) => Promise<ProcessResult> = execute,

        private readonly label = defaultLabel,

        uid = process.getuid?.(),

        private readonly environment: NodeJS.ProcessEnv = process.env
    ) {

        if (uid === undefined) throw new Error("The current macOS user could not be identified")

        this.definition = join(userHome, "Library", "Application Support", "PhreshOS", "System", `${this.label}.plist`)

        this.startup = join(userHome, "Library", "LaunchAgents", `${this.label}.plist`)

        this.domain = `gui/${uid}`

        this.target = `${this.domain}/${this.label}`
    }

    public async inspect() {

        await this.migrate()

        const registered = existsSync(this.definition)

        const service = await this.run(command, ["print", this.target])

        const pid = /\bpid\s*=\s*(\d+)/.exec(service.stdout)?.[1]

        return {

            registered,

            automaticStartup: true,

            enabled: registered && existsSync(this.startup),

            running: service.code === 0 && /\bstate\s*=\s*running\b/.test(service.stdout),

            ...(pid ? { pid: Number(pid) } : {})
        }
    }

    public async register(definition: SystemServiceDefinition) {

        await this.migrate()

        await this.stop()

        await mkdir(dirname(definition.output), { recursive: true })

        const content = plist(this.label, definition, this.environment)

        await atomic(this.definition, content)

        if (existsSync(this.startup)) await atomic(this.startup, content)
    }

    public async unregister() {

        await this.migrate()

        await this.stop()

        await Promise.all([

            rm(this.definition, { force: true }),

            rm(this.startup, { force: true })
        ])

        await this.run(command, ["enable", this.target])
    }

    public async start() {

        await this.migrate()

        if (!existsSync(this.definition)) throw new Error("The PhreshOS System service is not registered")

        const state = await this.inspect()

        if (state.running) return

        // launchctl disable prevents manual execution as well as login startup.
        // Automatic startup is represented by the LaunchAgents copy instead,
        // leaving the canonical definition eligible for an explicit start.
        await this.require(["enable", this.target])

        const loaded = await this.run(command, ["print", this.target])

        if (loaded.code === 0) await this.require(["kickstart", "-k", this.target])

        else await this.require(["bootstrap", this.domain, this.definition])
    }

    public async stop() {

        const loaded = await this.run(command, ["print", this.target])

        if (loaded.code === 0) await this.require(["bootout", this.target])
    }

    public async enable() {

        await this.migrate()

        if (!existsSync(this.definition)) throw new Error("The PhreshOS System service is not registered")

        await atomic(this.startup, await readFile(this.definition, "utf8"))

        await this.require(["enable", this.target])
    }

    public async disable() {

        await this.migrate()

        if (!existsSync(this.definition)) throw new Error("The PhreshOS System service is not registered")

        await rm(this.startup, { force: true })

        await this.require(["enable", this.target])
    }

    /** Convert the former launchctl-disabled representation without changing its setting. */
    private async migrate() {

        if (existsSync(this.definition) || !existsSync(this.startup)) return

        const disabled = await this.run(command, ["print-disabled", this.domain])

        const automatic = !new RegExp(`"${escapePattern(this.label)}"\\s*=>\\s*(?:true|disabled)`).test(disabled.stdout)

        await atomic(this.definition, await readFile(this.startup, "utf8"))

        if (!automatic) {

            await rm(this.startup, { force: true })

            await this.require(["enable", this.target])
        }
    }

    private async require(args: string[]) {

        const result = await this.run(command, args)

        if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} exited with code ${result.code}`)
    }
}

function plist(label: string, definition: SystemServiceDefinition, environment: NodeJS.ProcessEnv) {

    const path = environmentPath(environment)

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${xml(label)}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${xml(definition.executable)}</string>
        <string>${xml(definition.entry)}</string>
${definition.arguments.map(argument => `        <string>${xml(argument)}</string>`).join("\n")}
    </array>
    <key>WorkingDirectory</key>
    <string>${xml(definition.directory)}</string>
${path === undefined ? "" : `    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${xml(path)}</string>
    </dict>
`}
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>2</integer>
    <key>StandardOutPath</key>
    <string>${xml(definition.output)}</string>
    <key>StandardErrorPath</key>
    <string>${xml(definition.output)}</string>
</dict>
</plist>
`
}

function environmentPath(environment: NodeJS.ProcessEnv) {

    const key = Object.keys(environment).find(name => name.toLowerCase() === "path")

    return key === undefined ? undefined : environment[key]
}

async function atomic(path: string, content: string) {

    await mkdir(dirname(path), { recursive: true })

    const temporary = `${path}.${randomUUID()}.tmp`

    try {

        await writeFile(temporary, content, { mode: 0o600 })

        await rename(temporary, path)
    }

    finally {

        await rm(temporary, { force: true })
    }
}

function xml(value: string) {

    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function escapePattern(value: string) {

    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
