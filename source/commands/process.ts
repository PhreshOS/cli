import type { Process, SystemProcessExit } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { launchOptions, namedLaunchOptions, option, processOptions, timeoutOption, withJson } from "./options.ts"
import { eventOutput, jsonOutput, pageOutput, processOutput } from "./schemas.ts"
import { connected, requireProcess, requireProgram, type ConnectSystem } from "./connection.ts"
import { bounded, integer, launch, page, type CommonOptions, type LaunchOptions, type ProcessCoordinates } from "./input.ts"
import { wait } from "./observation.ts"
import { processView } from "./projection.ts"

export default function processCommands(root: Command, connect: ConnectSystem) {
    const processes = defineCommand(root, {
        name: "process",
        description: "discover and control live Program executions",
        guidance: ["A Process is one execution of a Program and owns its Server and Client Endpoints."]
    })

    defineCommand<ProcessListOptions>(processes, {
        name: "list",
        description: "list live Processes with bounded filtering",
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "restrict results to one Program"),
            option("--search <text>", "case-insensitive identity or name search"),
            option("--limit <count>", "maximum returned Processes", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Processes to skip", { parse: value => integer(value), default: 0 })
        ),
        output: jsonOutput(pageOutput(processOutput, "matching Processes"), "A bounded page of Processes"),
        examples: ["phresh process list", "phresh process list --program terminal --json"]
    }, async ({ options }) => connected(connect, async system => {
        const processes = options.program
            ? await (await requireProgram(system, options.program)).process.list()
            : await system.process.list()
        const selected = page(
            processes,
            options.search,
            bounded(options.offset, "--offset", 0),
            bounded(options.limit, "--limit", 1, 100),
            current => `${current.identity}\n${current.name ?? ""}`
        )
        return { ...selected, data: await Promise.all(selected.data.map(processView)) }
    }))

    defineCommand<ProcessOptions>(processes, {
        name: "inspect",
        description: "read one live Process and its Endpoint state",
        requiresSystem: true,
        options: withJson(...processOptions),
        output: jsonOutput(processOutput, "The selected Process"),
        examples: ["phresh process inspect --process main --program terminal"]
    }, async ({ options }) => connected(connect, async system => {
        return await processView(await requireProcess(system, options.process, options.program))
    }))

    defineCommand<ProcessCreateOptions>(processes, {
        name: "create",
        description: "create a Process",
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "owning Program identity", { mandatory: true }),
            ...launchOptions
        ),
        output: jsonOutput(processOutput, "The created Process"),
        examples: ["phresh process create --program terminal --server --client", "phresh process create --program terminal --name main --json"]
    }, async ({ options }) => connected(connect, async system => {
        const program = await requireProgram(system, options.program)
        return await processView(await program.process.create(launch(options)))
    }))

    defineCommand<ProcessCreateOptions>(processes, {
        name: "findOrCreate",
        aliases: ["find-or-create"],
        description: "find the named Process or create it atomically",
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "owning Program identity", { mandatory: true }),
            ...namedLaunchOptions
        ),
        output: jsonOutput(processOutput, "The existing or created Process"),
        examples: ["phresh process find-or-create --program terminal --name main --json"]
    }, async ({ options }) => connected(connect, async system => {
        const program = await requireProgram(system, options.program)
        return await processView(await program.process.findOrCreate(
            launch(options, true) as ReturnType<typeof launch> & { name: string }
        ))
    }))

    defineCommand<ProcessOptions>(processes, {
        name: "exit",
        description: "exit one Process and all of its live Endpoints",
        requiresSystem: true,
        options: withJson(...processOptions),
        output: jsonOutput(processOutput, "The Process state immediately before exit"),
        examples: ["phresh process exit --process main --program terminal"]
    }, async ({ options }) => connected(connect, async system => {
        const process = await requireProcess(system, options.process, options.program)
        const snapshot = await processView(process)
        await process.exit()
        return snapshot
    }))

    defineCommand<ProcessWaitOptions>(processes, {
        name: "wait",
        description: "wait for one Process lifecycle event",
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Process lifecycle event", { mandatory: true, choices: ["create", "exit"] }),
            option("--process <identity>", "scope the event to one Process"),
            option("--program <identity>", "scope the event to one Program"),
            timeoutOption
        ),
        output: jsonOutput(eventOutput("The observed Process event", value.any("Process state or exit result")), "One Process event"),
        examples: ["phresh process wait --event create", "phresh process wait --event exit --process main --program terminal --json"]
    }, async ({ options }) => connected(connect, async system => {
        if (options.process && options.event === "create") throw new Error("An individual Process does not emit create")

        const target = options.process
            ? await requireProcess(system, options.process, options.program)
            : options.program
                ? (await requireProgram(system, options.program)).process
                : system.process
        const message = await wait(target, options.event, options.timeout === undefined
            ? undefined
            : bounded(options.timeout, "--timeout", 1))

        return {
            scope: options.process ? `process:${options.process}` : options.program ? `program:${options.program}` : "process",
            event: options.event,
            payload: await eventView(options.event, message, options.process ? target as Process : undefined)
        }
    }))
}

async function eventView(event: ProcessWaitOptions["event"], message: unknown, scoped?: Process) {
    if (event === "create") return processView(message as Process)

    const exit = message as SystemProcessExit
    const process = exit.process ?? scoped
    return {
        ...(process ? { process: await processView(process) } : {}),
        status: exit.status,
        code: exit.code,
        signal: exit.signal
    }
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
