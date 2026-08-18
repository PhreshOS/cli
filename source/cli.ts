#!/usr/bin/env node
import { Command, Option } from "commander"
import metadata from "../package.json" with { type: "json" }
import { PromptCancelled } from "./prompts.ts"
import create from "./create.ts"
import install from "./install.ts"
import launch from "./launch.ts"
import init from "./init.ts"
import pack from "./pack.ts"
import uninstall from "./uninstall.ts"
import systemCommands from "./system/command.ts"

const { version } = metadata

const coreRange = metadata.dependencies["@phreshos/core"]

const runOptionPrefix = "--run-option-"

const program = new Command()

    .name("phresh")

    .description("Create Programs and manage PhreshOS")

    .version(version, "-v, --version")

    .showHelpAfterError()

    .showSuggestionAfterError()

program.addHelpText("after", "\nRun phresh <command> --help for detailed command guidance.\n")

describe(

    program.command("create")

        .description("create a new Program project")

        .argument("[directory]", "directory for the new Program")

        .option("--name <name>", "human-readable Program name")

        .addOption(new Option("--package-manager <manager>", "package manager used to install dependencies").choices(["bun", "npm", "pnpm", "yarn"]))

        .option("--no-install", "create files without installing dependencies")

        .action(async function (directory: string | undefined, options: CreateCommandOptions) {

            await create({

                directory,

                name: options.name,

                packageManager: options.packageManager,

                install: options.install
            })
        }),

    [

        "Creates a complete Server and Client project from the maintained",

        "Phresh Program template bundled with this CLI.",

        "",

        "In a terminal, omitted values are collected interactively. Automation",

        "supplies the directory and optional choices through named options."
    ]
)

describe(

    program.command("init")

        .description("initialize an existing Program project")

        .option("--name <name>", "human-readable Program name")

        .option("--api-docs <path>", "official Program API documentation")

        .option("--build-command <command>", "prepare production files before use")

        .option("--server", "include a Server endpoint")

        .option("--server-location <path>", "production Server directory")

        .option("--server-start-command <command>", "production Server command")

        .option("--server-development-start-command <command>", "development Server command")

        .option("--client", "include a Client endpoint")

        .option("--client-location <path>", "production Client directory")

        .option("--client-development-url <url>", "development Client URL")

        .option("--client-development-start-command <command>", "development Client command")

        .option("--force", "replace an existing phresh.config.ts")

        .action(async function (options: InitCommandOptions) {

            await init({

                name: options.name,

                apiDocs: options.apiDocs,

                buildCommand: options.buildCommand,

                server: options.server === true || options.serverLocation !== undefined || options.serverStartCommand !== undefined,

                serverLocation: options.serverLocation,

                serverStartCommand: options.serverStartCommand,

                serverDevelopmentStartCommand: options.serverDevelopmentStartCommand,

                client: options.client === true || options.clientLocation !== undefined,

                clientLocation: options.clientLocation,

                clientDevelopmentUrl: options.clientDevelopmentUrl,

                clientDevelopmentStartCommand: options.clientDevelopmentStartCommand,

                force: options.force === true
            }, process.cwd(), coreRange)
        }),

    [

        "Reads identity, version, and description from package.json, then writes",

        "phresh.config.ts. A terminal asks only for values the project cannot",

        "provide. Without a terminal, declare at least one endpoint with options."
    ]
)

describe(

    program.command("pack")

        .description("build and package this Program")

        .action(async function () {

            await pack()
        }),

    [

        "Runs an optional buildCommand, then packages the production files",

        "declared for each endpoint."
    ]
)

describe(

    program.command("install")

        .description("install this Program")

        .action(async function () {

            await install()
        }),

    [

        "Builds and installs the Program declared by this project. Running",

        "Processes end before installed paths change; Program data is preserved."
    ]
)

describe(

    program.command("uninstall")

        .description("uninstall this Program")

        .option("--everything", "also remove Processes, data, and runtime state")

        .action(async function (options: UninstallCommandOptions) {

            await uninstall(options.everything === true)
        }),

    [

        "Removes the installed Program files while preserving its Processes, data,",

        "and runtime Program. --everything removes all system-owned state."
    ]
)

attached(

    "start",

    "run the production Program without installing",

    [

        "Runs this Program attached to the terminal. Output arrives here, and",

        "ending this command stops the Program. An optional buildCommand runs",

        "before launch, and the Program's exit status becomes this command's status."
    ],

    "production"
)

attached(

    "dev",

    "run the development Program without installing",

    [

        "Runs the same attached lifecycle as start using the development",

        "declarations. A Client URL must respond within 15 seconds before launch."
    ],

    "development"
)

systemCommands(program)

// Every command begins with the same breathing room. Keep this at the entry
// point so individual commands never need to manufacture their own opening.
console.log("")

if (process.argv.length === 2) program.help()

try {

    await program.parseAsync()
}

catch (error) {

    if (error instanceof PromptCancelled) process.exitCode = 0

    else {

        console.error(`\n  phresh: ${error instanceof Error ? error.message : String(error)}\n`)

        process.exitCode = 1
    }
}

function attached(name: string, summary: string, detail: string[], mode: "production" | "development") {

    describe(

        program.command(name)

            .description(summary)

            .argument("[run-options...]", "--run-option-<name>=<value> values passed to the Program")

            .allowUnknownOption()

            .action(async function (args: string[]) {

                await launch(mode, process.cwd(), runOptions(name, args))
            }),

        detail
    )
}

function describe(command: Command, paragraphs: string[]) {

    command.addHelpText("after", `\n${paragraphs.map(line => line ? `  ${line}` : "").join("\n")}\n`)

    return command
}

function runOptions(command: string, args: string[]) {

    const options: Record<string, string> = {}

    for (const argument of args) {

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

    name?: string

    packageManager?: "bun" | "npm" | "pnpm" | "yarn"

    install: boolean
}

interface InitCommandOptions {

    name?: string

    apiDocs?: string

    buildCommand?: string

    server?: boolean

    serverLocation?: string

    serverStartCommand?: string

    serverDevelopmentStartCommand?: string

    client?: boolean

    clientLocation?: string

    clientDevelopmentUrl?: string

    clientDevelopmentStartCommand?: string

    force?: boolean
}

interface UninstallCommandOptions {

    everything?: boolean
}
