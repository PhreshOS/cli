import type { InstalledSystem, SystemService, SystemServiceDefinition } from "./types.ts"
import type { PreparedSystem, SystemActivation } from "./installation.ts"
import SystemInstallation from "./installation.ts"
import { downloadSystemRelease, resolveSystemRelease } from "./release.ts"
import { gatewayReady, waitForGateway } from "./gateway-readiness.ts"
import systemPaths from "./paths.ts"
import systemService from "./service/index.ts"
import nodeExecutable from "./node.ts"
import installProgram from "../install.ts"
import phreshosHome from "../home.ts"
import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export interface SystemStatus {

    installed?: InstalledSystem

    desktop: string

    registered: boolean

    automaticStartup: boolean

    enabled: boolean

    running: boolean

    ready: boolean

    pid?: number

    root: string

    gateway: string

    log: string
}

interface LifecycleDependencies {

    installation: SystemInstallation

    service: SystemService

    resolveRelease: typeof resolveSystemRelease

    downloadRelease: typeof downloadSystemRelease

    ready(path: string): Promise<boolean>

    wait(path: string, running: () => Promise<boolean>): Promise<void>

    provisionSetup(): Promise<void>
}

/** Coordinates acquisition, immutable files, and the native service as one transaction. */
export default class SystemLifecycle {

    private readonly dependencies: LifecycleDependencies

    public constructor(dependencies?: Partial<LifecycleDependencies>) {

        const paths = systemPaths()

        const service = dependencies?.service ?? systemService()

        this.dependencies = {

            installation: dependencies?.installation ?? new SystemInstallation(paths),

            service,

            resolveRelease: dependencies?.resolveRelease ?? resolveSystemRelease,

            downloadRelease: dependencies?.downloadRelease ?? downloadSystemRelease,

            ready: dependencies?.ready ?? gatewayReady,

            wait: dependencies?.wait ?? waitForGateway,

            provisionSetup: dependencies?.provisionSetup ?? provisionSetup
        }
    }

    public async install() {

        return await this.dependencies.installation.exclusive(() => this.installExclusive())
    }

    private async installExclusive() {

        const { installation, service } = this.dependencies

        const previous = await installation.current()

        const previousService = await service.inspect()

        const executable = await nodeExecutable()

        const release = await this.dependencies.resolveRelease()

        const downloaded = await this.dependencies.downloadRelease(release)

        const prepared: PreparedSystem = await installation.prepare(downloaded)

        const activation = await this.activate(prepared, previous, previousService)

        try {

            await service.register(definition(installation, executable))

            if ((await service.inspect()).automaticStartup) await service.enable()

            await this.launchService()

            await this.waitUntilReady()

            await activation.commit()
        }

        catch (error) {

            await service.stop().catch(() => undefined)

            await activation.rollback()

            return await this.restoredFailure(error, previous, previousService)
        }

        // The System transaction is complete before a Program crosses its
        // live gateway. A provisioning failure therefore leaves a healthy
        // System available for a retry instead of rolling it back around a
        // separate Program installation that may already have succeeded.
        try { await this.dependencies.provisionSetup() }

        catch (error) {

            const reason = error instanceof Error ? error.message : String(error)

            throw new Error(`The PhreshOS System is running, but Setup could not be provisioned: ${reason}`, { cause: error })
        }

        return await this.status()
    }

    public async uninstall() {

        return await this.dependencies.installation.exclusive(() => this.uninstallExclusive())
    }

    private async uninstallExclusive() {

        const { installation, service } = this.dependencies

        const state = await service.inspect()

        if (state.running) await service.stop()

        if (state.enabled) await service.disable()

        if (state.registered) await service.unregister()

        await installation.remove()
    }

    public async start() {

        return await this.dependencies.installation.exclusive(() => this.startExclusive())
    }

    private async startExclusive() {

        await this.requireInstalledService()

        await this.launchService()

        await this.waitUntilReady()

        return await this.status()
    }

    public async stop() {

        return await this.dependencies.installation.exclusive(() => this.stopExclusive())
    }

    private async stopExclusive() {

        await this.requireInstalledService()

        await this.dependencies.service.stop()

        return await this.status()
    }

    public async enable() {

        return await this.dependencies.installation.exclusive(() => this.enableExclusive())
    }

    private async enableExclusive() {

        await this.requireInstalledService()

        await this.dependencies.service.enable()

        return await this.status()
    }

    public async disable() {

        return await this.dependencies.installation.exclusive(() => this.disableExclusive())
    }

    private async disableExclusive() {

        await this.requireInstalledService()

        await this.dependencies.service.disable()

        return await this.status()
    }

    public async status(): Promise<SystemStatus> {

        const { installation, service } = this.dependencies

        const [installed, state] = await Promise.all([installation.current(), service.inspect()])

        const ready = state.running && await this.dependencies.ready(installation.paths.gateway)

        const desktop = await desktopOrigin(installation.paths.storage)

        return {

            ...(installed ? { installed } : {}),

            desktop,

            ...state,

            ready,

            root: installation.paths.root,

            gateway: installation.paths.gateway,

            log: installation.paths.log
        }
    }

    private async requireInstalledService() {

        const [installed, state] = await Promise.all([

            this.dependencies.installation.current(),

            this.dependencies.service.inspect()
        ])

        if (!installed) throw new Error("PhreshOS System is not installed — run phresh system install")

        if (!state.registered) throw new Error("The PhreshOS System service is not registered — run phresh system install")
    }

    private async waitUntilReady() {

        const { installation, service } = this.dependencies

        try {

            await this.dependencies.wait(installation.paths.gateway, async () => (await service.inspect()).running)
        }

        catch (error) {

            const message = error instanceof Error ? error.message : String(error)

            const log = existsSync(installation.paths.log) ? `. Service log: ${installation.paths.log}` : ""

            throw new Error(`${message}${log}`, { cause: error })
        }
    }

    private async activate(prepared: PreparedSystem, previous: InstalledSystem | undefined, state: Awaited<ReturnType<SystemService["inspect"]>>): Promise<SystemActivation> {

        const { installation, service } = this.dependencies

        try {

            if (state.running) await service.stop()

            return await installation.activate(prepared, previous)
        }

        catch (error) {

            await installation.abandon(prepared)

            return await this.restoredFailure(error, previous, state)
        }
    }

    private async restore(previous: InstalledSystem | undefined, state: Awaited<ReturnType<SystemService["inspect"]>>) {

        const { installation, service } = this.dependencies

        if (!previous) {

            await service.unregister().catch(() => undefined)

            return
        }

        await service.register(definition(installation, await nodeExecutable()))

        if (state.enabled) await service.enable()

        else await service.disable()

        if (state.running) {

            await this.launchService()

            await this.waitUntilReady()
        }
    }

    private async restoredFailure(error: unknown, previous: InstalledSystem | undefined, state: Awaited<ReturnType<SystemService["inspect"]>>): Promise<never> {

        try {

            await this.restore(previous, state)
        }

        catch (restoration) {

            throw new AggregateError([error, restoration], "The System update failed and its previous service could not be restored")
        }

        throw error
    }

    private async launchService() {

        const { installation, service } = this.dependencies
        const { homeRequest, portRequest, transientHome, transientPorts } = installation.paths

        await Promise.all([rm(homeRequest, { force: true }), rm(portRequest, { force: true })])

        if (transientHome || transientPorts !== undefined) {

            await mkdir(dirname(homeRequest), { recursive: true })

            await Promise.all([

                ...transientHome ? [writeFile(homeRequest, transientHome, { mode: 0o600 })] : [],

                ...transientPorts === undefined ? [] : [writeFile(portRequest, transientPorts, { mode: 0o600 })]
            ])
        }

        try { await service.start() }
        catch (error) {

            await Promise.all([rm(homeRequest, { force: true }), rm(portRequest, { force: true })])
            throw error
        }
    }
}

async function provisionSetup() {

    await installProgram({ name: "setup", run: true, announce: false })
}

function definition(installation: SystemInstallation, executable: string): SystemServiceDefinition {

    return {

        executable,

        entry: join(installation.paths.current, "server", "main.js"),

        arguments: [
            "--default-home",
            phreshosHome({}, homedir()),
            "--home-request",
            installation.paths.homeRequest,
            "--port-request",
            installation.paths.portRequest
        ],

        directory: installation.paths.current,

        output: installation.paths.log
    }
}

async function desktopOrigin(storage: string) {

    try {

        const value = (await readFile(join(storage, "desktop"), "utf8")).trim()

        return /^http:\/\/localhost:\d+$/.test(value) ? value : "http://localhost:4300"
    }

    catch (error) {

        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "http://localhost:4300"

        throw error
    }
}
