import { isAbsolute } from "node:path"
import { requireSuccess } from "./process.ts"

/** Resolve the real Node executable even when another runtime invoked the CLI. */
export default async function nodeExecutable() {

    if (!process.versions.bun && process.release.name === "node" && isAbsolute(process.execPath)) return process.execPath

    const command = process.platform === "win32" ? "node.exe" : "node"

    const result = await requireSuccess(command, ["-p", "process.execPath"])

    const executable = result.stdout.trim()

    if (!isAbsolute(executable)) throw new Error("A real Node.js executable is required to run the PhreshOS System service")

    return executable
}
