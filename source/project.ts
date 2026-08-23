import { isRelativeValue, layers, type Config, type Position, type Size } from "@phreshos/core"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const configFile = "phresh.config.ts"

export async function readConfig(directory = process.cwd()) {

    const path = resolve(directory, configFile)

    if (!existsSync(path)) throw new Error(`There is no ${configFile} here — run: phresh init`)

    // The supported Node runtime reads erasable TypeScript directly. Keeping
    // this file typed gives an author editor assistance without another config
    // format or a build step.
    const loaded = await import(pathToFileURL(path).href).catch(function (error: Error) {

        throw new Error(`${configFile} could not be read (${error.message})`)
    }) as { default?: Config }

    const config = loaded.default

    if (!config) throw new Error(`${configFile} must export its config as the default export`)

    coherent(config)

    return config
}

// Whether the words agree with each other. Nothing here touches a disk
// or asks whether a build ran: it is the same question the system asks
// of a program.json when it is constructed, asked earlier, where the
// person who mistyped it is still standing.
function coherent(config: Config) {

    // A name is the name of a directory before it is anything else, and
    // the system checks it again where it makes one. Checked here too so
    // the mistake is found by the CLI rather than at the runtime border.
    if (typeof config.identity !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.identity)) throw new Error("A program's identity is kebab-case, because it is also the name of its directory")

    if (!config.server && !config.client) throw new Error("A program must have a server half, a client half, or both")

    for (const field of ["name", "version", "description", "icon"] as const) {

        if (config[field] !== undefined && typeof config[field] !== "string") throw new Error(`A program's ${field} must be text`)
    }

    if (config.buildCommand !== undefined && (typeof config.buildCommand !== "string" || config.buildCommand.trim().length === 0)) throw new Error("A program's buildCommand must be non-empty text")

    for (const half of ["server", "client"] as const) {

        const declared = config[half]

        if (declared === undefined) continue

        if (typeof declared !== "object" || declared === null || Array.isArray(declared)) throw new Error(`A program's ${half} half must be a declaration`)

        if (typeof declared.location !== "string") throw new Error(`A declared ${half} half must have a location`)

        if (declared.start !== undefined && typeof declared.start !== "boolean") throw new Error(`A declared ${half} endpoint's start default must be true or false`)

        if (declared.serviceDocs !== undefined && (typeof declared.serviceDocs !== "string" || declared.serviceDocs.trim().length === 0)) throw new Error(`A declared ${half} endpoint's serviceDocs must be a non-empty path`)
    }

    if (!(config.server && (config.server.start ?? true)) && !(config.client && (config.client.start ?? true))) throw new Error("A Program's default Process must start a server endpoint, a client endpoint, or both")

    if (config.server && (typeof config.server.startCommand !== "string" || config.server.startCommand.length === 0)) throw new Error("A server half must say what starts it")

    if (config.server?.installCommand !== undefined && typeof config.server.installCommand !== "string") throw new Error("A server half's install command must be text")

    if (config.client?.title !== undefined && typeof config.client.title !== "string") throw new Error("A client half's title must be text")

    if (config.client?.minimize !== undefined && typeof config.client.minimize !== "boolean") throw new Error("A client half's minimize default must be true or false")

    if (config.client && /^https?:\/\//i.test(config.client.location)) {

        try { new URL(config.client.location) }

        catch { throw new Error("A client half's URL must be a valid HTTP or HTTPS URL") }
    }

    // Said wrong is caught here, where the author is standing, rather
    // than becoming a window in no layer at all.
    if (config.client?.layer !== undefined && !layers.includes(config.client.layer)) throw new Error(`A client half's layer is one of ${layers.join(", ")} — not "${String(config.client.layer)}"`)

    const serverDevelopment = config.server?.development

    if (serverDevelopment !== undefined && (typeof serverDevelopment !== "object" || serverDevelopment === null || Array.isArray(serverDevelopment))) throw new Error("server.development must be a declaration")

    if (serverDevelopment !== undefined && (typeof serverDevelopment.startCommand !== "string" || serverDevelopment.startCommand.trim().length === 0)) throw new Error("server.development.startCommand must be non-empty text")

    const clientDevelopment = config.client?.development

    if (clientDevelopment !== undefined && (typeof clientDevelopment !== "object" || clientDevelopment === null || Array.isArray(clientDevelopment))) throw new Error("client.development must be a declaration")

    if (clientDevelopment !== undefined && !httpUrl(clientDevelopment.url)) throw new Error("client.development.url must be a valid HTTP or HTTPS URL")

    if (clientDevelopment?.startCommand !== undefined && (typeof clientDevelopment.startCommand !== "string" || clientDevelopment.startCommand.trim().length === 0)) throw new Error("client.development.startCommand must be non-empty text")

    for (const [what, value] of [["size", config.client?.size], ["position", config.client?.position]] as const) {

        if (value === undefined) continue

        if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`A window's ${what} must name both of its values`)

        const pair = what === "size" ? [(value as Size).width, (value as Size).height] : [(value as Position).x, (value as Position).y]

        if (!pair.every(isRelativeValue)) throw new Error(`A window's ${what} is a finite pixel number or a relative expression such as "50% + 10"`)
    }
}

function httpUrl(value: unknown) {

    if (typeof value !== "string" || value.trim().length === 0) return false

    try {

        const url = new URL(value)

        return url.protocol === "http:" || url.protocol === "https:"
    }

    catch { return false }
}

export async function readManifest(directory = process.cwd()) {

    const path = resolve(directory, "package.json")

    if (!existsSync(path)) throw new Error("There is no package.json here")

    const manifest = JSON.parse(await import("node:fs/promises").then(fs => fs.readFile(path, "utf-8"))) as Manifest

    if (typeof manifest.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name)) throw new Error("package.json must have a kebab-case name")

    return manifest
}

export interface Manifest {

    name: string

    version?: string

    description?: string

    packageManager?: string

    scripts?: Record<string, string>
}
