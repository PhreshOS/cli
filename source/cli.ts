#!/usr/bin/env node
import { Command } from "commander"
import { createRequire } from "node:module"
import accessCommands from "./commands/access.ts"
import describeCommands from "./commands/describe.ts"
import projectCommands from "./commands/project.ts"
import { assertCommandContracts, attachCommandContract } from "./contract/command.ts"
import { PromptCancelled, ReportedFailure } from "./prompts.ts"
import { blank, failure } from "./style.ts"
import systemCommands from "./system/command.ts"

const metadata = createRequire(import.meta.url)("../package.json") as Readonly<{
    version: string
    dependencies: Readonly<Record<string, string>>
}>

const program = new Command()
    .name("phresh")
    .version(metadata.version, "-v, --version")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
        writeOut: value => process.stdout.write(spaced(value)),
        writeErr: value => process.stderr.write(spaced(value))
    })

attachCommandContract(program, {
    name: "phresh",
    description: "create Programs and manage PhreshOS",
    options: [{ flags: "-v, --version", description: "display the CLI version" }],
    guidance: ["Run phresh <command> --help for human guidance, or phresh describe for the machine-readable command contract."],
    examples: ["phresh create", "phresh describe --all --json"]
})

const coreRange = metadata.dependencies["@phreshos/core"]

if (!coreRange) throw new Error("The CLI package does not declare @phreshos/core")

projectCommands(program, coreRange)
systemCommands(program)
accessCommands(program)
describeCommands(program)
assertCommandContracts(program)

// Every command begins with the same breathing room. Keep this at the entry
// point so individual commands never manufacture their own opening.
if (!process.argv.includes("--json")) blank()

if (process.argv.length === 2) program.help()

try {
    await program.parseAsync()
}
catch (error) {
    if (error instanceof PromptCancelled) process.exitCode = 0
    else if (error instanceof ReportedFailure) process.exitCode = 1
    else {
        failure(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    }
}

function spaced(value: string) {
    if (value.endsWith("\n\n")) return value
    return value.endsWith("\n") ? `${value}\n` : `${value}\n\n`
}
