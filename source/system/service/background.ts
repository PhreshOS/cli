import type { SystemService, SystemServiceDefinition } from "../types.ts"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

/**
 * Owns the System for the lifetime of a Linux container with no init manager.
 * Registration and the pid are user files; execution is a detached Node child.
 */
export default class BackgroundSystemService implements SystemService {

    private readonly definition: string

    private readonly pid: string

    public constructor(userHome: string) {

        this.definition = join(userHome, ".config", "phreshos", "system-service.json")

        this.pid = join(userHome, ".local", "state", "phreshos", "system.pid")
    }

    public async inspect() {

        const registered = existsSync(this.definition)

        const pid = await this.readPid()

        const running = pid !== undefined && await this.owns(pid)

        if (pid !== undefined && !running) await rm(this.pid, { force: true })

        return {

            registered,

            automaticStartup: false,

            enabled: false,

            running,

            ...(running ? { pid } : {})
        }
    }

    public async register(definition: SystemServiceDefinition) {

        await this.stop()

        await atomic(this.definition, JSON.stringify(definition), 0o600)
    }

    public async unregister() {

        await this.stop()

        await rm(this.definition, { force: true })
    }

    public async start() {

        const definition = await this.readDefinition()

        if ((await this.inspect()).running) return

        await mkdir(dirname(definition.output), { recursive: true })

        const output = await open(definition.output, "a", 0o600)

        try {

            const child = spawn(definition.executable, [definition.entry], {

                cwd: definition.directory,

                detached: true,

                stdio: ["ignore", output.fd, output.fd]
            })

            await new Promise<void>(function (settle, refuse) {

                child.once("spawn", settle)

                child.once("error", refuse)
            })

            if (child.pid === undefined) throw new Error("The PhreshOS System background process has no pid")

            await atomic(this.pid, String(child.pid), 0o600)

            child.unref()
        }

        finally {

            await output.close()
        }
    }

    public async stop() {

        const pid = await this.readPid()

        if (pid === undefined) return

        if (!await this.owns(pid)) {

            await rm(this.pid, { force: true })

            return
        }

        process.kill(pid, "SIGTERM")

        const until = Date.now() + 5_000

        while (Date.now() < until && await this.owns(pid)) await new Promise(settle => setTimeout(settle, 50))

        if (await this.owns(pid)) process.kill(pid, "SIGKILL")

        await rm(this.pid, { force: true })
    }

    public async enable(): Promise<never> {

        throw new Error("Automatic System startup is unavailable because this Linux environment has no service manager")
    }

    public async disable(): Promise<never> {

        throw new Error("Automatic System startup is unavailable because this Linux environment has no service manager")
    }

    private async readDefinition() {

        let value: unknown

        try {

            value = JSON.parse(await readFile(this.definition, "utf8"))
        }

        catch {

            throw new Error("The PhreshOS System service is not registered")
        }

        if (!definition(value)) throw new Error("The PhreshOS System service definition is invalid")

        return value
    }

    private async readPid() {

        try {

            const value = (await readFile(this.pid, "utf8")).trim()

            return /^[1-9][0-9]*$/.test(value) ? Number(value) : undefined
        }

        catch {

            return undefined
        }
    }

    private async owns(pid: number) {

        try {

            process.kill(pid, 0)
        }

        catch {

            return false
        }

        if (process.platform !== "linux") return true

        const definition = await this.readDefinition().catch(() => undefined)

        if (!definition) return false

        const command = await readFile(`/proc/${pid}/cmdline`, "utf8").catch(() => "")

        return command.split("\0").includes(definition.entry)
    }
}

async function atomic(path: string, content: string, mode: number) {

    await mkdir(dirname(path), { recursive: true })

    const temporary = `${path}.${randomUUID()}.tmp`

    try {

        await writeFile(temporary, content, { mode })

        await rename(temporary, path)
    }

    finally {

        await rm(temporary, { force: true })
    }
}

function definition(value: unknown): value is SystemServiceDefinition {

    if (!value || typeof value !== "object") return false

    const candidate = value as Record<string, unknown>

    return ["executable", "entry", "directory", "output"].every(name => typeof candidate[name] === "string" && candidate[name] !== "")
}
