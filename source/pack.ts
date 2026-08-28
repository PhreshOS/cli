import type { Config, ServerExecution } from "@phreshos/core"
import { readConfig, readManifest } from "./project.ts"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import AdmZip from "adm-zip"
import build from "./build-command.ts"

/**
 * Package what is at each half's location.
 *
 * When the author config declares `buildCommand`, it completes before
 * any files are gathered. Pack remains an assembler rather than a
 * build tool: it invokes the author's command, then packages its result.
 *
 * The authoring tree and the installable form differ. A program may
 * leave its halves anywhere; the package always has them in the same
 * places, so the artifact's shape is the contract's rather than the
 * author's. The program.json names those canonical places explicitly:
 * a declared half always has a location, even when the system chose it.
 *
 * There is **no wrapping directory**. `program.json`, `server/`,
 * `client/`, optional `icon.png`, and optional `agent.md` sit at the package's
 * root, and the directory
 * the system installs into is named from the program's own `identity`.
 * The archive itself therefore needs no second naming layer.
 *
 * The files go into the archive directly rather than through a staging
 * directory: a copy of a build is a thing that can be stale. The generated
 * standalone program.json is also placed beside the archive for release
 * discovery; both declarations are made from the same bytes.
 */
export default async function pack(directory = process.cwd()) {

    const config = await readConfig(directory)

    await build(config, directory)

    const manifest = await readManifest(directory)

    const version = config.version ?? manifest.version

    if (config.version && manifest.version && config.version !== manifest.version) {

        console.log(`phresh: packing ${config.version}, though package.json says ${manifest.version}\n`)
    }

    const zip = new AdmZip()

    if (config.server) place(zip, directory, config.server.location, "server")

    if (config.client) {

        place(zip, directory, config.client.location, "client")

        if (!zip.getEntry("client/index.html")) throw new Error(`The client files have no index.html — ${config.client.location} is not where a client half is`)
    }

    if (config.icon) file(zip, directory, config.icon, "icon.png", "Program icon")

    if (config.agent) file(zip, directory, config.agent, "agent.md", "Program agent documentation")

    const declaration = Buffer.from(JSON.stringify(program(config, version), null, 4) + "\n")

    zip.addFile("program.json", declaration)

    // The standalone release declaration and the declaration inside the
    // archive are the same bytes. There is no separately authored catalog
    // description that can drift from the installable Program.
    writeFileSync(resolve(directory, "program.json"), declaration)

    const archive = `${config.identity}@${version ?? "0.0.0"}.zip`

    const bytes = zip.toBuffer()

    writeFileSync(resolve(directory, archive), bytes)

    const digest = createHash("sha256").update(bytes).digest("hex")

    writeFileSync(resolve(directory, `${archive}.sha256`), `${digest}  ${archive}\n`)

    console.log(`\nPacked ${archive}`)

    return archive
}

// The derivation, and the whole of it. What the config says about the
// program passes through; what it says about the build does not. Half
// locations are rewritten to the canonical places inside the package.
function program(config: Config, version: string | undefined) {

    return {

        identity: config.identity,

        name: config.name,

        version,

        description: config.description,

        icon: config.icon ? "icon.png" : undefined,

        agent: config.agent ? "agent.md" : undefined,

        categories: config.categories,

        keywords: config.keywords,

        website: config.website,

        ...config.server && { server: {

            location: "server",

            start: config.server.start,

            installCommand: config.server.installCommand,

            uninstallCommand: config.server.uninstallCommand,

            ...serverExecution(config.server)
        } },

        ...config.client && { client: { location: "client", start: config.client.start, title: config.client.title, size: config.client.size, position: config.client.position, layer: config.client.layer, minimize: config.client.minimize } }
    }
}

function serverExecution(server: ServerExecution) {

    return server.startCommand !== undefined

        ? { startCommand: server.startCommand }

        : { entryFile: server.entryFile }
}

// What is at a half's location, where the package keeps it. A half that
// was declared and is not there is the answer to whether it was built.
function place(zip: AdmZip, directory: string, location: string, half: string) {

    const from = resolve(directory, location)

    if (!existsSync(from)) throw new Error(`The ${half} files are not at ${location} — nothing was built there`)

    zip.addLocalFolder(from, half)
}

function file(zip: AdmZip, directory: string, location: string, target: string, label: string) {

    const from = resolve(directory, location)

    if (!existsSync(from) || !statSync(from).isFile()) throw new Error(`The ${label} is not at ${location}`)

    zip.addFile(target, readFileSync(from))
}
