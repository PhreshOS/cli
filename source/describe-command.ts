import type { Argument, Command, Option } from "commander"
import { commandContract, readCommandContract } from "./command-contract.ts"
import { blank } from "./style.ts"

/** Add one machine-readable description entry point for the complete CLI tree. */
export default function describeCommands(program: Command) {

    commandContract(program.command("describe")
        .description("describe any Phresh capability as machine-readable data")
        .argument("[path...]", "command path to describe")
        .option("--compact", "write JSON on one line")
        .action(function (path: string[], options: { compact?: boolean }) {

            const command = resolveCommand(program, path)
            const description = describe(command, path)

            console.log(JSON.stringify(description, null, options.compact ? undefined : 2))
            blank()
        }), { guidance: ["Omit the path to discover all top-level commands, then describe progressively deeper paths."] })
}

function resolveCommand(root: Command, path: string[]) {

    let command = root

    for (const name of path) {

        const child = command.commands.find(candidate => candidate.name() === name)

        if (!child) throw new Error(`Unknown command path "${path.join(" ")}"`)

        command = child
    }

    return command
}

function describe(command: Command, path: string[]): CommandDescription {

    const registered = readCommandContract(command)
    return {
        path,
        name: command.name(),
        description: command.description(),
        arguments: command.registeredArguments.map(argumentDescription),
        options: command.options.map(optionDescription),
        commands: command.commands.map(child => ({ name: child.name(), description: child.description() })),
        ...(registered?.guidance ? { guidance: registered.guidance } : {})
    }
}

function argumentDescription(argument: Argument) {

    return {
        name: argument.name(),
        description: argument.description,
        required: argument.required,
        variadic: argument.variadic,
        ...(argument.defaultValue === undefined ? {} : { default: argument.defaultValue })
    }
}

function optionDescription(option: Option) {

    return {
        flags: option.flags,
        description: option.description,
        value: option.required ? "required" as const : option.optional ? "optional" as const : "none" as const,
        variadic: option.variadic,
        ...(option.defaultValue === undefined ? {} : { default: option.defaultValue }),
        ...(option.argChoices === undefined ? {} : { choices: option.argChoices })
    }
}

interface CommandDescription {

    path: string[]
    name: string
    description: string
    arguments: ReturnType<typeof argumentDescription>[]
    options: ReturnType<typeof optionDescription>[]
    commands: { name: string, description: string }[]
    guidance?: readonly string[]
}
