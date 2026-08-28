import { Project } from "@phreshos/gateway"
import type { ProgramDescription } from "@phreshos/core"
import { dim, heading, line } from "./style.ts"
import installProgram, { type ProgramInstallationOptions } from "./program-installation.ts"
import { prepareOfficialProgram } from "./program-release.ts"

/**
 * Lay this program out on this machine's system.
 *
 * A local project is built and derived from its authoring declaration. An
 * official name resolves a verified production package and turns its
 * canonical paths into the same concrete description. From that point on,
 * both sources cross the exact same gateway and the System performs the exact
 * same authoritative installation.
 *
 * When the author config declares `buildCommand`, it runs here before the
 * production Program is derived and sent. The command remains authoring
 * metadata and never becomes part of the installed Program.
 *
 * Installation remains distinct from execution unless `run` or `startup`
 * is explicitly requested. A run created here belongs to the installed
 * Program and therefore outlives this command; `phresh start` and `phresh
 * dev` remain attached authoring runs whose lifetime is the terminal's.
 */
export default async function install(options: InstallOptions = {}) {

    const directory = options.directory ?? process.cwd()

    const prepared = options.name ? await prepareOfficialProgram(options.name) : null

    try {

        const program = prepared ? prepared.program as ProgramDescription : await Project.open(directory)

        if (program instanceof Project && program.config.buildCommand) line("build", program.config.buildCommand)

        const result = await installProgram(program, options)

        if (options.announce !== false) {

            const { name, identity, version } = result.program

            heading(`${name || identity}${version ? ` ${version}` : ""}`, result.replaced ? "reinstalled" : "installed")

            if (result.replaced) console.log(`  ${dim("its storage was kept, and its previous processes were ended")}\n`)

            if (result.startupEnabled) line("startup", "enabled")

            if (result.process) line("process", result.process)
        }

        return result
    }

    finally { await prepared?.dispose() }
}

export interface InstallOptions extends ProgramInstallationOptions {

    name?: string

    directory?: string

    announce?: boolean
}
