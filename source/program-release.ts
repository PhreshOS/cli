import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import AdmZip from "adm-zip"

const officialPrograms = {

    setup: {

        identity: "setup",

        repository: "PhreshOS/setup-program"
    }
} as const

export interface PreparedProgramRelease {

    program: unknown

    release: ProgramRelease

    dispose(): Promise<void>
}

export interface ProgramRelease {

    identity: string

    version: string

    archive: string

    checksum: string
}

/** Resolve, verify, and unpack one official production Program release. */
export async function prepareOfficialProgram(name: string, fetcher: typeof fetch = fetch): Promise<PreparedProgramRelease> {

    const release = await resolveOfficialProgramRelease(name, fetcher)

    const bytes = await downloadProgramRelease(release, fetcher)

    const directory = await mkdtemp(join(tmpdir(), `phresh-${release.identity}-`))

    try {

        extract(bytes, directory)

        const program = await readProgram(directory, release)

        return {

            program,

            release,

            dispose: async () => { await rm(directory, { recursive: true, force: true }) }
        }
    }

    catch (error) {

        await rm(directory, { recursive: true, force: true })

        throw error
    }
}

export async function resolveOfficialProgramRelease(name: string, fetcher: typeof fetch = fetch) {

    const official = officialPrograms[name as keyof typeof officialPrograms]

    if (!official) throw new Error(`No official Program is named "${name}"`)

    const response = await fetcher(`https://api.github.com/repos/${official.repository}/releases?per_page=100`, {

        headers: {

            Accept: "application/vnd.github+json",

            "User-Agent": "@phreshos/cli"
        },

        signal: AbortSignal.timeout(30_000)
    })

    if (!response.ok) throw new Error(`The ${name} release list could not be read (${response.status} ${response.statusText})`)

    return selectProgramRelease(official.identity, await response.json())
}

export function selectProgramRelease(identity: string, value: unknown): ProgramRelease {

    if (!Array.isArray(value)) throw new Error(`The ${identity} release list is invalid`)

    const releases = value.flatMap(function (item): ProgramRelease[] {

        if (!record(item) || item.draft === true || item.prerelease === true || typeof item.tag_name !== "string" || !Array.isArray(item.assets)) return []

        const version = parseVersion(item.tag_name)

        if (!version) return []

        const archiveName = `${identity}@${version}.zip`

        const archive = asset(item.assets, archiveName)

        const checksum = asset(item.assets, `${archiveName}.sha256`)

        return archive && checksum ? [{ identity, version, archive, checksum }] : []
    })

    releases.sort((left, right) => compare(right.version, left.version))

    const selected = releases[0]

    if (!selected) throw new Error(`No stable ${identity} Program release is available`)

    return selected
}

export async function downloadProgramRelease(release: ProgramRelease, fetcher: typeof fetch = fetch) {

    const [archive, checksum] = await Promise.all([

        fetchAsset(release.archive, fetcher),

        fetchAsset(release.checksum, fetcher)
    ])

    const bytes = Buffer.from(await archive.arrayBuffer())

    const said = (await checksum.text()).trim()

    const name = `${release.identity}@${release.version}.zip`

    const match = /^([a-f0-9]{64})\s+(.+)$/i.exec(said)

    if (!match || match[2] !== name) throw new Error(`The checksum for ${name} is invalid`)

    const digest = createHash("sha256").update(bytes).digest("hex")

    if (digest !== match[1]?.toLowerCase()) throw new Error(`The downloaded ${name} does not match its SHA-256 checksum`)

    return bytes
}

async function readProgram(directory: string, release: ProgramRelease) {

    let value: unknown

    try { value = JSON.parse(await readFile(join(directory, "program.json"), "utf8")) }

    catch { throw new Error(`The ${release.identity} Program package has no valid program.json`) }

    if (!record(value) || value.identity !== release.identity || value.version !== release.version) {

        throw new Error(`The ${release.identity} Program package identity or version does not match its release`)
    }

    if (value.storage !== undefined) throw new Error("A published Program package cannot choose its installed storage")

    return {

        ...value,

        ...pathField(value, directory, "apiDocs", "api-docs.md"),

        ...pathField(value, directory, "icon", "icon.png"),

        ...half(value, directory, "server"),

        ...half(value, directory, "client")
    }
}

function half(value: Record<string, unknown>, directory: string, name: "server" | "client") {

    const declared = value[name]

    if (declared === undefined) return {}

    if (!record(declared) || declared.location !== name) throw new Error(`A published Program's ${name} must be packaged at ./${name}`)

    return { [name]: { ...declared, location: join(directory, name) } }
}

function pathField(value: Record<string, unknown>, directory: string, field: "apiDocs" | "icon", canonical: string) {

    const declared = value[field]

    if (declared === undefined) return {}

    if (declared !== canonical) throw new Error(`A published Program's ${field} must be packaged as ${canonical}`)

    return { [field]: join(directory, canonical) }
}

function extract(bytes: Buffer, directory: string) {

    const archive = new AdmZip(bytes)

    for (const entry of archive.getEntries()) {

        const name = entry.entryName.replaceAll("\\", "/")

        const destination = resolve(directory, name)

        const within = relative(directory, destination)

        if (!name || name.startsWith("/") || name.split("/").includes("..") || isAbsolute(within) || within.startsWith("..")) {

            throw new Error(`The Program package contains an unsafe path: ${entry.entryName}`)
        }

        if (entry.isDirectory) {

            mkdirSync(destination, { recursive: true, mode: 0o700 })

            continue
        }

        mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })

        writeFileSync(destination, entry.getData(), { mode: 0o600 })
    }
}

async function fetchAsset(url: string, fetcher: typeof fetch) {

    const response = await fetcher(url, {

        headers: { "User-Agent": "@phreshos/cli" },

        signal: AbortSignal.timeout(120_000)
    })

    if (!response.ok) throw new Error(`A Program release asset could not be downloaded (${response.status} ${response.statusText})`)

    return response
}

function asset(assets: unknown[], name: string) {

    const found = assets.find(item => record(item) && item.name === name && typeof item.browser_download_url === "string")

    return record(found) && typeof found.browser_download_url === "string" ? found.browser_download_url : undefined
}

function parseVersion(tag: string) {

    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)

    return match ? tag.slice(1) : undefined
}

function compare(left: string, right: string) {

    const a = left.split(".").map(Number)

    const b = right.split(".").map(Number)

    return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0)
}

function record(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null && !Array.isArray(value)
}
