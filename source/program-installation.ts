import { Project } from "@phreshos/node"
import type { ProgramDefinition, SystemProgramEntity } from "@phreshos/core"
import writeProgramCommandOutput from "./program-command-output.ts"

export interface ProgramInstallationOptions {

    run?: boolean
}

export interface ProgramInstallationResult {

    program: {

        identity: string

        name: string

        version: string | null
    }

    replaced: boolean

    process: string | null
}

/** Install one prepared Program and await every explicitly requested outcome. */
export default async function installProgram(program: Project | ProgramDefinition, options: ProgramInstallationOptions = {}) {

    const system = await (await import("@phreshos/node")).System.connect()

    const identity = program instanceof Project ? program.config.identity : program.identity

    const current = await system.program.find(identity)

    const replaced = await current?.installed() ?? false

    let installed: SystemProgramEntity | null = null

    let process: string | null = null

    let installationFinished = false

    try {

        if (program instanceof Project) {

            await program.build()

            installed = await system.forceCreateProgram(program.productionDefinition())
        }

        else installed = await system.forceCreateProgram(program)

        for await (const chunk of installed.install()) writeProgramCommandOutput(chunk)

        installationFinished = true

        if (options.run) process = (await installed.process.create()).identity
    }

    catch (error) {

        if (installed && !installationFinished) {

            try { await installed.forget() }

            catch { /* Preserve the installation failure. */ }
        }

        throw error
    }

    finally { await system.disconnect() }


    if (!installed) throw new Error("The System ended Program installation without confirming it")

    if (options.run && !process) throw new Error("The System installed the Program without confirming that it is running")

    return {

        program: { identity: installed.identity, name: installed.name, version: installed.version },

        replaced,

        process
    } satisfies ProgramInstallationResult
}
