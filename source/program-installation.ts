import speak from "./program-intake.ts"
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
export default async function installProgram(program: unknown, options: ProgramInstallationOptions = {}) {

    let installedValue: unknown

    let replaced = false

    let startupEnabled = false

    let processValue: unknown

    await speak({

        word: "install",

        program,

        run: options.run === true,

        startup: options.startup === true

    }, function (event) {

        if (event.event === "output") writeProgramCommandOutput(event)

        else if (event.event === "installed") {

            installedValue = event.program

            replaced = event.replaced === true
        }

        else if (event.event === "startupEnabled") startupEnabled = true

        else if (event.event === "running") processValue = event.process
    })

    if (installedValue === undefined) throw new Error("The System ended Program installation without confirming it")

    const installed = installedProgram(installedValue)

    if (options.startup && !startupEnabled) throw new Error("The System installed the Program without confirming startup")

    const process = processValue === undefined ? null : processIdentity(processValue)

    if (options.run && !process) throw new Error("The System installed the Program without confirming that it is running")

    return {

        program: installed,

        replaced,

        startupEnabled,

        process
    } satisfies ProgramInstallationResult
}

function processIdentity(value: unknown) {

    if (typeof value !== "string" || !value) throw new Error("The System returned an invalid Process identity")

    return value
}

function installedProgram(value: unknown): ProgramInstallationResult["program"] {

    if (!record(value)

        || typeof value.identity !== "string"

        || typeof value.name !== "string"

        || value.version !== null && typeof value.version !== "string") {

        throw new Error("The System returned an invalid installed Program")
    }

    return { identity: value.identity, name: value.name, version: value.version }
}

function record(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null && !Array.isArray(value)
}
