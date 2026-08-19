import { type ClientConfig, type Config, type ServerConfig } from "@phreshos/core"
import { configFile, readManifest } from "./project.ts"
import { dim } from "./style.ts"
import ensureProjectDependency, { projectScript } from "./project-dependency.ts"
import prompts from "./prompts.ts"
import { existsSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Initialize an existing project as a Program.
 *
 * A real terminal gets a short interview. Everywhere else, every choice is a
 * named option and the command never waits for input. Both routes produce the
 * same config and ensure the matching Core dependency through this one
 * function.
 */
export default async function init(options: InitOptions = {}, directory = process.cwd(), coreRange = "^0.1.0") {

    const manifest = await readManifest(directory)

    const path = resolve(directory, configFile)

    const interaction = prompts()

    const { interactive, ask, yes } = interaction

    const explicitShape = options.server === true || options.client === true

    if (existsSync(path) && options.force !== true && !interactive) throw new Error(`${configFile} already exists — use --force to replace it`)

    interaction.begin("Initialize Program", manifest.name)

    if (existsSync(path) && options.force !== true) {

        interaction.detail(configFile, "already initialized")

        if (!await yes("The existing configuration must be replaced before this project can be initialized again.", "Replace it?", false)) {

            interaction.finish("No changes made")

            return
        }
    }

    interaction.detail("identity", manifest.name, "package.json")

    if (manifest.version) interaction.detail("version", manifest.version, "package.json")

    if (manifest.description) interaction.detail("description", manifest.description, "package.json")

    let serverSelected = options.server === true

    let clientSelected = options.client === true

    if (!explicitShape) {

        if (!interactive) throw new Error("Choose at least one half with --server, --client, or both")

        serverSelected = await yes("A Server runs on the host machine and can keep working without an open desktop.", "Does this Program have a Server?", true)

        clientSelected = !serverSelected || await yes("A Client runs through a desktop and provides the Program's visual interface.", "Does this Program have a Client?", true)
    }

    if (!serverSelected && !clientSelected) throw new Error("A Program must have a server half, a client half, or both")

    const name = options.name ?? (interactive ? await ask("This name is shown to people; the package name remains the Program identity.", "What name should people see?", manifest.name) : undefined)

    if (name !== undefined && name.trim().length === 0) throw new Error("--name must not be empty")

    let buildCommand = options.buildCommand

    if (interactive && buildCommand === undefined) {

        const suggested = manifest.scripts?.build && projectScript(directory, manifest.packageManager, "build")

        const builds = await yes("Production operations need the Program's built files.", "Build before start, install, and pack?", Boolean(suggested))

        if (builds) buildCommand = await ask("This command produces the production Server and Client files.", "What command builds the Program?", suggested || undefined)
    }

    if (buildCommand !== undefined && buildCommand.trim().length === 0) throw new Error("A build command must not be empty")

    let server: ServerConfig | undefined

    if (serverSelected) {

        const location = options.serverLocation ?? (interactive ? await ask("The system runs the production Server from this project-relative directory.", "Where are the production Server files?", clientSelected ? "dist/server" : "dist") : "")

        const startCommand = options.serverStartCommand ?? (interactive ? await ask("This command runs inside the production Server directory.", "What command starts the production Server?", "node main.js") : "")

        if (!location) throw new Error("--server-location is required without a terminal")

        if (!startCommand) throw new Error("--server-start-command is required without a terminal")

        let development = options.serverDevelopmentStartCommand

        if (interactive && development === undefined) {

            const suggested = manifest.scripts?.dev && projectScript(directory, manifest.packageManager, "dev")

            if (await yes("Development mode can run the Server directly from the project source.", "Run the Server from source during development?", Boolean(suggested && !clientSelected))) {

                development = await ask("This command remains attached to the phresh dev session.", "What command starts the development Server?", suggested || undefined)
            }
        }

        if (development !== undefined && development.trim().length === 0) throw new Error("A server development command must not be empty")

        server = { location, startCommand, ...development && { development: { startCommand: development } } }
    }

    let client: ClientConfig | undefined

    if (clientSelected) {

        const location = options.clientLocation ?? (interactive ? await ask("The system serves the production Client from this project-relative directory.", "Where are the production Client files?", serverSelected ? "dist/client" : "dist") : "")

        if (!location) throw new Error("--client-location is required without a terminal")

        let developmentUrl = options.clientDevelopmentUrl

        let developmentStartCommand = options.clientDevelopmentStartCommand

        if (interactive && developmentUrl === undefined && developmentStartCommand === undefined) {

            const suggested = manifest.scripts?.dev && projectScript(directory, manifest.packageManager, "dev")

            if (await yes("A development server can provide live updates instead of built Client files.", "Use a Client development server?", Boolean(suggested))) {

                developmentUrl = await ask("The desktop opens this exact HTTP or HTTPS address during phresh dev.", "What URL serves the development Client?", "http://localhost:5173/")

                if (await yes("The CLI can own the development server and stop it when the session ends.", "Should phresh dev start the Client server?", Boolean(suggested))) {

                    developmentStartCommand = await ask("This command remains attached to the phresh dev session.", "What command starts the Client development server?", suggested || undefined)
                }
            }
        }

        if (developmentStartCommand !== undefined && developmentUrl === undefined) throw new Error("--client-development-url is required with --client-development-start-command")

        if (developmentUrl !== undefined && developmentUrl.trim().length === 0) throw new Error("A client development URL must not be empty")

        if (developmentUrl !== undefined && !httpUrl(developmentUrl)) throw new Error("A client development URL must use HTTP or HTTPS")

        if (developmentStartCommand !== undefined && developmentStartCommand.trim().length === 0) throw new Error("A client development command must not be empty")

        client = {

            location,

            ...developmentUrl && { development: { url: developmentUrl, ...developmentStartCommand && { startCommand: developmentStartCommand } } }
        }
    }

    const described = {

        identity: manifest.name,

        name,

        version: manifest.version,

        description: manifest.description,

        buildCommand
    }

    const config: Config = server

        ? { ...described, server, ...client && { client } }

        : { ...described, client: client! }

    await ensureProjectDependency("@phreshos/core", coreRange, directory)

    writeFileSync(path, compose(config))

    if (config.server) interaction.detail("server", config.server.startCommand, `./${config.server.location}`)

    if (config.client) interaction.detail("client", `./${config.client.location}`)

    const next = [config.server?.development || config.client?.development ? "phresh dev" : null, "phresh start", "phresh install"].filter(Boolean)

    interaction.message()

    interaction.message(`${dim("Next:")} ${next.join(`  ${dim("or")}  `)}`)

    if (config.client) {

        interaction.message()

        interaction.detail("base URL", "./", "required for production assets")

        if (config.client.development) interaction.detail("CORS", "enabled", "required on the development server")
    }

    interaction.finish(`${configFile} created`)
}

function compose(config: Config) {

    const blocks = [

        field("identity", config.identity),

        field("name", config.name),

        field("version", config.version),

        field("description", config.description),

        field("buildCommand", config.buildCommand),

        half("server", config.server && {

            location: config.server.location,

            startCommand: config.server.startCommand,

            ...config.server.development && { development: config.server.development }
        }),

        half("client", config.client && {

            location: config.client.location,

            ...config.client.development && { development: config.client.development }
        })
    ]

    return [

        `import { defineConfig } from "@phreshos/core"`,

        "",

        "export default defineConfig({",
        blocks.filter(Boolean).join(",\n"),

        "})",

        ""

    ].join("\n")
}

function field(name: string, value: string | undefined) {

    return value === undefined ? "" : `    ${name}: ${JSON.stringify(value)}`
}

function half(name: string, values: ComposedHalf | undefined) {

    if (!values) return ""

    const inside = Object.entries(values).map(function ([key, value]) {

        if (typeof value === "string") return `        ${key}: ${JSON.stringify(value)}`

        const nested = Object.entries(value).map(([nestedKey, nestedValue]) => `            ${nestedKey}: ${JSON.stringify(nestedValue)}`)

        return `        ${key}: {\n${nested.join(",\n")}\n        }`
    })

    return `    ${name}: {\n${inside.join(",\n")}\n    }`
}

function httpUrl(value: string) {

    try {

        const url = new URL(value)

        return url.protocol === "http:" || url.protocol === "https:"
    }

    catch { return false }
}

export interface InitOptions {

    name?: string

    buildCommand?: string

    server?: boolean

    serverLocation?: string

    serverStartCommand?: string

    serverDevelopmentStartCommand?: string

    client?: boolean

    clientLocation?: string

    clientDevelopmentUrl?: string

    clientDevelopmentStartCommand?: string

    force?: boolean
}

interface ComposedHalf {

    location: string

    startCommand?: string

    development?: {

        url?: string

        startCommand?: string
    }
}
