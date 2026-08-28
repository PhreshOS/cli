import phreshosHome from "../home.ts"
import { existsSync, statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { spawn } from "node:child_process"

/** Run one System source directly with an explicit absolute state home. */
export default async function runSystem(source: string, environment: NodeJS.ProcessEnv = process.env) {

    const directory = resolve(source)

    if (!existsSync(directory) || !statSync(directory).isDirectory()) throw new Error(`The System source does not exist: ${directory}`)

    const entry = join(directory, "server", "main.js")
    const command = existsSync(entry)
        ? { file: process.execPath, args: [entry] }
        : await projectCommand(directory)

    const child = spawn(command.file, command.args, {
        cwd: directory,
        env: { ...environment, PHRESHOS_HOME: phreshosHome(environment) },
        stdio: "inherit"
    })

    const result = await new Promise<{ code: number | null, signal: NodeJS.Signals | null }>((resolve, reject) => {

        child.once("error", reject)
        child.once("exit", (code, signal) => resolve({ code, signal }))
    })

    if (result.signal) throw new Error(`The System stopped on ${result.signal}`)
    if (result.code !== 0) throw new Error(`The System exited with code ${result.code ?? 1}`)
}

async function projectCommand(directory: string) {

    const path = join(directory, "package.json")

    if (!existsSync(path)) throw new Error(`The System source has neither server/main.js nor package.json: ${directory}`)

    const manifest = JSON.parse(await readFile(path, "utf8")) as { scripts?: Record<string, unknown> }

    if (typeof manifest.scripts?.start !== "string") throw new Error(`The System source has no start command: ${directory}`)

    return { file: process.execPath, args: ["--run", "start"] }
}
