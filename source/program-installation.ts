import { Project } from "@phreshos/node"
import type { Program, ProgramDefinition } from "@phreshos/core"
import writeProgramCommandOutput from "./program-command-output.ts"

export interface ProgramInstallationOptions {

    run?: boolean
    purge?: boolean
}

export interface ProgramInstallationResult {

    program: {

        identity: string

        name: string

        version: string
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

    let installed: Program | null = null

    let process: string | null = null

    let installationFinished = false
    let stopObserving: (() => void) | undefined

    try {

        if (program instanceof Project) {

            await program.build()

            installed = await system.program.forceCreate(program.productionDefinition())
        }

        else installed = await system.program.forceCreate(program)

        // A definition-owned installLaunch can create the Process even when
        // the CLI did not supply --run, so observation belongs to installation.
        stopObserving = installed.subscribe("processCreate", created => { process ??= created.identity })

        for await (const chunk of installed.install({ launch: options.run ? true : undefined, purge: options.purge })) writeProgramCommandOutput(chunk)

        installationFinished = true

    }

    catch (error) {

        if (installed && !installationFinished) {

            try { if (!await installed.installed()) await installed.forget() }

            catch { /* Preserve the installation failure. */ }
        }

        throw error
    }

    finally { stopObserving?.(); await system.disconnect() }


    if (!installed) throw new Error("The System ended Program installation without confirming it")

    if (options.run && !process) throw new Error("The System installed the Program without confirming that it is running")

    return {

        program: { identity: installed.identity, name: installed.name, version: installed.version },

        replaced,

        process
    } satisfies ProgramInstallationResult
}
