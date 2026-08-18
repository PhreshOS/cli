import type { DownloadedSystem, InstalledSystem, SystemPaths } from "./types.ts"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { mkdir, mkdtemp, open, readFile, readdir, readlink, rename, rm, symlink, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { requireSuccess } from "./process.ts"
import AdmZip from "adm-zip"

export interface PreparedSystem {

    release: DownloadedSystem

    directory: string
}

export interface SystemActivation {

    installed: InstalledSystem

    commit(): Promise<void>

    rollback(): Promise<void>
}

/** Owns immutable release directories and the one atomic active record. */
export default class SystemInstallation {

    public constructor(

        public readonly paths: SystemPaths,

        private readonly dependencies: (directory: string) => Promise<void> = installProductionDependencies
    ) {}

    public async current() {

        let directory: string

        let value: unknown

        try {

            directory = resolve(dirname(this.paths.current), await readlink(this.paths.current))

            value = JSON.parse(await readFile(join(directory, ".release.json"), "utf8"))
        }

        catch (error) {

            if (record(error) && error.code === "ENOENT") return undefined

            throw new Error(`The System current release is invalid: ${this.paths.current}`)
        }

        const within = relative(this.paths.releases, directory)

        if (!releaseRecord(value) || isAbsolute(within) || within.startsWith("..") || within === "") {

            throw new Error(`The System current release is invalid: ${this.paths.current}`)
        }

        if (!existsSync(join(directory, "server", "main.js"))) throw new Error(`The installed System ${value.version} is incomplete`)

        return { ...value, directory }
    }

    /** Serialize operations that can change files or native-service state. */
    public async exclusive<T>(work: () => Promise<T>) {

        await mkdir(this.paths.root, { recursive: true })

        const lock = join(this.paths.root, ".operation")

        const owner = String(process.pid)

        while (true) {

            try {

                const handle = await open(lock, "wx", 0o600)

                try {

                    await handle.writeFile(`${owner}\n`)

                    return await work()
                }

                finally {

                    await handle.close()

                    await rm(lock, { force: true })
                }
            }

            catch (error) {

                if (!record(error) || error.code !== "EEXIST") throw error

                const pid = await lockOwner(lock)

                if (pid !== undefined && processAlive(pid)) throw new Error(`Another PhreshOS System operation is running (${pid})`)

                const stale = `${lock}.stale-${randomUUID()}`

                try {

                    await rename(lock, stale)

                    await rm(stale, { force: true })
                }

                catch (replacement) {

                    if (!record(replacement) || replacement.code !== "ENOENT") throw replacement
                }
            }
        }
    }

    public async prepare(release: DownloadedSystem): Promise<PreparedSystem> {

        await mkdir(this.paths.releases, { recursive: true })

        const directory = await mkdtemp(join(this.paths.releases, ".staging-"))

        try {

            extract(release.bytes, directory)

            await validateDistribution(directory)

            await this.dependencies(directory)

            return { release, directory }
        }

        catch (error) {

            await rm(directory, { recursive: true, force: true })

            throw error
        }
    }

    public async abandon(prepared: PreparedSystem) {

        await rm(prepared.directory, { recursive: true, force: true })
    }

    public async activate(prepared: PreparedSystem, previous: InstalledSystem | undefined): Promise<SystemActivation> {

        const directory = join(this.paths.releases, prepared.release.version)

        const backup = `${directory}.previous-${randomUUID()}`

        const hadDirectory = existsSync(directory)

        const installedAt = new Date().toISOString()

        if (hadDirectory) await rename(directory, backup)

        try {

            await writeFile(join(prepared.directory, ".release.json"), `${JSON.stringify({

                version: prepared.release.version,

                digest: prepared.release.digest,

                installedAt
            }, null, 2)}\n`, { mode: 0o600 })

            await rename(prepared.directory, directory)

            await this.pointTo(directory)
        }

        catch (error) {

            await rm(directory, { recursive: true, force: true })

            if (hadDirectory) await rename(backup, directory)

            if (previous) await this.pointTo(previous.directory)

            throw error
        }

        const installed: InstalledSystem = {

            version: prepared.release.version,

            digest: prepared.release.digest,

            directory,

            installedAt
        }

        let settled = false

        return {

            installed,

            commit: async () => {

                if (settled) return

                settled = true

                if (hadDirectory) await rm(backup, { recursive: true, force: true })

                await this.removeOtherReleases(directory).catch(() => undefined)
            },

            rollback: async () => {

                if (settled) return

                settled = true

                if (previous) await this.pointTo(previous.directory)

                else await rm(this.paths.current, { force: true })

                await rm(directory, { recursive: true, force: true })

                if (hadDirectory) await rename(backup, directory)
            }
        }
    }

    public async remove() {

        await rm(this.paths.root, { recursive: true, force: true })
    }

    private async removeOtherReleases(current: string) {

        for (const entry of await readdir(this.paths.releases, { withFileTypes: true })) {

            if (!entry.isDirectory()) continue

            const directory = join(this.paths.releases, entry.name)

            if (directory !== current) await rm(directory, { recursive: true, force: true })
        }
    }

    private async pointTo(directory: string) {

        await mkdir(dirname(this.paths.current), { recursive: true })

        const temporary = `${this.paths.current}.${randomUUID()}.tmp`

        try {

            await symlink(relative(dirname(this.paths.current), directory), temporary, "dir")

            await rename(temporary, this.paths.current)
        }

        finally {

            await rm(temporary, { force: true })
        }
    }
}

async function validateDistribution(directory: string) {

    let manifest: unknown

    try {

        manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))
    }

    catch {

        throw new Error("The System release has no valid production package manifest")
    }

    if (!record(manifest) || manifest.type !== "module" || !record(manifest.scripts) || manifest.scripts.start !== "node server/main.js" || !record(manifest.dependencies)) {

        throw new Error("The System release package manifest is invalid")
    }

    for (const path of ["server/main.js", "client/index.html"]) {

        if (!existsSync(join(directory, path))) throw new Error(`The System release is missing ${path}`)
    }
}

function extract(bytes: Buffer, directory: string) {

    const archive = new AdmZip(bytes)

    for (const entry of archive.getEntries()) {

        const name = entry.entryName.replaceAll("\\", "/")

        const destination = resolve(directory, name)

        const within = relative(directory, destination)

        if (!name || name.startsWith("/") || name.split("/").includes("..") || isAbsolute(within) || within.startsWith("..")) {

            throw new Error(`The System release contains an unsafe path: ${entry.entryName}`)
        }

        if (entry.isDirectory) {

            requireDirectory(destination)

            continue
        }

        requireDirectory(dirname(destination))

        writeFileSync(destination, entry.getData(), { mode: 0o600 })
    }
}

function requireDirectory(path: string) {

    mkdirSync(path, { recursive: true, mode: 0o700 })
}

async function installProductionDependencies(directory: string) {

    const npm = process.platform === "win32" ? "npm.cmd" : "npm"

    await requireSuccess(npm, ["install", "--omit=dev", "--no-audit", "--no-fund", "--package-lock=false"], { cwd: directory })
}

interface ReleaseRecord {

    version: string

    digest: string

    installedAt: string
}

function releaseRecord(value: unknown): value is ReleaseRecord {

    return record(value)

        && typeof value.version === "string"

        && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value.version)

        && typeof value.digest === "string"

        && /^[a-f0-9]{64}$/.test(value.digest)

        && typeof value.installedAt === "string"
}

function record(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function lockOwner(path: string) {

    for (let attempt = 0; attempt < 2; attempt += 1) {

        try {

            const value = (await readFile(path, "utf8")).trim()

            if (/^[1-9][0-9]*$/.test(value)) return Number(value)
        }

        catch (error) {

            if (!record(error) || error.code !== "ENOENT") throw error

            return undefined
        }

        await new Promise(settle => setTimeout(settle, 50))
    }

    return undefined
}

function processAlive(pid: number) {

    try {

        process.kill(pid, 0)

        return true
    }

    catch (error) {

        return record(error) && error.code === "EPERM"
    }
}
