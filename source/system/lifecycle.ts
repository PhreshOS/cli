import type { InstalledSystem, SystemService, SystemServiceDefinition } from "./types.ts"
import type { PreparedSystem, SystemActivation } from "./installation.ts"
import SystemInstallation from "./installation.ts"
import { downloadSystemRelease, resolveSystemRelease } from "./release.ts"
import { gatewayReady, waitForGateway, waitForGatewayClose } from "./gateway-readiness.ts"
import systemPaths from "./paths.ts"
import systemService from "./service/index.ts"
import nodeExecutable from "./node.ts"
import installProgram from "../install.ts"
import { connectSystem, connected } from "../commands/system-connection.ts"
import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export interface SystemStatus {

    installed?: InstalledSystem

    desktop: string

    /** The interface the System listens on, as it records it: `localhost`, or one that other devices may reach. */
    listening: string

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

    waitForStop(path: string): Promise<void>

    provisionSprout(): Promise<void>
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

            waitForStop: dependencies?.waitForStop ?? waitForGatewayClose,

            provisionSprout: dependencies?.provisionSprout ?? (() => provisionSprout())
        }
    }

    public async install(options: { purge?: boolean } = {}) {

        return await this.dependencies.installation.exclusive(() => this.installExclusive(options.purge === true))
    }

    private async installExclusive(purge: boolean) {

        const { installation, service } = this.dependencies

        const previous = await installation.current()

        const previousService = await service.inspect()

        const executable = await nodeExecutable()

        const release = await this.dependencies.resolveRelease()

        const downloaded = await this.dependencies.downloadRelease(release)

        const prepared: PreparedSystem = await installation.prepare(downloaded)

        const activation = await this.activate(prepared, previous, previousService, purge)

        try {

            await service.register(definition(installation, executable))

            if ((await service.inspect()).automaticStartup) await service.enable()

            await this.launchService()

            await this.waitUntilReady()

            await activation.commit()
        }

        catch (error) {

            await this.stopService().catch(() => undefined)

            await activation.rollback()

            return await this.restoredFailure(error, previous, previousService)
        }

        // The System transaction is complete before a Program crosses its
        // live gateway. A provisioning failure therefore leaves a healthy
        // System available for a retry instead of rolling it back around a
        // separate Program installation that may already have succeeded.
        try { await this.dependencies.provisionSprout() }

        catch (error) {

            const reason = error instanceof Error ? error.message : String(error)

            throw new Error(`The PhreshOS System is running, but Sprout could not be provisioned: ${reason}`, { cause: error })
        }

        return await this.status()
    }

    public async uninstall(options: { purge?: boolean } = {}) {

        return await this.dependencies.installation.exclusive(() => this.uninstallExclusive(options.purge === true))
    }

    private async uninstallExclusive(purge: boolean) {

        const { installation, service } = this.dependencies

        const state = await service.inspect()

        if (state.running) await this.stopService()

        if (state.enabled) await service.disable()

        if (state.registered) await service.unregister()

        if (purge) await installation.purgeStorage()
        await installation.remove()
    }

    public async start() {

        return await this.dependencies.installation.exclusive(() => this.startExclusive())
    }

    private async startExclusive() {

        await this.requireInstalledService()

        // The service starts as this CLI defines it, so a System installed by an older CLI still
        // receives every request this one hands over.
        await this.dependencies.service.register(definition(this.dependencies.installation, await nodeExecutable()))

        await this.launchService()

        await this.waitUntilReady()

        return await this.status()
    }

    public async stop() {

        return await this.dependencies.installation.exclusive(() => this.stopExclusive())
    }

    private async stopExclusive() {

        await this.requireInstalledService()

        await this.stopService()

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

        const [desktop, listening] = await Promise.all([desktopOrigin(installation.paths.storage), listeningInterface(installation.paths.storage)])

        return {

            ...(installed ? { installed } : {}),

            desktop,

            listening,

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

    private async activate(prepared: PreparedSystem, previous: InstalledSystem | undefined, state: Awaited<ReturnType<SystemService["inspect"]>>, purge: boolean): Promise<SystemActivation> {

        const { installation } = this.dependencies

        try {

            if (state.running) await this.stopService()

            if (purge) await installation.purgeStorage()

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

        // A background container service has no automatic-startup capability.
        // Restoring its running state must not invoke an unsupported setting.
        if (state.automaticStartup) {

            if (state.enabled) await service.enable()

            else await service.disable()
        }

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
        const { homeRequest, portRequest, hostRequest, transientHome, transientPorts, transientHost } = installation.paths

        const forget = () => Promise.all([homeRequest, portRequest, hostRequest].map(path => rm(path, { force: true })))

        await forget()

        // What this shell set reaches the service only through these requests, read once at its start.
        if (transientHome || transientPorts !== undefined || transientHost !== undefined) {

            await mkdir(dirname(homeRequest), { recursive: true })

            await Promise.all([

                ...transientHome ? [writeFile(homeRequest, transientHome, { mode: 0o600 })] : [],

                ...transientPorts === undefined ? [] : [writeFile(portRequest, transientPorts, { mode: 0o600 })],

                ...transientHost === undefined ? [] : [writeFile(hostRequest, transientHost, { mode: 0o600 })]
            ])
        }

        try { await service.start() }
        catch (error) {

            await forget()
            throw error
        }
    }

    private async stopService() {

        const { installation, service } = this.dependencies

        await service.stop()

        await this.dependencies.waitForStop(installation.paths.gateway)
    }
}

/**
 * Sprout is the first welcome of a new System, so a System installation brings it only when it is
 * not there yet: on a first installation, or after `--purge` emptied the System. Installing a
 * Program again replaces its running Processes and runs it as it declares, so doing it on every
 * update would greet the owner again and end whatever Sprout left running.
 */
export async function provisionSprout(dependencies: Readonly<{ installed(): Promise<boolean>, install(): Promise<void> }> = {
    installed: () => connected(connectSystem, async system => (await (await system.program.find("sprout"))?.installed()) ?? false),
    install: async () => { await installProgram({ name: "sprout", announce: false }) }
}) {

    if (await dependencies.installed()) return

    await dependencies.install()
}

function definition(installation: SystemInstallation, executable: string): SystemServiceDefinition {

    return {

        executable,

        entry: join(installation.paths.current, "server", "main.js"),

        arguments: [
            "--home-request",
            installation.paths.homeRequest,
            "--port-request",
            installation.paths.portRequest,
            "--host-request",
            installation.paths.hostRequest
        ],

        directory: installation.paths.current,

        output: installation.paths.log
    }
}

/** The interface the System listens on, as it records it in its home; `localhost` until it has. */
export async function listeningInterface(storage: string) {

    try { return (await readFile(join(storage, "listening"), "utf8")).trim() || "localhost" }
    catch (error) {

        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "localhost"

        throw error
    }
}

/** Whether only this machine can reach an interface. */
export function loopback(host: string) {

    return host === "localhost" || host === "::1" || host.startsWith("127.")
}

/** The address the System's Desktop is served on, as the System records it in its home. */
export async function desktopOrigin(storage: string) {

    try {

        const value = (await readFile(join(storage, "desktop"), "utf8")).trim()

        return /^http:\/\/localhost:\d+$/.test(value) ? value : "http://localhost:4300"
    }

    catch (error) {

        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "http://localhost:4300"

        throw error
    }
}
