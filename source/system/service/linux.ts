import type { SystemService, SystemServiceDefinition } from "../types.ts"
import { execute, type ProcessResult } from "../process.ts"
import { existsSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

const command = "systemctl"

const unit = "phreshos.service"

export default class LinuxSystemService implements SystemService {

    private readonly file: string

    public constructor(userHome: string, private readonly run: (command: string, args: string[]) => Promise<ProcessResult> = execute) {

        this.file = join(userHome, ".config", "systemd", "user", unit)
    }

    public async inspect() {

        const registered = existsSync(this.file)

        const active = await this.run(command, ["--user", "is-active", "--quiet", unit])

        const enabled = await this.run(command, ["--user", "is-enabled", "--quiet", unit])

        const pid = active.code === 0 ? await this.run(command, ["--user", "show", unit, "--property", "MainPID", "--value"]) : undefined

        const value = pid && /^[0-9]+$/.test(pid.stdout.trim()) ? Number(pid.stdout.trim()) : undefined

        return {

            registered,

            enabled: registered && enabled.code === 0,

            running: registered && active.code === 0,

            ...(value ? { pid: value } : {})
        }
    }

    public async register(definition: SystemServiceDefinition) {

        await this.stop()

        await mkdir(dirname(this.file), { recursive: true })

        await mkdir(dirname(definition.output), { recursive: true })

        const temporary = `${this.file}.${randomUUID()}.tmp`

        try {

            await writeFile(temporary, service(definition), { mode: 0o600 })

            await rename(temporary, this.file)
        }

        finally {

            await rm(temporary, { force: true })
        }

        await this.require(["--user", "daemon-reload"])
    }

    public async unregister() {

        await this.stop()

        await this.run(command, ["--user", "disable", unit])

        await rm(this.file, { force: true })

        await this.require(["--user", "daemon-reload"])

        await this.run(command, ["--user", "reset-failed", unit])
    }

    public async start() {

        if (!existsSync(this.file)) throw new Error("The PhreshOS System service is not registered")

        await this.require(["--user", "start", unit])
    }

    public async stop() {

        const state = await this.run(command, ["--user", "is-active", "--quiet", unit])

        if (state.code === 0) await this.require(["--user", "stop", unit])
    }

    public async enable() {

        if (!existsSync(this.file)) throw new Error("The PhreshOS System service is not registered")

        await this.require(["--user", "enable", unit])
    }

    public async disable() {

        if (!existsSync(this.file)) throw new Error("The PhreshOS System service is not registered")

        await this.require(["--user", "disable", unit])
    }

    private async require(args: string[]) {

        const result = await this.run(command, args)

        if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} exited with code ${result.code}`)
    }
}

function service(definition: SystemServiceDefinition) {

    return `[Unit]
Description=PhreshOS System

[Service]
Type=simple
ExecStart=${quote(definition.executable)} ${quote(definition.entry)}
WorkingDirectory=${setting(definition.directory)}
Restart=on-failure
RestartSec=2
StandardOutput=append:${setting(definition.output)}
StandardError=append:${setting(definition.output)}

[Install]
WantedBy=default.target
`
}

function quote(value: string) {

    return JSON.stringify(value)
}

function setting(value: string) {

    if (value.includes("\n") || value.includes("\r")) throw new Error("A systemd service path cannot contain a line break")

    return value.replaceAll("%", "%%")
}
