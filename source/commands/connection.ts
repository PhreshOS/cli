import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { bounded, integer, page, type CommonOptions } from "./input.ts"
import { option, timeoutOption, withJson } from "./options.ts"
import {
    connectionListPresentation,
    connectionOutput,
    connectionPresentation,
    dataOutput,
    eventOutput,
    eventPresentation,
    pageOutput,
    sessionOutput,
    sessionPresentation,
    valuePresentation
} from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"

export default function connectionCommands(root: Command, connect: ConnectSystem) {
    const connections = defineCommand(root, {
        name: "connection",
        description: "inspect live browser Connections and their Sessions"
    })

    defineCommand<ListOptions>(connections, {
        name: "list",
        description: executeDescription("connection", "list"),
        requiresSystem: true,
        options: withJson(
            option("--search <text>", "case-insensitive Connection identity search"),
            option("--limit <count>", "maximum returned Connections", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Connections to skip", { parse: value => integer(value), default: 0 })
        ),
        output: dataOutput(pageOutput(connectionOutput, "matching Connections"), "A bounded page of Connections", connectionListPresentation),
        examples: ["phresh connection list", "phresh connection list --json"]
    }, ({ options }) => connected(connect, async system => {
        const values = await system.execute({ $domain: "connection", $operation: "list" })
        return page(values, options.search, bounded(options.offset, "--offset", 0), bounded(options.limit, "--limit", 1, 100), value => value.identity)
    }))

    defineCommand<IdentityOptions>(connections, {
        name: "inspect",
        description: executeDescription("connection", "find"),
        requiresSystem: true,
        options: withJson(option("--connection <identity>", "Connection identity", { mandatory: true })),
        output: dataOutput(connectionOutput, "The selected Connection", connectionPresentation),
        examples: ["phresh connection inspect --connection <identity>"]
    }, ({ options }) => connected(connect, async system => {
        const result = await system.execute({ $domain: "connection", $operation: "find", identity: options.connection })
        if (!result) throw new Error(`Unknown Connection "${options.connection}"`)
        return result
    }))

    defineCommand<IdentityOptions>(connections, {
        name: "session",
        description: executeDescription("connection", "session"),
        requiresSystem: true,
        options: withJson(option("--connection <identity>", "Connection identity", { mandatory: true })),
        output: dataOutput(value.nullable(sessionOutput), "The attached Session, if any", valuePresentation),
        examples: ["phresh connection session --connection <identity>"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "connection", $operation: "session", identity: options.connection
    })))

    defineCommand<IdentityOptions>(connections, {
        name: "signIn",
        aliases: ["sign-in"],
        description: executeDescription("connection", "signIn"),
        requiresSystem: true,
        options: withJson(option("--connection <identity>", "unsigned Connection identity", { mandatory: true })),
        output: dataOutput(sessionOutput, "The created Session", sessionPresentation),
        examples: ["phresh connection sign-in --connection <identity>"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "connection", $operation: "signIn", identity: options.connection
    })))

    defineCommand<WaitOptions>(connections, {
        name: "wait",
        description: executeDescription("connection", "wait"),
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Connection lifecycle event", {
                mandatory: true, choices: ["connectionCreate", "connectionDisconnect", "sessionChange", "disconnect"]
            }),
            option("--connection <identity>", "scope the event to one Connection"),
            timeoutOption
        ),
        output: dataOutput(eventOutput("The observed Connection event"), "One Connection event", eventPresentation),
        examples: ["phresh connection wait --event connectionCreate", "phresh connection wait --event sessionChange --connection <identity>"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "connection", $operation: "wait", event: options.event,
        ...(options.connection ? { identity: options.connection } : {}),
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type IdentityOptions = CommonOptions & Readonly<{ connection: string }>
type ListOptions = CommonOptions & Readonly<{ search?: string, limit: number, offset: number }>
type WaitOptions = CommonOptions & Readonly<{
    connection?: string
    event: "connectionCreate" | "connectionDisconnect" | "sessionChange" | "disconnect"
    timeout?: number
}>
