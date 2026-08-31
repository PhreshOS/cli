import { blank, line } from "./style.ts"
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Packages the CLI may add to a Program project. */
export type ProjectPackage = "@phreshos/core" | "@phreshos/client" | "@phreshos/server" | "@phreshos/react" | "@phreshos/cli"

/** Package managers supported by Program project tooling. */
export type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn"

/** The two dependency sections a generated project can preserve. */
export type DependencySection = "dependencies" | "devDependencies"

/** Returns the package-manager command that runs one project script. */
export function projectScript(directory: string, declared: string | undefined, script: string) {

    return `${projectPackageManager(directory, declared).name} run ${script}`
}

/** Detects the package manager declared by, present in, or invoking a project. */
export function projectPackageManager(directory: string, declared?: string, preferred?: PackageManagerName) {

    const named = preferred ?? packageManagerName(declared) ?? packageManagerFromLocks(directory) ?? packageManagerFromInvocation()

    return managers[named ?? "npm"]
}

/** Installs the dependencies already declared by a generated project. */
export async function installProjectDependencies(directory: string, preferred?: PackageManagerName, output: CommandOutput = "inherit") {

    const manifest = manifestAt(directory)

    const manager = projectPackageManager(directory, manifest?.packageManager, preferred)

    await run(manager.name, manager.installArgs, directory, output)

    return manager.name
}

/**
 * Ensures one project dependency using the source appropriate to this CLI.
 *
 * `init` uses development dependencies because Core supplies the authoring
 * contract for an existing project. `create` preserves the canonical
 * template's own dependency sections instead.
 */
export default async function ensureProjectDependency(

    name: ProjectPackage,

    range: string,

    directory = process.cwd(),

    section: DependencySection = "devDependencies"
) {

    const manifestPath = resolve(directory, "package.json")

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as PackageManifest

    if (manifest.dependencies?.[name] || manifest.devDependencies?.[name]) return

    const manager = projectPackageManager(directory, manifest.packageManager)

    line("dependency", name, `${manager.name}, ${range}`)

    await run(manager.name, [...manager.addArgs(section), `${name}@${range}`], directory)

    blank()
}

function run(command: string, args: string[], directory: string, output: CommandOutput = "inherit") {

    return new Promise<void>(function (settle, refuse) {

        let diagnostic = ""

        const child = spawn(command, args, {

            cwd: directory,

            stdio: output === "capture" ? ["ignore", "pipe", "pipe"] : "inherit",

            shell: process.platform === "win32"
        })

        if (output === "capture") {

            child.stdout?.on("data", chunk => { diagnostic += String(chunk) })

            child.stderr?.on("data", chunk => { diagnostic += String(chunk) })
        }

        child.once("error", error => refuse(new Error(`Could not run ${command}: ${error.message}`)))

        child.once("exit", function (code, signal) {

            if (signal) refuse(new Error(`${command} ended on ${signal}`))

            else if (code !== 0) refuse(new Error(`${command} exited with ${code ?? 0}${diagnostic.trim() ? `\n\n${diagnostic.trim()}` : ""}`))

            else settle()
        })
    })
}

type CommandOutput = "inherit" | "capture"

function manifestAt(directory: string) {

    const path = resolve(directory, "package.json")

    if (!existsSync(path)) return null

    try { return JSON.parse(readFileSync(path, "utf-8")) as PackageManifest }

    catch { return null }
}

function packageManagerName(declared?: string) {

    const named = declared?.split("@")[0]

    return isPackageManager(named) ? named : undefined
}

function packageManagerFromLocks(directory: string): PackageManagerName | undefined {

    if (existsSync(resolve(directory, "bun.lock")) || existsSync(resolve(directory, "bun.lockb"))) return "bun"

    if (existsSync(resolve(directory, "pnpm-lock.yaml"))) return "pnpm"

    if (existsSync(resolve(directory, "yarn.lock"))) return "yarn"

    if (existsSync(resolve(directory, "package-lock.json"))) return "npm"
}

function packageManagerFromInvocation() {

    const named = process.env.npm_config_user_agent?.split("/")[0]

    return isPackageManager(named) ? named : undefined
}

function isPackageManager(value: string | undefined): value is PackageManagerName {

    return value === "bun" || value === "npm" || value === "pnpm" || value === "yarn"
}

const managers: Record<PackageManagerName, Manager> = {

    bun: {

        name: "bun",

        installArgs: ["install"],

        addArgs: section => ["add", ...section === "devDependencies" ? ["--dev"] : []]
    },

    npm: {

        name: "npm",

        installArgs: ["install", "--no-fund", "--no-audit"],

        addArgs: section => ["install", ...section === "devDependencies" ? ["--save-dev"] : ["--save"], "--no-fund", "--no-audit"]
    },

    pnpm: {

        name: "pnpm",

        installArgs: ["install"],

        addArgs: section => ["add", ...section === "devDependencies" ? ["--save-dev"] : ["--save-prod"]]
    },

    yarn: {

        name: "yarn",

        installArgs: ["install"],

        addArgs: section => ["add", ...section === "devDependencies" ? ["--dev"] : []]
    }
}

interface Manager {

    name: PackageManagerName

    installArgs: string[]

    addArgs: (section: DependencySection) => string[]
}

interface PackageManifest {

    packageManager?: string

    dependencies?: Record<string, string>

    devDependencies?: Record<string, string>
}
