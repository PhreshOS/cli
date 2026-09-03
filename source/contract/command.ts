import { Argument, Command, Option } from "commander"
import { assertValue, type ValueContract } from "./schema.ts"

const contracts = new WeakMap<Command, CommandContract>()

/** Register one command from the contract used by help, discovery, and execution. */
export function defineCommand<Options extends object = Record<string, never>, Arguments extends readonly unknown[] = []>(
    parent: Command,
    contract: CommandContract,
    execute?: (invocation: CommandInvocation<Options, Arguments>) => unknown | Promise<unknown>
) {
    const command = parent.command(contract.name)

    attachCommandContract(command, contract)

    for (const alias of contract.aliases ?? []) command.alias(alias)

    for (const argument of contract.arguments ?? []) {
        const configured = new Argument(argument.syntax, argument.description)
        if (argument.choices) configured.choices([...argument.choices])
        if (Object.hasOwn(argument, "default")) configured.default(argument.default)
        command.addArgument(configured)
    }

    for (const option of contract.options ?? []) command.addOption(configureOption(option))

    if (contract.allowUnknownOptions) command.allowUnknownOption()

    if (execute) command.action(async (...received: unknown[]) => {
        const owner = received.pop() as Command
        const options = received.pop() as Options
        const result = await execute({ arguments: received as unknown as Arguments, options, command: owner })

        if (contract.output?.format === "json") writeJson(result, contract.output, (options as { json?: unknown }).json === true)
    })

    return command
}

/** Associate the root command with the same public contract as its descendants. */
export function attachCommandContract(command: Command, contract: CommandContract) {
    command.description(contract.description)
    contracts.set(command, freezeContract(contract))

    const detail = [...contract.guidance ?? [], ...(contract.examples?.length ? ["", "Examples:", ...contract.examples.map(example => `  ${example}`)] : [])]
    if (detail.length) command.addHelpText("after", `\n${detail.map(line => line ? `  ${line}` : "").join("\n")}\n`)

    return command
}

export function readCommandContract(command: Command) {
    return contracts.get(command)
}

/** Reject any Commander node that bypassed the authoritative CLI contract. */
export function assertCommandContracts(root: Command) {
    for (const command of descendants(root)) {
        if (!contracts.has(command)) throw new Error(`Command "${pathOf(command).join(" ")}" has no CLI contract`)
    }
}

export interface CommandInvocation<Options extends object, Arguments extends readonly unknown[]> {
    readonly arguments: Arguments
    readonly options: Options
    readonly command: Command
}

export interface CommandContract {
    readonly name: string
    readonly aliases?: readonly string[]
    readonly description: string
    readonly arguments?: readonly ArgumentContract[]
    readonly options?: readonly OptionContract[]
    readonly guidance?: readonly string[]
    readonly examples?: readonly string[]
    readonly output?: OutputContract
    readonly requiresSystem?: boolean
    readonly allowUnknownOptions?: boolean
}

export interface ArgumentContract {
    readonly syntax: string
    readonly description: string
    readonly choices?: readonly string[]
    readonly default?: unknown
}

export interface OptionContract {
    readonly flags: string
    readonly description: string
    readonly mandatory?: boolean
    readonly choices?: readonly string[]
    readonly default?: unknown
    readonly repeatable?: boolean
    readonly parse?: (value: string, previous: unknown) => unknown
}

export interface OutputContract {
    readonly format: "json" | "text"
    readonly description: string
    readonly value?: ValueContract
}

function configureOption(contract: OptionContract) {
    const option = new Option(contract.flags, contract.description)

    if (contract.mandatory) option.makeOptionMandatory()
    if (contract.choices) option.choices([...contract.choices])
    if (contract.parse) option.argParser(contract.parse)
    if (Object.hasOwn(contract, "default")) option.default(contract.default)

    return option
}

function freezeContract(contract: CommandContract): CommandContract {
    return Object.freeze({
        ...contract,
        ...(contract.aliases ? { aliases: Object.freeze([...contract.aliases]) } : {}),
        ...(contract.arguments ? { arguments: Object.freeze(contract.arguments.map(value => Object.freeze({ ...value }))) } : {}),
        ...(contract.options ? { options: Object.freeze(contract.options.map(value => Object.freeze({ ...value }))) } : {}),
        ...(contract.guidance ? { guidance: Object.freeze([...contract.guidance]) } : {}),
        ...(contract.examples ? { examples: Object.freeze([...contract.examples]) } : {})
    })
}

function descendants(command: Command): Command[] {
    return [command, ...command.commands.flatMap(descendants)]
}

function pathOf(command: Command) {
    const path: string[] = []
    let current: Command | null = command

    while (current) {
        path.unshift(current.name())
        current = current.parent
    }

    return path
}

function writeJson(result: unknown, contract: OutputContract, compact: boolean) {
    const normalized = result ?? null

    if (contract.value) assertValue(normalized, contract.value)

    console.log(JSON.stringify(normalized, null, compact ? undefined : 2))
    if (!compact) console.log()
}
