import type { Config } from "@phreshos/core"
import { Project, type Manifest } from "@phreshos/node"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { isAbsolute, normalize, resolve, sep } from "node:path"

export const configFile = "phresh.config.ts"

/** Read the current Project through the reusable Node project model. */
export async function readConfig(directory = process.cwd()): Promise<Config> {
    return (await Project.open(directory)).config
}

export function containedServerEntry(entry: string) {
    if (isAbsolute(entry)) return false
    const path = normalize(entry)
    return path !== ".." && !path.startsWith(`..${sep}`)
}

export async function readManifest(directory = process.cwd()): Promise<Manifest> {
    const path = resolve(directory, "package.json")
    if (!existsSync(path)) throw new Error("There is no package.json here")

    const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest
    if (typeof manifest.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name)) {
        throw new Error("package.json must have a kebab-case name")
    }
    return manifest
}

export type { Manifest }
