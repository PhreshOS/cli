import type { SystemServiceDefinition } from "../types.ts"
import { spawn } from "node:child_process"
import { open, writeFile } from "node:fs/promises"

const payload = decode(process.argv[2])

const output = await open(payload.definition.output, "a", 0o600)

try {

    const child = spawn(payload.definition.executable, [payload.definition.entry], {

        cwd: payload.definition.directory,

        stdio: ["ignore", output.fd, output.fd]
    })

    await new Promise<void>(function (settle, refuse) {

        child.once("spawn", settle)

        child.once("error", refuse)
    })

    if (child.pid === undefined) throw new Error("The PhreshOS System process has no pid")

    await writeFile(payload.state, JSON.stringify({ runner: process.pid, child: child.pid }), { mode: 0o600 })

    const result = await new Promise<{ code: number | null, signal: NodeJS.Signals | null }>(settle => {

        child.once("close", (code, signal) => settle({ code, signal }))
    })

    process.exitCode = result.signal ? 1 : result.code ?? 1
}

finally {

    await output.close()
}

function decode(encoded: string | undefined): RunnerPayload {

    let value: unknown

    try {

        value = JSON.parse(Buffer.from(encoded ?? "", "base64url").toString("utf8"))
    }

    catch {

        throw new Error("The PhreshOS System task payload is invalid")
    }

    if (!value || typeof value !== "object") throw new Error("The PhreshOS System task payload is invalid")

    const candidate = value as Record<string, unknown>

    if (typeof candidate.state !== "string" || !definition(candidate.definition)) throw new Error("The PhreshOS System task payload is invalid")

    return { state: candidate.state, definition: candidate.definition }
}

function definition(value: unknown): value is SystemServiceDefinition {

    if (!value || typeof value !== "object") return false

    const candidate = value as Record<string, unknown>

    return ["executable", "entry", "directory", "output"].every(name => typeof candidate[name] === "string" && candidate[name] !== "")
}

interface RunnerPayload {

    state: string

    definition: SystemServiceDefinition
}
