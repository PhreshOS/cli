import type { SystemService, SystemServiceDefinition } from "../types.ts"
import { execute, type ProcessResult } from "../process.ts"
import BackgroundSystemService from "./background.ts"
import SystemdSystemService from "./systemd.ts"

const command = "systemctl"

/** Selects systemd only after proving that its user manager is real. */
export default class LinuxSystemService implements SystemService {

    private readonly selected: Promise<SystemService>

    public constructor(userHome: string, run: (command: string, args: string[]) => Promise<ProcessResult> = execute) {

        this.selected = select(userHome, run)
    }

    public async inspect() {

        return await (await this.selected).inspect()
    }

    public async register(definition: SystemServiceDefinition) {

        await (await this.selected).register(definition)
    }

    public async unregister() {

        await (await this.selected).unregister()
    }

    public async start() {

        await (await this.selected).start()
    }

    public async stop() {

        await (await this.selected).stop()
    }

    public async enable() {

        await (await this.selected).enable()
    }

    public async disable() {

        await (await this.selected).disable()
    }
}

async function select(userHome: string, run: (command: string, args: string[]) => Promise<ProcessResult>) {

    const result = await run(command, ["--user", "show-environment"]).catch(() => undefined)

    const lines = result?.stdout.trim().split("\n").filter(Boolean) ?? []

    const systemd = result?.code === 0 && lines.length > 0 && lines.every(line => /^[a-zA-Z_][a-zA-Z0-9_]*=/.test(line))

    return systemd ? new SystemdSystemService(userHome, run) : new BackgroundSystemService(userHome)
}
