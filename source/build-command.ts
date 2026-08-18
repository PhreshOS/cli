import type { Config } from "@phreshos/core"
import { line } from "./style.ts"
import { spawn } from "node:child_process"
import commandEnvironment from "./command-environment.ts"

/** Run the optional build owned by `start`, `install`, and `pack`, never by the system. */
export default async function build(config: Config, directory: string) {

    const command = config.buildCommand

    if (!command) return

    line("build", command)

    await new Promise<void>(function (resolve, reject) {

        const child = spawn(command, { cwd: directory, env: commandEnvironment(directory), shell: true, stdio: "inherit" })

        child.once("error", error => reject(new Error(`Build command failed: ${error.message}`)))

        child.once("exit", function (code, signal) {

            if (signal) reject(new Error(`Build command ended on ${signal}`))

            else if (code !== 0) reject(new Error(`Build command exited with ${code ?? 0}`))

            else resolve()
        })
    })
}
