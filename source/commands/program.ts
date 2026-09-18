import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { launchOptions, option, timeoutOption, withJson } from "./options.ts"
import {
    dataOutput,
    eventOutput,
    eventPresentation,
    pageOutput,
    programListPresentation,
    programOutput,
    programPresentation
} from "./schemas.ts"
import { connected, type ConnectSystem } from "./connection.ts"
import { bounded, integer, json, launch, page, type CommonOptions, type LaunchOptions } from "./input.ts"
import { executeDescription } from "./execution.ts"

export default function programCommands(root: Command, connect: ConnectSystem) {
    const programs = defineCommand(root, {
        name: "program",
        description: "discover PhreshOS Programs and their agent documentation",
        guidance: ["A Program is the stable installed or retained definition that owns Processes."]
    })

    defineCommand<ProgramListOptions>(programs, {
        name: "list",
        description: executeDescription("program", "list"),
        requiresSystem: true,
        options: withJson(
            option("--installed-only", "return only installed Programs"),
            option("--search <text>", "case-insensitive identity, name, or description search"),
            option("--limit <count>", "maximum returned Programs", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Programs to skip", { parse: value => integer(value), default: 0 })
        ),
        output: dataOutput(pageOutput(programOutput, "matching Programs"), "A bounded page of Programs", programListPresentation),
        examples: ["phresh program list", "phresh program list --installed-only --json"]
    }, async ({ options }) => connected(connect, async system => {
        const programs = await system.execute({
            $domain: "program",
            $operation: "list",
            installedOnly: options.installedOnly === true
        })
        const selected = page(
            programs,
            options.search,
            bounded(options.offset, "--offset", 0),
            bounded(options.limit, "--limit", 1, 100),
            current => `${current.identity}\n${current.name}\n${current.description ?? ""}`
        )
        return selected
    }))

    defineCommand<ProgramOptions>(programs, {
        name: "inspect",
        description: executeDescription("program", "find"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(programOutput, "The selected Program", programPresentation),
        examples: ["phresh program inspect --program terminal"]
    }, async ({ options }) => connected(connect, async system => {
        const program = await system.execute({ $domain: "program", $operation: "find", identity: options.program })
        if (!program) throw new Error(`Unknown Program "${options.program}"`)
        return program
    }))

    defineCommand<ProgramOptions>(programs, {
        name: "agent",
        description: executeDescription("program", "agent"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.object({
            program: value.string("Program identity"),
            content: value.string("Program-owned agent documentation")
        }, ["program", "content"], "Program agent documentation"), "The Program's agent documentation", {
            format: "document",
            content: "content"
        }),
        examples: ["phresh program agent --program terminal --json"]
    }, async ({ options }) => connected(connect, async system => {
        const result = await system.execute({ $domain: "program", $operation: "agent", identity: options.program })
        if (result.content === null) throw new Error(`Program "${result.program}" has no agent documentation`)
        return result
    }))

    defineCommand<ProgramOptions>(programs, {
        name: "getLaunch",
        aliases: ["get-launch"],
        description: executeDescription("program", "getLaunch"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.any("Saved Process launch or null"), "The saved Program launch", { format: "value" }),
        examples: ["phresh program get-launch --program terminal --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "getLaunch",
        identity: options.program
    })))

    defineCommand<ProgramLaunchOptions>(programs, {
        name: "setLaunch",
        aliases: ["set-launch"],
        description: executeDescription("program", "setLaunch"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            ...launchOptions
        ),
        output: dataOutput(value.any("Saved Process launch"), "The saved Program launch", { format: "value" }),
        examples: ["phresh program set-launch --program terminal --client --name main --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "setLaunch",
        identity: options.program,
        launch: launch(options)
    })))

    defineCommand<ProgramLogsOptions>(programs, {
        name: "logs",
        description: executeDescription("program", "logs"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--statement <sql>", "read-only SQL statement", { mandatory: true }),
            option("--values <json>", "bound statement values encoded as a JSON array")
        ),
        output: dataOutput(value.array(value.any("log query row"), "log query rows"), "Program log query result", { format: "value" }),
        examples: ["phresh program logs --program terminal --statement 'select createdAt, process, source, kind, content from logs order by createdAt desc limit 100' --json"]
    }, ({ options }) => connected(connect, system => {
        const parsed = options.values === undefined ? undefined : json(options.values, "--values")
        if (parsed !== undefined && !Array.isArray(parsed)) throw new Error("--values must be a JSON array")

        return system.execute({
            $domain: "program",
            $operation: "logs",
            identity: options.program,
            statement: options.statement,
            ...(parsed === undefined ? {} : { values: parsed })
        })
    }))

    defineCommand<ProgramWaitOptions>(programs, {
        name: "wait",
        description: executeDescription("program", "wait"),
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Program lifecycle event", {
                mandatory: true,
                choices: ["create", "forget", "install", "uninstall", "processCreate", "processExit"]
            }),
            option("--program <identity>", "observe events belonging to one Program"),
            timeoutOption
        ),
        output: dataOutput(
            eventOutput("The observed Program event", value.any("Program state or uninstall result")),
            "One Program event",
            eventPresentation
        ),
        examples: ["phresh program wait --event create", "phresh program wait --event uninstall --program terminal --json"]
    }, async ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "wait",
        event: options.event,
        ...(options.program ? { program: options.program } : {}),
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type ProgramOptions = CommonOptions & Readonly<{ program: string }>
type ProgramLaunchOptions = CommonOptions & LaunchOptions & Readonly<{ program: string }>
type ProgramLogsOptions = CommonOptions & Readonly<{
    program: string
    statement: string
    values?: string
}>
type ProgramListOptions = CommonOptions & Readonly<{
    installedOnly?: boolean
    search?: string
    limit: number
    offset: number
}>
type ProgramWaitOptions = CommonOptions & Readonly<{
    event: "create" | "forget" | "install" | "uninstall" | "processCreate" | "processExit"
    program?: string
    timeout?: number
}>
