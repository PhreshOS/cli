import { installProjectDependencies, projectPackageManager, projectScript, type PackageManagerName } from "./project-dependency.ts"
import prompts from "./prompts.ts"
import { accent, bold } from "./style.ts"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, relative, resolve } from "node:path"

/** Creates a complete Program from the bundled Phresh Program snapshot. */
export default async function create(options: CreateOptions = {}, directory = process.cwd()) {

    const interaction = prompts()

    interaction.begin("Create Program", "Phresh Program")

    const requested = options.directory ?? (interaction.interactive

        ? await interaction.ask("A new directory will contain the complete Server and Client project.", "Where should the Program be created?", "my-program")

        : undefined)

    if (!requested) throw new Error("create needs a <directory> when no terminal is attached")

    const target = resolve(directory, requested)

    const identity = basename(target)

    if (!programIdentity.test(identity)) throw new Error(`The directory name must be a kebab-case Program identity; received "${identity}"`)

    if (existsSync(target)) throw new Error(`The destination already exists: ${target}`)

    const name = options.name ?? (interaction.interactive

        ? await interaction.ask("This name is shown to people; the directory name remains the Program identity.", "What name should people see?", title(identity))

        : title(identity))

    if (!name.trim()) throw new Error("--name must not be empty")

    const install = options.install !== false

    const detected = projectPackageManager(directory).name

    const manager = options.packageManager ?? (install && interaction.interactive

        ? packageManager(await interaction.choose("The generated project remains portable; this choice installs its dependencies now.", "Which package manager should be used?", packageManagers, detected))

        : detected)

    const parent = dirname(target)

    mkdirSync(parent, { recursive: true })

    const staging = mkdtempSync(resolve(parent, `.${identity}-`))

    const bundled = template()

    let placed = false

    try {

        cpSync(bundled.directory, staging, { recursive: true })

        renameSync(resolve(staging, "gitignore"), resolve(staging, ".gitignore"))

        customize(staging, identity, name, manager)

        renameSync(staging, target)

        placed = true

        // A project inside this repository becomes a real workspace member
        // only at its final path. Install there so package selection sees the
        // same project boundary that subsequent commands will see.
        if (install) await interaction.progress(

            "Installing dependencies",

            "Dependencies installed",

            () => installProjectDependencies(target, manager, interaction.interactive ? "capture" : "inherit")
        )
    }

    catch (error) {

        rmSync(placed ? target : staging, { recursive: true, force: true })

        throw error
    }

    interaction.finish("Done")

    console.log(bold("\nOpen the project"))

    console.log(accent(`cd ${relative(directory, target) || "."}`))

    if (!install) {

        console.log(bold("\nInstall dependencies"))

        console.log(accent(installCommand(manager)))
    }

    const script = projectScript(target, manager, bundled.development ? "dev" : "start")

    console.log(bold(`\n${bundled.development ? "Run Development Program" : "Run Program"}`))

    console.log(accent(script))

    console.log(bold("\nYou can now open the project and start building your Program"))

    console.log("")
}

function template() {

    const candidates = [

        resolve(import.meta.dirname, "template"),

        resolve(import.meta.dirname, "..", "dist", "template")
    ]

    for (const directory of candidates) {

        if (!existsSync(directory)) continue

        const descriptionPath = resolve(dirname(directory), "template.json")

        if (!existsSync(descriptionPath)) throw new Error("The CLI template description has not been built — run its build command and try again")

        const description = JSON.parse(readFileSync(descriptionPath, "utf-8")) as Partial<TemplateDescription>

        if (typeof description.development !== "boolean") throw new Error("The CLI template description is invalid — run its build command and try again")

        return { directory, development: description.development }
    }

    throw new Error("The CLI template has not been built — run its build command and try again")
}

function customize(directory: string, identity: string, name: string, manager: PackageManagerName) {

    for (const path of textFiles(directory)) {

        let content = readFileSync(path, "utf-8")

        if (basename(path) === "phresh.config.ts") {

            content = content.replace('identity: "phresh"', `identity: ${JSON.stringify(identity)}`)
        }

        content = content.replaceAll("Phresh Program", name)

        if (basename(path) === "README.md") {

            content = content

                .replaceAll("bun install", `${manager} install`)

                .replaceAll("bun phresh ", "phresh ")
        }

        writeFileSync(path, content)
    }

    const manifestPath = resolve(directory, "package.json")

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as PackageManifest

    manifest.name = identity

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n")
}

function textFiles(directory: string): string[] {

    const files: string[] = []

    for (const entry of readdirSync(directory, { withFileTypes: true })) {

        const path = resolve(directory, entry.name)

        if (entry.isDirectory()) files.push(...textFiles(path))

        else if (entry.isFile() && (textExtensions.has(extname(entry.name)) || textNames.has(entry.name))) files.push(path)
    }

    return files
}

function packageManager(value: string): PackageManagerName {

    if (value === "bun" || value === "npm" || value === "pnpm" || value === "yarn") return value

    throw new Error(`The package manager must be bun, npm, pnpm, or yarn; received "${value}"`)
}

function title(identity: string) {

    return identity.split("-").map(word => word[0]!.toUpperCase() + word.slice(1)).join(" ")
}

function installCommand(manager: PackageManagerName) {

    return `${manager} install`
}

const programIdentity = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const textExtensions = new Set([".css", ".html", ".json", ".md", ".ts", ".tsx"])

const textNames = new Set([".gitignore", "gitignore"])

const packageManagers = ["bun", "npm", "pnpm", "yarn"] as const

export interface CreateOptions {

    directory?: string

    name?: string

    packageManager?: PackageManagerName

    install?: boolean
}

interface PackageManifest {

    name: string

    dependencies?: Record<string, string>

    devDependencies?: Record<string, string>
}

interface TemplateDescription {

    development: boolean
}
