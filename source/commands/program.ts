import type { Command } from "commander"
import { parsePermissionName } from "@phreshos/core"
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
import { connected, requireProgram, type ConnectSystem } from "./system-connection.ts"
import { bounded, integer, json, launch, page, payload, writeIcon, type CommonOptions, type LaunchOptions } from "./input.ts"
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
            option("--startup-only", "return only Programs that start with the System"),
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
            ...(options.installedOnly === true ? { installed: true } : {}),
            ...(options.startupOnly === true ? { startup: true } : {})
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
        name: "definition",
        description: executeDescription("program", "definition"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.any("Complete canonical Program definition"), "The Program definition", { format: "value" }),
        examples: ["phresh program definition --program terminal --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "definition",
        identity: options.program
    })))

    defineCommand<ProgramOptions>(programs, {
        name: "getStartup",
        aliases: ["get-startup"],
        description: executeDescription("program", "getStartup"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.any("The launch started with the System, or null"), "The Program startup launch", { format: "value" }),
        examples: ["phresh program get-startup --program terminal --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "getStartup",
        identity: options.program
    })))

    defineCommand<ProgramStartupOptions>(programs, {
        name: "setStartup",
        aliases: ["set-startup"],
        description: executeDescription("program", "setStartup"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            ...launchOptions
        ),
        output: dataOutput(value.any("The launch started with the System"), "The Program startup launch", { format: "value" }),
        examples: ["phresh program set-startup --program terminal --json", "phresh program set-startup --program terminal --client --name main --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "setStartup",
        identity: options.program,
        launch: launch(options)
    })))

    defineCommand<ProgramOptions>(programs, {
        name: "removeStartup",
        aliases: ["remove-startup"],
        description: executeDescription("program", "removeStartup"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.nullable(value.any("removed startup")), "Startup is removed", { format: "value" }),
        examples: ["phresh program remove-startup --program terminal"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "removeStartup",
        identity: options.program
    })))

    defineCommand<ProgramOptions>(programs, {
        name: "pinned",
        description: executeDescription("program", "pinned"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.boolean("whether the Program is pinned"), "The Program pinned state", { format: "value" }),
        examples: ["phresh program pinned --program terminal"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "pinned",
        identity: options.program
    })))

    defineCommand<ProgramOptions & Readonly<{ unpin?: boolean }>>(programs, {
        name: "pin",
        description: executeDescription("program", "pin"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--unpin", "unpin rather than pin the Program")
        ),
        output: dataOutput(value.boolean("whether the Program is pinned"), "The Program pinned state", { format: "value" }),
        examples: ["phresh program pin --program terminal", "phresh program pin --program terminal --unpin"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "pin",
        identity: options.program,
        pinned: options.unpin !== true
    })))

    defineCommand<ProgramPermissionOptions>(programs, {
        name: "getPermission",
        aliases: ["get-permission"],
        description: executeDescription("program", "getPermission"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--permission <name>", "permission name", { mandatory: true })
        ),
        output: dataOutput(value.any("effective permission assignment"), "The effective permission", { format: "value" }),
        examples: ["phresh program get-permission --program terminal --permission network --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "getPermission",
        identity: options.program,
        permission: parsePermissionName(options.permission)
    })))

    defineCommand<ProgramOptions>(programs, {
        name: "listPermissions",
        aliases: ["list-permissions"],
        description: executeDescription("program", "listPermissions"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.any("effective permission assignments"), "The effective permissions", { format: "value" }),
        examples: ["phresh program list-permissions --program terminal --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "listPermissions",
        identity: options.program
    })))

    defineCommand<ProgramPermissionValueOptions>(programs, {
        name: "allowsPermission",
        aliases: ["allows-permission"],
        description: executeDescription("program", "allowsPermission"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--permission <name>", "permission name", { mandatory: true }),
            option("--value <json>", "requested permission value encoded as JSON")
        ),
        output: dataOutput(value.boolean("whether the requested access is allowed"), "The permission decision", { format: "value" }),
        examples: ["phresh program allows-permission --program terminal --permission network --value '[\"https://example.com\"]'"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "allowsPermission",
        identity: options.program,
        permission: parsePermissionName(options.permission),
        ...(options.value === undefined ? {} : { value: permissionRequest(options.value) })
    })))

    defineCommand<ProgramPermissionValueOptions>(programs, {
        name: "allowPermission",
        aliases: ["allow-permission"],
        description: executeDescription("program", "allowPermission"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--permission <name>", "permission name", { mandatory: true }),
            option("--value <json>", "complete allowed permission value encoded as JSON")
        ),
        output: dataOutput(value.any("stored permission assignment"), "The stored permission", { format: "value" }),
        examples: ["phresh program allow-permission --program terminal --permission network --value '[\"https://example.com\"]'"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "allowPermission",
        identity: options.program,
        permission: parsePermissionName(options.permission),
        ...(options.value === undefined ? {} : { value: permissionRequest(options.value) })
    })))

    defineCommand<ProgramPermissionOptions>(programs, {
        name: "denyPermission",
        aliases: ["deny-permission"],
        description: executeDescription("program", "denyPermission"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--permission <name>", "permission name", { mandatory: true })
        ),
        output: dataOutput(value.any("stored permission assignment"), "The stored permission", { format: "value" }),
        examples: ["phresh program deny-permission --program terminal --permission network"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "denyPermission",
        identity: options.program,
        permission: parsePermissionName(options.permission)
    })))

    defineCommand<ProgramPermissionOptions>(programs, {
        name: "resetPermission",
        aliases: ["reset-permission"],
        description: executeDescription("program", "resetPermission"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--permission <name>", "permission name", { mandatory: true })
        ),
        output: dataOutput(value.any("effective permission"), "The effective permission", { format: "value" }),
        examples: ["phresh program reset-permission --program terminal --permission network"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program",
        $operation: "resetPermission",
        identity: options.program,
        permission: parsePermissionName(options.permission)
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

    const store = defineCommand(programs, {
        name: "store",
        description: "read and change one Program's key-value store"
    })

    defineCommand<ProgramKeyOptions>(store, {
        name: "get",
        description: executeDescription("program", "storeGet"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true }), option("--key <key>", "store key", { mandatory: true })),
        output: dataOutput(value.any("stored JSON value, or null"), "The stored value", { format: "value" }),
        examples: ["phresh program store get --program notes --key tab"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "program", $operation: "storeGet", identity: options.program, key: options.key })))

    defineCommand<ProgramKeyOptions & Readonly<{ value: string, ttl?: number }>>(store, {
        name: "set",
        description: executeDescription("program", "storeSet"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--key <key>", "store key", { mandatory: true }),
            option("--value <json>", "JSON value", { mandatory: true }),
            option("--ttl <milliseconds>", "time until the key expires", { parse: value => integer(value) })
        ),
        output: dataOutput(value.boolean("whether the value changed"), "Whether the value changed", { format: "value" }),
        examples: ["phresh program store set --program notes --key tab --value '\"colors\"'"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "program", $operation: "storeSet", identity: options.program, key: options.key, value: payload(options.value) as never,
        ...(options.ttl === undefined ? {} : { ttl: bounded(options.ttl, "--ttl", 1) })
    })))

    defineCommand<ProgramKeyOptions>(store, {
        name: "delete",
        description: executeDescription("program", "storeDelete"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true }), option("--key <key>", "store key", { mandatory: true })),
        output: dataOutput(value.boolean("whether the key existed"), "Deletion result", { format: "value" }),
        examples: ["phresh program store delete --program notes --key tab"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "program", $operation: "storeDelete", identity: options.program, key: options.key })))

    defineCommand<ProgramLogsOptions>(programs, {
        name: "query",
        description: executeDescription("program", "query"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--statement <sql>", "SQL statement", { mandatory: true }),
            option("--values <json>", "bound statement values encoded as a JSON array")
        ),
        output: dataOutput(value.array(value.any("row"), "rows"), "Rows the statement returned", { format: "value" }),
        examples: ["phresh program query --program notes --statement 'select * from notes limit 10' --json"]
    }, ({ options }) => connected(connect, system => {
        const parsed = options.values === undefined ? undefined : json(options.values, "--values")
        if (parsed !== undefined && !Array.isArray(parsed)) throw new Error("--values must be a JSON array")
        return system.execute({ $domain: "program", $operation: "query", identity: options.program, statement: options.statement, ...(parsed === undefined ? {} : { values: parsed }) })
    }))

    defineCommand<ProgramIconOptions>(programs, {
        name: "icon",
        description: "Write one Program's icon to a PNG file.",
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--size <size>", "rendered size", { choices: ["small", "medium", "large"] }),
            option("--output <file>", "PNG file to write", { mandatory: true })
        ),
        output: dataOutput(value.any("written file"), "Where the icon was written", { format: "value" }),
        examples: ["phresh program icon --program notes --size large --output notes.png"]
    }, ({ options }) => connected(connect, async system => writeIcon(await (await requireProgram(system, options.program)).icon(options.size), options.output)))

    defineCommand<ProgramOptions>(programs, {
        name: "exitProcesses",
        aliases: ["exit-processes"],
        description: executeDescription("program", "exitProcesses"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.array(value.string("Process identity"), "ended Processes"), "The Processes that ended", { format: "value" }),
        examples: ["phresh program exit-processes --program notes"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "program", $operation: "exitProcesses", identity: options.program })))

    defineCommand<ProgramOptions>(programs, {
        name: "forget",
        description: executeDescription("program", "forget"),
        requiresSystem: true,
        options: withJson(option("--program <identity>", "Program identity", { mandatory: true })),
        output: dataOutput(value.nullable(value.any("nothing")), "The Program is forgotten", { format: "value" }),
        examples: ["phresh program forget --program notes"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "program", $operation: "forget", identity: options.program })))

    defineCommand<ProgramWaitOptions>(programs, {
        name: "wait",
        description: executeDescription("program", "wait"),
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Program lifecycle event", {
                mandatory: true,
                choices: ["create", "forget", "install", "uninstall", "pin", "changePermissions", "changeStartup", "processCreate", "processExit"]
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
type ProgramKeyOptions = ProgramOptions & Readonly<{ key: string }>
type ProgramIconOptions = ProgramOptions & Readonly<{ size?: "small" | "medium" | "large", output: string }>
type ProgramStartupOptions = CommonOptions & LaunchOptions & Readonly<{ program: string }>
type ProgramPermissionOptions = ProgramOptions & Readonly<{ permission: string }>
type ProgramPermissionValueOptions = ProgramPermissionOptions & Readonly<{ value?: string }>
type ProgramLogsOptions = CommonOptions & Readonly<{
    program: string
    statement: string
    values?: string
}>
type ProgramListOptions = CommonOptions & Readonly<{
    installedOnly?: boolean
    startupOnly?: boolean
    search?: string
    limit: number
    offset: number
}>
type ProgramWaitOptions = CommonOptions & Readonly<{
    event: "create" | "forget" | "install" | "uninstall" | "pin" | "changePermissions" | "changeStartup" | "processCreate" | "processExit"
    program?: string
    timeout?: number
}>

function permissionRequest(source: string): true | string[] {
    const value = json(source, "--value")
    if (value === true || strings(value)) return value
    throw new Error("--value must be true or a JSON array of strings")
}

function strings(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(entry => typeof entry === "string")
}
