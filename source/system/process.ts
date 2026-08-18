import { spawn } from "node:child_process"

export interface ProcessResult {

    code: number

    stdout: string

    stderr: string
}

/** Execute one exact program without involving a command shell. */
export function execute(command: string, args: string[], options: { cwd?: string, env?: NodeJS.ProcessEnv } = {}) {

    return new Promise<ProcessResult>(function (settle, refuse) {

        const child = spawn(command, args, {

            cwd: options.cwd,

            env: options.env,

            stdio: ["ignore", "pipe", "pipe"]
        })

        let stdout = ""

        let stderr = ""

        child.stdout.setEncoding("utf8").on("data", chunk => stdout += chunk)

        child.stderr.setEncoding("utf8").on("data", chunk => stderr += chunk)

        child.once("error", refuse)

        child.once("close", code => settle({ code: code ?? 1, stdout, stderr }))
    })
}

export async function requireSuccess(command: string, args: string[], options?: { cwd?: string, env?: NodeJS.ProcessEnv }) {

    const result = await execute(command, args, options)

    if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} exited with code ${result.code}`)

    return result
}
