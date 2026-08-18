import type { DownloadedSystem, SystemRelease } from "./types.ts"
import { createHash } from "node:crypto"

const releases = "https://api.github.com/repos/PhreshOS/system/releases?per_page=100"

const compatible = { major: 0, minor: 1 }

/** Resolve the newest stable release in the System line supported by this CLI. */
export async function resolveSystemRelease(fetcher: typeof fetch = fetch) {

    const response = await fetcher(releases, {

        headers: {

            Accept: "application/vnd.github+json",

            "User-Agent": "@phreshos/cli"
        },

        signal: AbortSignal.timeout(30_000)
    })

    if (!response.ok) throw new Error(`The System release list could not be read (${response.status} ${response.statusText})`)

    return selectSystemRelease(await response.json())
}

export function selectSystemRelease(value: unknown): SystemRelease {

    if (!Array.isArray(value)) throw new Error("The System release list is invalid")

    const candidates = value.flatMap(function (item): SystemRelease[] {

        if (!record(item) || item.draft === true || item.prerelease === true || typeof item.tag_name !== "string" || !Array.isArray(item.assets)) return []

        const version = parseVersion(item.tag_name)

        if (!version || version.major !== compatible.major || version.minor !== compatible.minor) return []

        const archiveName = `phreshos@${version.value}.zip`

        const checksumName = `${archiveName}.sha256`

        const archive = asset(item.assets, archiveName)

        const checksum = asset(item.assets, checksumName)

        return archive && checksum ? [{ version: version.value, archive, checksum }] : []
    })

    candidates.sort((left, right) => compare(right.version, left.version))

    const selected = candidates[0]

    if (!selected) throw new Error(`No compatible PhreshOS System ${compatible.major}.${compatible.minor}.x release is available`)

    return selected
}

/** Download both release assets and refuse any byte not named by the checksum. */
export async function downloadSystemRelease(release: SystemRelease, fetcher: typeof fetch = fetch): Promise<DownloadedSystem> {

    const [archive, checksum] = await Promise.all([

        fetchAsset(release.archive, fetcher),

        fetchAsset(release.checksum, fetcher)
    ])

    const bytes = Buffer.from(await archive.arrayBuffer())

    const said = (await checksum.text()).trim()

    const name = `phreshos@${release.version}.zip`

    const match = /^([a-f0-9]{64})\s+(.+)$/i.exec(said)

    if (!match || match[2] !== name) throw new Error(`The checksum for ${name} is invalid`)

    const digest = createHash("sha256").update(bytes).digest("hex")

    if (digest !== match[1]?.toLowerCase()) throw new Error(`The downloaded ${name} does not match its SHA-256 checksum`)

    return { ...release, bytes, digest }
}

async function fetchAsset(url: string, fetcher: typeof fetch) {

    const response = await fetcher(url, {

        headers: { "User-Agent": "@phreshos/cli" },

        signal: AbortSignal.timeout(120_000)
    })

    if (!response.ok) throw new Error(`A System release asset could not be downloaded (${response.status} ${response.statusText})`)

    return response
}

function asset(assets: unknown[], name: string) {

    const found = assets.find(item => record(item) && item.name === name && typeof item.browser_download_url === "string")

    return record(found) && typeof found.browser_download_url === "string" ? found.browser_download_url : undefined
}

function parseVersion(tag: string) {

    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)

    if (!match) return undefined

    return {

        value: tag.slice(1),

        major: Number(match[1]),

        minor: Number(match[2]),

        patch: Number(match[3])
    }
}

function compare(left: string, right: string) {

    const a = left.split(".").map(Number)

    const b = right.split(".").map(Number)

    return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0)
}

function record(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null
}
