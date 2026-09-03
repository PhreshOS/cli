import type { Command } from "commander"
import { defineCommand, readCommandContract, type CommandContract, type OptionContract } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { jsonOption, option } from "./options.ts"
import { jsonOutput } from "./schemas.ts"

/** Expose the authoritative CLI contract without contacting the System. */
export default function describeCommands(root: Command) {
    defineCommand<DescribeOptions, [string[]]>(root, {
        name: "describe",
        description: "describe Phresh commands as machine-readable data",
        arguments: [{ syntax: "[path...]", description: "command path to describe" }],
        options: [
            option("--all", "include every descendant beneath the selected path"),
            jsonOption
        ],
        guidance: ["Omit the path to start at the CLI root. Add --all to retrieve the complete selected contract tree."],
        examples: ["phresh describe", "phresh describe process create", "phresh describe --all --json"],
        output: jsonOutput(value.any("one command contract or a complete contract tree"), "CLI command contract")
    }, ({ arguments: [path], options }) => {
        const command = resolveCommand(root, path)
        return options.all ? describeTree(command, path) : describe(command, path)
    })
}

function resolveCommand(root: Command, path: string[]) {
    let command = root

    for (const name of path) {
        const child = command.commands.find(candidate => {
            const contract = readCommandContract(candidate)
            return candidate.name() === name || contract?.aliases?.includes(name)
        })

        if (!child) throw new Error(`Unknown command path "${path.join(" ")}"`)
        command = child
    }

    return command
}

function describeTree(command: Command, path: string[]): CommandDescription {
    return {
        ...describe(command, path),
        commands: command.commands.map(child => describeTree(child, [...path, child.name()]))
    }
}

function describe(command: Command, path: string[]): CommandDescription {
    const contract = readCommandContract(command)

    if (!contract) throw new Error(`Command "${path.join(" ") || command.name()}" has no CLI contract`)

    return {
        path,
        name: contract.name,
        aliases: contract.aliases ?? [],
        description: contract.description,
        arguments: contract.arguments ?? [],
        options: (contract.options ?? []).map(publicOption),
        guidance: contract.guidance ?? [],
        examples: contract.examples ?? [],
        requiresSystem: contract.requiresSystem === true,
        output: contract.output ?? null,
        commands: command.commands.map(child => {
            const childContract = readCommandContract(child)
            if (!childContract) throw new Error(`Command "${[...path, child.name()].join(" ")}" has no CLI contract`)
            return { name: childContract.name, aliases: childContract.aliases ?? [], description: childContract.description }
        })
    }
}

function publicOption(option: OptionContract) {
    return {
        flags: option.flags,
        description: option.description,
        mandatory: option.mandatory === true,
        value: option.flags.includes("<") ? "required" : option.flags.includes("[") ? "optional" : "none",
        repeatable: option.repeatable === true,
        choices: option.choices ?? [],
        ...(Object.hasOwn(option, "default") ? { default: option.default } : {})
    }
}

interface DescribeOptions {
    readonly all?: boolean
    readonly json?: boolean
}

interface CommandDescription {
    readonly path: string[]
    readonly name: string
    readonly aliases: readonly string[]
    readonly description: string
    readonly arguments: CommandContract["arguments"]
    readonly options: ReturnType<typeof publicOption>[]
    readonly guidance: readonly string[]
    readonly examples: readonly string[]
    readonly requiresSystem: boolean
    readonly output: CommandContract["output"] | null
    readonly commands: ({ name: string, aliases: readonly string[], description: string } | CommandDescription)[]
}
