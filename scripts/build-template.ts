import metadata from "../package.json" with { type: "json" }
import { createHash } from "node:crypto"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, resolve, sep } from "node:path"
import AdmZip from "adm-zip"
import { readConfig } from "../source/project.ts"
import { resolveOfficialProgramRelease } from "../source/program-release.ts"

const repository = "PhreshOS/phresh-program"

const release = await resolveOfficialProgramRelease("phresh")

const archiveUrl = `https://github.com/${repository}/archive/refs/tags/v${release.version}.zip`

const output = resolve(import.meta.dirname, "../dist/template")

const descriptionOutput = resolve(import.meta.dirname, "../dist/template.json")

const excludedDirectories = new Set([".github", "dist", "node_modules", "scripts", "storage"])

const excludedRootFiles = new Set(["CONTRIBUTING.md", "LICENSE", "SECURITY.md"])

const excludedFiles = new Set([

    ".DS_Store",
    "bun.lock",
    "bun.lockb",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock"
])

const response = await fetch(archiveUrl)

if (!response.ok) throw new Error(`Could not download ${repository} v${release.version}: ${response.status} ${response.statusText}`)

const bytes = Buffer.from(await response.arrayBuffer())

const digest = createHash("sha256").update(bytes).digest("hex")

const archive = new AdmZip(bytes)

const entries = archive.getEntries()

const roots = new Set(entries.map(entry => entry.entryName.split("/")[0]).filter(Boolean))

if (roots.size !== 1) throw new Error(`The ${repository} v${release.version} source archive has an invalid root`)

const root = [...roots][0]!

rmSync(output, { recursive: true, force: true })

rmSync(descriptionOutput, { force: true })

for (const entry of entries) {

    if (entry.isDirectory || !entry.entryName.startsWith(`${root}/`)) continue

    const local = entry.entryName.slice(root.length + 1)

    if (!included(local)) continue

    const target = local === ".gitignore" ? "gitignore" : local

    const path = resolve(output, target)

    if (!path.startsWith(`${output}${sep}`)) throw new Error(`The ${repository} source archive contains an unsafe path: ${local}`)

    mkdirSync(dirname(path), { recursive: true })

    writeFileSync(path, entry.getData())
}

const manifestPath = resolve(output, "package.json")

const manifestSource = archive.readFile(`${root}/package.json`)

if (!manifestSource) throw new Error(`The ${repository} v${release.version} source archive has no package.json`)

const manifest = JSON.parse(manifestSource.toString("utf8")) as PackageManifest

if (manifest.name !== release.identity || manifest.version !== release.version) {

    throw new Error(`The ${repository} source manifest does not match release v${release.version}`)
}

manifest.scripts = select(manifest.scripts, ["dev", "start"])

manifest.devDependencies = {

    ...manifest.devDependencies,

    "@phreshos/cli": `^${metadata.version}`
}

delete manifest.author

delete manifest.license

delete manifest.repository

delete manifest.bugs

delete manifest.homepage

delete manifest.packageManager

writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n")

const config = await readConfig(output)

if (config.identity !== release.identity || config.name !== "Phresh Program" || config.version !== release.version) {

    throw new Error(`The ${repository} source declaration does not match release v${release.version}`)
}

writeFileSync(descriptionOutput, JSON.stringify({

    repository,

    version: release.version,

    sha256: digest,

    development: Boolean(config.server?.development || config.client?.development)
}, null, 4) + "\n")

function included(local: string) {

    const parts = local.split("/")

    if (local === "scripts/build.ts") return true

    if (parts.some(part => excludedDirectories.has(part))) return false

    if (parts.length === 1 && excludedRootFiles.has(local)) return false

    if (excludedFiles.has(parts.at(-1)!)) return false

    return !local.endsWith(".zip")
}

function select<Value>(source: Record<string, Value> | undefined, names: readonly string[]) {

    return Object.fromEntries(names.flatMap(name => source?.[name] === undefined ? [] : [[name, source[name]]]))
}

interface PackageManifest {

    name?: unknown

    version?: unknown

    scripts?: Record<string, string>

    devDependencies?: Record<string, string>

    author?: unknown

    license?: unknown

    repository?: unknown

    bugs?: unknown

    homepage?: unknown

    packageManager?: unknown
}
