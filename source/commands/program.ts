import type { Program, SystemProgramUninstall } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { option, timeoutOption, withJson } from "./options.ts"
import { eventOutput, jsonOutput, pageOutput, programOutput } from "./schemas.ts"
import { connected, requireProgram, type ConnectSystem } from "./connection.ts"
import { bounded, integer, page, type CommonOptions } from "./input.ts"
import { wait } from "./observation.ts"
import { programView } from "./projection.ts"

export default function programCommands(root: Command, connect: ConnectSystem) {
    const programs = defineCommand(root, {
        name: "program",
        description: "discover PhreshOS Programs and their agent documentation",
        guidance: ["A Program is the stable installed or retained definition that owns Processes."]
    })

    defineCommand<ProgramListOptions>(programs, {
        name: "list",
        description: "list Programs with bounded filtering",
        requiresSystem: true,
        options: withJson(
            option("--installed-only", "return only installed Programs"),
            option("--search <text>", "case-insensitive identity, name, or description search"),
            option("--limit <count>", "maximum returned Programs", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Programs to skip", { parse: value => integer(value), default: 0 })
        ),
        output: jsonOutput(pageOutput(programOutput, "matching Programs"), "A bounded page of Programs"),
        examples: ["phresh program list", "phresh program list --installed-only --json"]
    }, async ({ options }) => connected(connect, async system => {
        const programs = await system.program.list(options.installedOnly === true)
        const selected = page(
            programs,
            options.search,
            bounded(options.offset, "--offset", 0),
            bounded(options.limit, "--limit", 1, 100),
            current => `${current.identity}\n${current.name}\n${current.description ?? ""}`
        )
        return { ...selected, data: await Promise.all(selected.data.map(programView)) }
    }))

    defineCommand<ProgramOptions>(programs, {
        name: "inspect",
        description: "read one Program declaration and installed state",
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: jsonOutput(programOutput, "The selected Program"),
        examples: ["phresh program inspect --program terminal"]
    }, async ({ options }) => connected(connect, async system => {
        return await programView(await requireProgram(system, options.program))
    }))

    defineCommand<ProgramOptions>(programs, {
        name: "agent",
        description: "read a Program's own agent operating policy",
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: jsonOutput(value.object({
            program: value.string("Program identity"),
            content: value.string("Program-owned agent documentation")
        }, ["program", "content"], "Program agent documentation"), "The Program's agent documentation"),
        examples: ["phresh program agent --program terminal --json"]
    }, async ({ options }) => connected(connect, async system => {
        const program = await requireProgram(system, options.program)
        const content = await program.agent()
        if (content === null) throw new Error(`Program "${program.identity}" has no agent documentation`)
        return { program: program.identity, content }
    }))

    defineCommand<ProgramWaitOptions>(programs, {
        name: "wait",
        description: "wait for one Program registry event",
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Program lifecycle event", {
                mandatory: true,
                choices: ["create", "forget", "install", "uninstall"]
            }),
            option("--program <identity>", "scope forget or uninstall to one Program"),
            timeoutOption
        ),
        output: jsonOutput(eventOutput("The observed Program event", value.any("Program state or uninstall result")), "One Program event"),
        examples: ["phresh program wait --event create", "phresh program wait --event uninstall --program terminal --json"]
    }, async ({ options }) => connected(connect, async system => {
        if (options.program && options.event !== "forget" && options.event !== "uninstall") {
            throw new Error("An individual Program emits only forget and uninstall")
        }

        const target = options.program ? await requireProgram(system, options.program) : system.program
        const message = await wait(target, options.event, timeout(options.timeout))
        return {
            scope: options.program ? `program:${options.program}` : "program",
            event: options.event,
            payload: await eventView(options.event, message, options.program ? target as Program : undefined)
        }
    }))
}

async function eventView(event: ProgramWaitOptions["event"], message: unknown, scoped?: Program) {
    if (event === "uninstall") {
        if (scoped) return { program: await programView(scoped), everything: message === true }
        const current = message as SystemProgramUninstall
        return { program: await programView(current.program), everything: current.everything }
    }

    if (scoped) return programView(scoped)
    return programView(message as Program)
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
