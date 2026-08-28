#!/usr/bin/env node
import { Command, Option } from "commander"
import metadata from "../package.json" with { type: "json" }
import { PromptCancelled, ReportedFailure } from "./prompts.ts"
import create from "./create.ts"
import install from "./install.ts"
import launch from "./launch.ts"
import init from "./init.ts"
import pack from "./pack.ts"
import uninstall from "./uninstall.ts"
import systemCommands from "./system/command.ts"
import controlCommands from "./control-command.ts"
import describeCommands from "./describe-command.ts"
import { commandContract } from "./command-contract.ts"

const { version } = metadata

const coreRange = metadata.dependencies["@phreshos/core"]

const runOptionPrefix = "--run-option-"

const program = new Command()

    .name("phresh")

    .description("Create Programs and manage PhreshOS")

    .version(version, "-v, --version")

    .showHelpAfterError()

    .showSuggestionAfterError()

    .configureOutput({

        writeOut: value => process.stdout.write(spaced(value)),

        writeErr: value => process.stderr.write(spaced(value))
    })

commandContract(program)

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

        .option("--build-command <command>", "prepare production files before use")

        .option("--server", "include a Server endpoint")

        .option("--server-location <path>", "production Server directory")

        .option("--server-start-command <command>", "production Server command")

        .option("--server-entry-file <path>", "production Server worker entry")

        .option("--server-development-start-command <command>", "development Server command")

        .option("--server-development-entry-file <path>", "development Server worker entry")

        .option("--client", "include a Client endpoint")

        .option("--client-location <path>", "production Client directory")

        .option("--client-development-url <url>", "development Client URL")

        .option("--client-development-start-command <command>", "development Client command")

        .option("--force", "replace an existing phresh.config.ts")

        .action(async function (options: InitCommandOptions) {

            await init({

                name: options.name,

                buildCommand: options.buildCommand,

                server: options.server === true || options.serverLocation !== undefined || options.serverStartCommand !== undefined || options.serverEntryFile !== undefined,

                serverLocation: options.serverLocation,

                serverStartCommand: options.serverStartCommand,

                serverEntryFile: options.serverEntryFile,

                serverDevelopmentStartCommand: options.serverDevelopmentStartCommand,

                serverDevelopmentEntryFile: options.serverDevelopmentEntryFile,

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

        .description("install a local or official Program")

        .argument("[name]", "name of an official Program")

        .option("--run", "run the installed Program now")

        .option("--startup", "run the Program when the System starts")

        .action(async function (name: string | undefined, options: InstallCommandOptions) {

            await install({ name, run: options.run === true, startup: options.startup === true })
        }),

    [

        "Without a name, builds and installs the Program declared by this project.",

        "A name installs its verified official production release. --run launches",

        "it now; --startup persists the same default launch for future starts."
    ]
)

describe(

    program.command("uninstall")

        .description("uninstall a local or installed Program")

        .argument("[name]", "name of an installed Program")

        .option("--everything", "also remove Processes, data, and runtime state")

        .action(async function (name: string | undefined, options: UninstallCommandOptions) {

            await uninstall({ name, everything: options.everything === true })
        }),

    [

        "Without a name, uses the Program declared by this project. Removes its",

        "installed files while preserving its Processes, data,",

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

controlCommands(program)

describeCommands(program)

// Every command begins with the same breathing room. Keep this at the entry
// point so individual commands never need to manufacture their own opening.
console.log("")

if (process.argv.length === 2) program.help()

try {

    await program.parseAsync()
}

catch (error) {

    if (error instanceof PromptCancelled) process.exitCode = 0

    else if (error instanceof ReportedFailure) process.exitCode = 1

    else {

        console.error(`\n  phresh: ${error instanceof Error ? error.message : String(error)}\n`)

        process.exitCode = 1
    }
}

function spaced(value: string) {

    if (value.endsWith("\n\n")) return value

    return value.endsWith("\n") ? `${value}\n` : `${value}\n\n`
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

    commandContract(command, { guidance: paragraphs.filter(Boolean) })

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

    buildCommand?: string

    server?: boolean

    serverLocation?: string

    serverStartCommand?: string

    serverEntryFile?: string

    serverDevelopmentStartCommand?: string

    serverDevelopmentEntryFile?: string

    client?: boolean

    clientLocation?: string

    clientDevelopmentUrl?: string

    clientDevelopmentStartCommand?: string

    force?: boolean
}

interface UninstallCommandOptions {

    everything?: boolean
}

interface InstallCommandOptions {

    run?: boolean

    startup?: boolean
}
