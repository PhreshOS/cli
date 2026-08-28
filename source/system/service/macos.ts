import type { SystemService, SystemServiceDefinition } from "../types.ts"
import { execute, type ProcessResult } from "../process.ts"
import { existsSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

const command = "/bin/launchctl"

const defaultLabel = "com.phreshos.system"

export default class MacOSSystemService implements SystemService {

    private readonly plist: string

    private readonly domain: string

    private readonly target: string

    public constructor(

        userHome: string,

        private readonly run: (command: string, args: string[]) => Promise<ProcessResult> = execute,

        private readonly label = defaultLabel,

        uid = process.getuid?.()
    ) {

        if (uid === undefined) throw new Error("The current macOS user could not be identified")

        this.plist = join(userHome, "Library", "LaunchAgents", `${this.label}.plist`)

        this.domain = `gui/${uid}`

        this.target = `${this.domain}/${this.label}`
    }

    public async inspect() {

        const registered = existsSync(this.plist)

        const service = await this.run(command, ["print", this.target])

        const disabled = await this.run(command, ["print-disabled", this.domain])

        const explicitlyDisabled = new RegExp(`"${escapePattern(this.label)}"\\s*=>\\s*(?:true|disabled)`).test(disabled.stdout)

        const pid = /\bpid\s*=\s*(\d+)/.exec(service.stdout)?.[1]

        return {

            registered,

            automaticStartup: true,

            enabled: registered && !explicitlyDisabled,

            running: service.code === 0 && /\bstate\s*=\s*running\b/.test(service.stdout),

            ...(pid ? { pid: Number(pid) } : {})
        }
    }

    public async register(definition: SystemServiceDefinition) {

        await this.stop()

        await mkdir(dirname(this.plist), { recursive: true })

        await mkdir(dirname(definition.output), { recursive: true })

        const temporary = `${this.plist}.${randomUUID()}.tmp`

        try {

            await writeFile(temporary, plist(this.label, definition), { mode: 0o600 })

            await rename(temporary, this.plist)
        }

        finally {

            await rm(temporary, { force: true })
        }
    }

    public async unregister() {

        await this.stop()

        await rm(this.plist, { force: true })
    }

    public async start() {

        if (!existsSync(this.plist)) throw new Error("The PhreshOS System service is not registered")

        const state = await this.inspect()

        if (state.running) return

        const loaded = await this.run(command, ["print", this.target])

        if (loaded.code === 0) await this.require(["kickstart", "-k", this.target])

        else await this.require(["bootstrap", this.domain, this.plist])
    }

    public async stop() {

        const loaded = await this.run(command, ["print", this.target])

        if (loaded.code === 0) await this.require(["bootout", this.target])
    }

    public async enable() {

        if (!existsSync(this.plist)) throw new Error("The PhreshOS System service is not registered")

        await this.require(["enable", this.target])
    }

    public async disable() {

        if (!existsSync(this.plist)) throw new Error("The PhreshOS System service is not registered")

        await this.require(["disable", this.target])
    }

    private async require(args: string[]) {

        const result = await this.run(command, args)

        if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} exited with code ${result.code}`)
    }
}

function plist(label: string, definition: SystemServiceDefinition) {

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

function xml(value: string) {

    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function escapePattern(value: string) {

    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
