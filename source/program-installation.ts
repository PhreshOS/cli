import { Project } from "@phreshos/node"
import type { ProgramDescription } from "@phreshos/core"
import writeProgramCommandOutput from "./program-command-output.ts"

export interface ProgramInstallationOptions {

    run?: boolean

    startup?: boolean
}

export interface ProgramInstallationResult {

    program: {

        identity: string

        name: string

        version: string | null
    }

    replaced: boolean

    startupEnabled: boolean

    process: string | null
}

/** Install one prepared Program and await every explicitly requested outcome. */
export default async function installProgram(program: Project | ProgramDescription, options: ProgramInstallationOptions = {}) {

    const system = await (await import("@phreshos/node")).System.connect()

    const identity = program instanceof Project ? program.config.identity : program.identity

    const current = await system.program.find(identity)

    const replaced = await current?.installed() ?? false

    let installed: Awaited<ReturnType<Project["install"]>> | null = null

    let startupEnabled = false

    let process: string | null = null

    let installationFinished = false

    try {

        if (program instanceof Project) installed = await program.install(system)

        else {

            installed = await system.forceCreateProgram(program)

            for await (const chunk of installed.install()) writeProgramCommandOutput(chunk)
        }

        installationFinished = true

        if (options.startup) {

            await installed.startup.enable()

            startupEnabled = true
        }

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

    if (options.startup && !startupEnabled) throw new Error("The System installed the Program without confirming startup")

    if (options.run && !process) throw new Error("The System installed the Program without confirming that it is running")

    return {

        program: { identity: installed.identity, name: installed.name, version: installed.version },

        replaced,

        startupEnabled,

        process
    } satisfies ProgramInstallationResult
}
