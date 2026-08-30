import type { SystemProgramEntity, SystemProgramUninstall } from "@phreshos/core"
import { Option, type Command } from "commander"
import { commandContract } from "../command-contract.ts"
import { outputOptions } from "./options.ts"
import {
    bounded,
    connected,
    integer,
    output,
    page,
    programView,
    requireProgram,
    wait,
    type CommonOptions,
    type ConnectSystem
} from "./shared.ts"

export default function programCommands(root: Command, connect: ConnectSystem) {
    const program = commandContract(root.command("program")
        .description("discover PhreshOS Programs and their agent documentation"))

    outputOptions(program.command("list")
        .description("list Programs with bounded filtering")
        .option("--installed-only", "return only installed Programs")
        .option("--search <text>", "case-insensitive identity, name, or description search")
        .option("--limit <count>", "maximum returned Programs", integer, 30)
        .option("--offset <count>", "number of matching Programs to skip", integer, 0))
        .action(async (options: ProgramListOptions) => connected(connect, async system => {
            const programs = await system.program.list(options.installedOnly === true)
            const selected = page(
                programs,
                options.search,
                bounded(options.offset, "--offset", 0),
                bounded(options.limit, "--limit", 1, 100),
                value => `${value.identity}\n${value.name}\n${value.description ?? ""}`
            )
            output({ ...selected, data: await Promise.all(selected.data.map(programView)) }, options.compact)
        }))

    outputOptions(program.command("inspect")
        .description("read one Program declaration and installed state")
        .requiredOption("--program <identity>", "Program identity"))
        .action(async (options: ProgramOptions) => connected(connect, async system => {
            output(await programView(await requireProgram(system, options.program)), options.compact)
        }))

    outputOptions(program.command("agent")
        .description("read a Program's own agent operating policy")
        .requiredOption("--program <identity>", "Program identity"))
        .action(async (options: ProgramOptions) => connected(connect, async system => {
            const program = await requireProgram(system, options.program)
            const content = await program.agent()
            if (content === null) throw new Error(`Program "${program.identity}" has no agent documentation`)
            output({ program: program.identity, content }, options.compact)
        }))

    outputOptions(program.command("wait")
        .description("wait for one Program registry event")
        .addOption(new Option("--event <event>", "Program lifecycle event")
            .choices(["create", "forget", "install", "uninstall"])
            .makeOptionMandatory())
        .option("--program <identity>", "scope forget or uninstall to one Program")
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer))
        .action(async (options: ProgramWaitOptions) => connected(connect, async system => {
            if (options.program && options.event !== "forget" && options.event !== "uninstall") {
                throw new Error("An individual Program emits only forget and uninstall")
            }

            const target = options.program ? await requireProgram(system, options.program) : system.program
            const message = await wait(target, options.event, timeout(options.timeout))
            output({
                scope: options.program ? `program:${options.program}` : "program",
                event: options.event,
                payload: await eventView(options.event, message)
            }, options.compact)
        }))
}

async function eventView(event: ProgramWaitOptions["event"], message: unknown) {
    if (event === "uninstall") {
        const value = message as SystemProgramUninstall
        return { program: await programView(value.program), everythingRemoved: value.everythingRemoved }
    }

    return programView(message as SystemProgramEntity)
}

function timeout(value?: number) {
    return value === undefined ? undefined : bounded(value, "--timeout", 1)
}

type ProgramOptions = CommonOptions & Readonly<{ program: string }>
type ProgramListOptions = CommonOptions & Readonly<{
    installedOnly?: boolean
    search?: string
    limit: number
    offset: number
}>
type ProgramWaitOptions = CommonOptions & Readonly<{
    event: "create" | "forget" | "install" | "uninstall"
    program?: string
    timeout?: number
}>
