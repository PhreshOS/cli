import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import create from "../create.ts"
import init from "../init.ts"
import install from "../install.ts"
import launch from "../launch.ts"
import pack from "../pack.ts"
import uninstall from "../uninstall.ts"
import { option } from "./options.ts"
import { textOutput } from "./schemas.ts"

const runOptionPrefix = "--run-option-"

/** Register commands whose subject is a Program project or release. */
export default function projectCommands(program: Command, coreRange: string) {
    defineCommand<CreateCommandOptions, [string | undefined]>(program, {
        name: "create",
        description: "create a new Program project",
        arguments: [{ syntax: "[directory]", description: "directory for the new Program" }],
        options: [
            option("--name <name>", "human-readable Program name"),
            option("--package-manager <manager>", "package manager used to install dependencies", { choices: ["bun", "npm", "pnpm", "yarn"] }),
            option("--no-install", "create files without installing dependencies")
        ],
        guidance: [
            "Creates a complete Server and Client project from the maintained Phresh Program template bundled with this CLI.",
            "In a terminal, omitted values are collected interactively. Automation supplies the directory and optional choices through named options."
        ],
        examples: ["phresh create", "phresh create my-program --package-manager bun"],
        output: textOutput("Created Program project and installation status")
    }, async ({ arguments: [directory], options }) => {
        await create({ directory, name: options.name, packageManager: options.packageManager, install: options.install })
    })

    defineCommand<InitCommandOptions>(program, {
        name: "init",
        description: "initialize an existing Program project",
        options: [
            option("--name <name>", "human-readable Program name"),
            option("--build-command <command>", "prepare production files before use"),
            option("--server", "include a Server endpoint"),
            option("--server-location <path>", "production Server directory"),
            option("--server-start-command <command>", "production Server command"),
            option("--server-entry-file <path>", "production Server worker entry"),
            option("--server-development-start-command <command>", "development Server command"),
            option("--server-development-entry-file <path>", "development Server worker entry"),
            option("--client", "include a Client endpoint"),
            option("--client-location <path>", "production Client directory"),
            option("--client-development-url <url>", "fixed or external development Client URL"),
            option("--client-development-start-command <command>", "development Client command"),
            option("--force", "replace an existing phresh.config.ts")
        ],
        guidance: [
            "Reads identity, version, and description from package.json, then writes phresh.config.ts.",
            "A terminal asks only for values the project cannot provide. Without a terminal, declare at least one endpoint with options."
        ],
        examples: ["phresh init --server --client", "phresh init --client --client-location dist/client"],
        output: textOutput("Initialized Program configuration")
    }, async ({ options }) => {
        await init({
            name: options.name,
            buildCommand: options.buildCommand,
            server: options.server === true || options.serverLocation !== undefined || options.serverStartCommand !== undefined || options.serverEntryFile !== undefined,
            serverLocation: options.serverLocation,
            serverStartCommand: options.serverStartCommand,
            serverEntryFile: options.serverEntryFile,
            serverDevelopmentStartCommand: options.serverDevelopmentStartCommand,
            serverDevelopmentEntryFile: options.serverDevelopmentEntryFile,
            client: options.client === true
                || options.clientLocation !== undefined
                || options.clientDevelopmentUrl !== undefined
                || options.clientDevelopmentStartCommand !== undefined,
            clientLocation: options.clientLocation,
            clientDevelopmentUrl: options.clientDevelopmentUrl,
            clientDevelopmentStartCommand: options.clientDevelopmentStartCommand,
            force: options.force === true
        }, process.cwd(), coreRange)
    })

    defineCommand(program, {
        name: "pack",
        description: "build and package this Program",
        guidance: ["Runs an optional buildCommand, then packages the production files declared for each endpoint."],
        examples: ["phresh pack"],
        output: textOutput("Packaged Program release")
    }, async function () {
        await pack()
    })

    defineCommand<InstallCommandOptions, [string | undefined]>(program, {
        name: "install",
        description: "install a local or official Program",
        arguments: [{ syntax: "[name]", description: "name of an official Program" }],
        options: [option("--run", "run the installed Program now")],
        guidance: [
            "Without a name, builds and installs the Program declared by this project.",
            "A name installs its verified official production release. --run launches the installed Program now."
        ],
        requiresSystem: true,
        examples: ["phresh install", "phresh install terminal --run"],
        output: textOutput("Installed Program and optional Process identity")
    }, async ({ arguments: [name], options }) => {
        await install({ name, run: options.run === true })
    })

    defineCommand<UninstallCommandOptions, [string | undefined]>(program, {
        name: "uninstall",
        description: "uninstall a local or installed Program",
        arguments: [{ syntax: "[name]", description: "name of an installed Program" }],
        options: [option("--everything", "also remove Processes, data, and runtime state")],
        guidance: [
            "Without a name, uses the Program declared by this project.",
            "Removes installed files while preserving Processes, data, and runtime Program state unless --everything is supplied."
        ],
        requiresSystem: true,
        examples: ["phresh uninstall", "phresh uninstall terminal --everything"],
        output: textOutput("Uninstalled Program state")
    }, async ({ arguments: [name], options }) => {
        await uninstall({ name, everything: options.everything === true })
    })

    attached(program, "start", "run the production Program without installing", [
        "Runs this Program attached to the terminal. Output arrives here, and ending this command stops the Program.",
        "An optional buildCommand runs before launch, and the Program's exit status becomes this command's status."
    ], "production")

    attached(program, "dev", "run the development Program without installing", [
        "Runs the same attached lifecycle as start using the development declarations.",
        "A Client URL must respond within 15 seconds before launch."
    ], "development")
}

function attached(program: Command, name: string, description: string, guidance: string[], mode: "production" | "development") {
    defineCommand<Record<string, never>, [string[]]>(program, {
        name,
        description,
        arguments: [{ syntax: "[run-options...]", description: "--run-option-<name>=<value> values passed to the Program" }],
        allowUnknownOptions: true,
        requiresSystem: true,
        guidance,
        examples: [`phresh ${name}`, `phresh ${name} --run-option-example=value`],
        output: textOutput("Attached Process lifecycle and output")
    }, async ({ arguments: [arguments_] }) => {
        await launch(mode, process.cwd(), runOptions(name, arguments_))
    })
}

function runOptions(command: string, arguments_: string[]) {
    const options: Record<string, string> = {}

    for (const argument of arguments_) {
        if (!argument.startsWith(runOptionPrefix)) throw new Error(`${command} accepts Program options only as ${runOptionPrefix}<name>=<value>; received "${argument}"`)

        const said = argument.slice(runOptionPrefix.length)
        const at = said.indexOf("=")

        if (at < 1) throw new Error(`"${argument}" says no value — write ${runOptionPrefix}<name>=<value>, and end with = for an empty value`)

        const name = said.slice(0, at)

        if (Object.hasOwn(options, name)) throw new Error(`The run option "${name}" was given more than once`)

        options[name] = said.slice(at + 1)
    }

    return options
}

interface CreateCommandOptions {
    readonly name?: string
    readonly packageManager?: "bun" | "npm" | "pnpm" | "yarn"
    readonly install: boolean
}

interface InitCommandOptions {
    readonly name?: string
    readonly buildCommand?: string
    readonly server?: boolean
    readonly serverLocation?: string
    readonly serverStartCommand?: string
    readonly serverEntryFile?: string
    readonly serverDevelopmentStartCommand?: string
    readonly serverDevelopmentEntryFile?: string
    readonly client?: boolean
    readonly clientLocation?: string
    readonly clientDevelopmentUrl?: string
    readonly clientDevelopmentStartCommand?: string
    readonly force?: boolean
}

interface UninstallCommandOptions { readonly everything?: boolean }
interface InstallCommandOptions { readonly run?: boolean }
