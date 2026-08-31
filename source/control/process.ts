import type { SystemProcessEntity, SystemProcessExit } from "@phreshos/core"
import { Option, type Command } from "commander"
import { commandContract } from "../command-contract.ts"
import { launchOptions, outputOptions, processOptions } from "./options.ts"
import {
    bounded,
    connected,
    integer,
    launch,
    output,
    page,
    processView,
    requireProcess,
    requireProgram,
    wait,
    type CommonOptions,
    type ConnectSystem,
    type LaunchOptions,
    type ProcessCoordinates
} from "./shared.ts"

export default function processCommands(root: Command, connect: ConnectSystem) {
    const process = commandContract(root.command("process")
        .description("discover and control live Program executions"))

    outputOptions(process.command("list")
        .description("list live Processes with bounded filtering")
        .option("--program <identity>", "restrict results to one Program")
        .option("--search <text>", "case-insensitive identity or name search")
        .option("--limit <count>", "maximum returned Processes", integer, 30)
        .option("--offset <count>", "number of matching Processes to skip", integer, 0))
        .action(async (options: ProcessListOptions) => connected(connect, async system => {
            const processes = options.program
                ? await (await requireProgram(system, options.program)).process.list()
                : await system.process.list()
            const selected = page(
                processes,
                options.search,
                bounded(options.offset, "--offset", 0),
                bounded(options.limit, "--limit", 1, 100),
                value => `${value.identity}\n${value.name ?? ""}`
            )
            output({ ...selected, data: await Promise.all(selected.data.map(processView)) }, options.compact)
        }))

    outputOptions(processOptions(process.command("inspect")
        .description("read one live Process and its Endpoint state")))
        .action(async (options: ProcessOptions) => connected(connect, async system => {
            output(await processView(await requireProcess(system, options.process, options.program)), options.compact)
        }))

    outputOptions(launchOptions(process.command("create")
        .description("create a Process")
        .requiredOption("--program <identity>", "owning Program identity")))
        .action(async (options: ProcessCreateOptions) => connected(connect, async system => {
            const program = await requireProgram(system, options.program)
            output(await processView(await program.process.create(launch(options))), options.compact)
        }))

    outputOptions(launchOptions(process.command("findOrCreate")
        .alias("find-or-create")
        .description("find the named Process or create it atomically")
        .requiredOption("--program <identity>", "owning Program identity")))
        .action(async (options: ProcessCreateOptions) => connected(connect, async system => {
            const program = await requireProgram(system, options.program)
            output(await processView(await program.process.findOrCreate(launch(options, true) as ReturnType<typeof launch> & { name: string })), options.compact)
        }))

    outputOptions(processOptions(process.command("exit")
        .description("exit one Process and all of its live Endpoints")))
        .action(async (options: ProcessOptions) => connected(connect, async system => {
            const process = await requireProcess(system, options.process, options.program)
            const snapshot = await processView(process)
            await process.exit()
            output(snapshot, options.compact)
        }))

    outputOptions(process.command("wait")
        .description("wait for one Process lifecycle event")
        .addOption(new Option("--event <event>", "Process lifecycle event")
            .choices(["create", "exit"])
            .makeOptionMandatory())
        .option("--process <identity>", "scope the event to one Process")
        .option("--program <identity>", "scope the event to one Program")
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer))
        .action(async (options: ProcessWaitOptions) => connected(connect, async system => {
            if (options.process && options.event === "create") throw new Error("An individual Process does not emit create")

            const target = options.process
                ? await requireProcess(system, options.process, options.program)
                : options.program
                    ? (await requireProgram(system, options.program)).process
                    : system.process
            const message = await wait(target, options.event, options.timeout === undefined
                ? undefined
                : bounded(options.timeout, "--timeout", 1))

            output({
                scope: options.process ? `process:${options.process}` : options.program ? `program:${options.program}` : "process",
                event: options.event,
                payload: await eventView(options.event, message, options.process ? target as SystemProcessEntity : undefined)
            }, options.compact)
        }))
}

async function eventView(event: ProcessWaitOptions["event"], message: unknown, scoped?: SystemProcessEntity) {
    if (event === "create") return processView(message as SystemProcessEntity)

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
