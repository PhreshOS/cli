import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { launchOptions, namedLaunchOptions, option, processOptions, timeoutOption, withJson } from "./options.ts"
import {
    dataOutput,
    eventOutput,
    eventPresentation,
    pageOutput,
    processActionPresentation,
    processIdentityPresentation,
    processListPresentation,
    processOutput,
    processPresentation
} from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { bounded, integer, launch, page, type CommonOptions, type LaunchOptions, type ProcessCoordinates } from "./input.ts"
import { executeDescription } from "./execution.ts"

export default function processCommands(root: Command, connect: ConnectSystem) {
    const processes = defineCommand(root, {
        name: "process",
        description: "start, find, and end the runs of Programs",
        guidance: [
            "A Process is one run of a Program. A run has up to two sides: its Server, on this machine, and its Client, its Window on the Desktop.",
            "To open a Program, create a Process with only --program: it starts as its author declared, the way the owner opens it from the Desktop. Add other options only when asked for something different.",
            "A run has an identity, and may have a name unique within its Program; commands accept either, a name together with --program.",
            "Ending a run closes its Window and stops its Server: ask the owner before ending one they use."
        ]
    })

    defineCommand<ProcessListOptions>(processes, {
        name: "list",
        description: executeDescription("process", "list"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "restrict results to one Program"),
            option("--search <text>", "case-insensitive identity or name search"),
            option("--limit <count>", "maximum returned Processes", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Processes to skip", { parse: value => integer(value), default: 0 })
        ),
        output: dataOutput(pageOutput(processOutput, "matching Processes"), "A bounded page of Processes", processListPresentation),
        examples: ["phresh process list   # every run you can see", "phresh process list --program terminal --json   # only Terminal's runs, as data"]
    }, async ({ options }) => connected(connect, async system => {
        const processes = await system.execute({
            $domain: "process",
            $operation: "list",
            ...(options.program ? { program: options.program } : {})
        })
        const selected = page(
            processes,
            options.search,
            bounded(options.offset, "--offset", 0),
            bounded(options.limit, "--limit", 1, 100),
            current => `${current.identity}\n${current.name ?? ""}`
        )
        return selected
    }))

    defineCommand<ProcessOptions>(processes, {
        name: "inspect",
        description: executeDescription("process", "find"),
        requiresSystem: true,
        options: withJson(...processOptions),
        output: dataOutput(processOutput, "The selected Process", processPresentation),
        examples: ["phresh process inspect --process main --program terminal   # the run of Terminal named main"]
    }, async ({ options }) => connected(connect, async system => {
        const process = await system.execute({
            $domain: "process",
            $operation: "find",
            process: options.process,
            ...(options.program ? { program: options.program } : {})
        })
        if (!process) throw new Error(`Unknown Process "${options.process}"`)
        return process
    }))

    defineCommand<ProcessCreateOptions>(processes, {
        name: "create",
        description: executeDescription("process", "create"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "owning Program identity", { mandatory: true }),
            ...launchOptions
        ),
        output: dataOutput(processOutput, "The created Process", processActionPresentation),
        examples: ["phresh process create --program terminal   # starts Terminal as it declares: the usual way to open a Program", "phresh process create --program terminal --name main --json   # the same, naming the run main to find it again"]
    }, async ({ options }) => connected(connect, async system => {
        return system.execute({
            $domain: "process",
            $operation: "create",
            program: options.program,
            launch: launch(options)
        })
    }))

    defineCommand<ProcessCreateOptions>(processes, {
        name: "findOrCreate",
        aliases: ["find-or-create"],
        description: executeDescription("process", "findOrCreate"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "owning Program identity", { mandatory: true }),
            ...namedLaunchOptions
        ),
        output: dataOutput(processOutput, "The existing or created Process", processActionPresentation),
        examples: ["phresh process find-or-create --program terminal --name main --json   # the run named main, started first if it is not running"]
    }, async ({ options }) => connected(connect, async system => {
        return system.execute({
            $domain: "process",
            $operation: "findOrCreate",
            program: options.program,
            launch: launch(options, true) as ReturnType<typeof launch> & { name: string }
        })
    }))

    defineCommand<ProcessOptions>(processes, {
        name: "exit",
        description: executeDescription("process", "exit"),
        requiresSystem: true,
        options: withJson(...processOptions),
        output: dataOutput(processOutput, "The Process state immediately before exit", processIdentityPresentation),
        examples: ["phresh process exit --process main --program terminal   # ends that run and closes its Window; ask the owner first"]
    }, async ({ options }) => connected(connect, async system => {
        return system.execute({
            $domain: "process",
            $operation: "exit",
            process: options.process,
            ...(options.program ? { program: options.program } : {})
        })
    }))

    defineCommand<ProcessWaitOptions>(processes, {
        name: "wait",
        description: executeDescription("process", "wait"),
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Process lifecycle event", { mandatory: true, choices: ["create", "exit"] }),
            option("--process <identity>", "scope the event to one Process"),
            option("--program <identity>", "scope the event to one Program"),
            timeoutOption
        ),
        output: dataOutput(
            eventOutput("The observed Process event", value.any("Process state or exit result")),
            "One Process event",
            eventPresentation
        ),
        examples: ["phresh process wait --event create   # waits until any run starts", "phresh process wait --event exit --process main --program terminal --json   # waits until that run ends, and says how"]
    }, async ({ options }) => connected(connect, system => system.execute({
        $domain: "process",
        $operation: "wait",
        event: options.event,
        ...(options.process ? { process: options.process } : {}),
        ...(options.program ? { program: options.program } : {}),
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type ProcessOptions = CommonOptions & ProcessCoordinates
type ProcessCreateOptions = CommonOptions & LaunchOptions & Readonly<{ program: string }>
type ProcessListOptions = CommonOptions & Readonly<{
    program?: string
    search?: string
    limit: number
    offset: number
}>
type ProcessWaitOptions = CommonOptions & Readonly<{
    event: "create" | "exit"
    process?: string
    program?: string
    timeout?: number
}>
