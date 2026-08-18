import { isAbsolute } from "node:path"
import { requireSuccess } from "./process.ts"

export const minimumSystemNodeVersion = "24.15.0"

/** Resolve the real Node executable even when another runtime invoked the CLI. */
export default async function nodeExecutable() {

    const executable = !process.versions.bun && process.release.name === "node" && isAbsolute(process.execPath)

        ? process.execPath

        : await discoveredNodeExecutable()

    const result = await requireSuccess(executable, ["-p", "process.versions.node"])

    const version = result.stdout.trim()

    if (!supportsSystemNode(version)) {

        throw new Error(`Node.js ${minimumSystemNodeVersion} or newer is required to run the PhreshOS System${version ? ` (found ${version})` : ""}`)
    }

    return executable
}

export function supportsSystemNode(version: string) {

    const actual = parseVersion(version)

    const minimum = parseVersion(minimumSystemNodeVersion)

    if (!actual || !minimum) return false

    return actual.major > minimum.major

        || actual.major === minimum.major && actual.minor > minimum.minor

        || actual.major === minimum.major && actual.minor === minimum.minor && actual.patch >= minimum.patch
}

async function discoveredNodeExecutable() {

    const command = process.platform === "win32" ? "node.exe" : "node"

    const result = await requireSuccess(command, ["-p", "process.execPath"])

    const executable = result.stdout.trim()

    if (!isAbsolute(executable)) throw new Error("A real Node.js executable is required to run the PhreshOS System service")

    return executable
}

function parseVersion(version: string) {

    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)

    if (!match) return undefined

    return {

        major: Number(match[1]),

        minor: Number(match[2]),

        patch: Number(match[3])
    }
}
