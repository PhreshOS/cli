import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { bounded, integer, page, type CommonOptions } from "./input.ts"
import { option, timeoutOption, withJson } from "./options.ts"
import {
    connectionOutput,
    connectionListPresentation,
    dataOutput,
    eventOutput,
    eventPresentation,
    pageOutput,
    sessionOutput,
    sessionListPresentation,
    sessionPresentation,
    valuePresentation
} from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"

export default function sessionCommands(root: Command, connect: ConnectSystem) {
    const sessions = defineCommand(root, {
        name: "session",
        description: "the owner's sign-ins, and ending them",
        guidance: [
            "A Session is one sign-in; several browsers can share it. It stays valid while a browser uses it, and for a day after.",
            "Signing out signs out every browser using that Session, possibly the owner's own: ask first."
        ]
    })

    defineCommand<ListOptions>(sessions, {
        name: "list",
        description: executeDescription("session", "list"),
        requiresSystem: true,
        options: withJson(
            option("--search <text>", "case-insensitive Session identity search"),
            option("--limit <count>", "maximum returned Sessions", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Sessions to skip", { parse: value => integer(value), default: 0 })
        ),
        output: dataOutput(pageOutput(sessionOutput, "matching Sessions"), "A bounded page of Sessions", sessionListPresentation),
        examples: ["phresh session list   # every sign-in still valid", "phresh session list --json   # the same, as data"]
    }, ({ options }) => connected(connect, async system => {
        const values = await system.execute({ $domain: "session", $operation: "list" })
        return page(values, options.search, bounded(options.offset, "--offset", 0), bounded(options.limit, "--limit", 1, 100), value => value.identity)
    }))

    defineCommand<IdentityOptions>(sessions, {
        name: "inspect",
        description: executeDescription("session", "find"),
        requiresSystem: true,
        options: withJson(option("--session <identity>", "Session identity", { mandatory: true })),
        output: dataOutput(sessionOutput, "The selected Session", sessionPresentation),
        examples: ["phresh session inspect --session <identity>   # one sign-in, by an identity from session list"]
    }, ({ options }) => connected(connect, async system => {
        const result = await system.execute({ $domain: "session", $operation: "find", identity: options.session })
        if (!result) throw new Error(`Unknown Session "${options.session}"`)
        return result
    }))

    defineCommand<ListConnectionsOptions>(sessions, {
        name: "connections",
        description: executeDescription("session", "connections"),
        requiresSystem: true,
        options: withJson(
            option("--session <identity>", "Session identity", { mandatory: true }),
            option("--search <text>", "case-insensitive Connection identity search"),
            option("--limit <count>", "maximum returned Connections", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Connections to skip", { parse: value => integer(value), default: 0 })
        ),
        output: dataOutput(pageOutput(connectionOutput, "matching Connections"), "A bounded page of Connections", connectionListPresentation),
        examples: ["phresh session connections --session <identity>   # the browsers using it"]
    }, ({ options }) => connected(connect, async system => {
        const values = await system.execute({ $domain: "session", $operation: "connections", identity: options.session })
        return page(values, options.search, bounded(options.offset, "--offset", 0), bounded(options.limit, "--limit", 1, 100), value => value.identity)
    }))

    defineCommand<IdentityOptions>(sessions, {
        name: "signOut",
        aliases: ["sign-out"],
        description: executeDescription("session", "signOut"),
        requiresSystem: true,
        options: withJson(option("--session <identity>", "Session identity", { mandatory: true })),
        output: dataOutput(value.nullable(value.any("ended Session")), "The Session has ended", valuePresentation),
        examples: ["phresh session sign-out --session <identity>   # signs out every browser using it; ask the owner first"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "session", $operation: "signOut", identity: options.session
    })))

    defineCommand<WaitOptions>(sessions, {
        name: "wait",
        description: executeDescription("session", "wait"),
        requiresSystem: true,
        options: withJson(
            option("--event <event>", "Session lifecycle event", {
                mandatory: true, choices: ["sessionCreate", "sessionEnd", "connectionAttach", "connectionDetach", "end"]
            }),
            option("--session <identity>", "scope the event to one Session"),
            timeoutOption
        ),
        output: dataOutput(eventOutput("The observed Session event"), "One Session event", eventPresentation),
        examples: ["phresh session wait --event sessionCreate   # waits until someone signs in", "phresh session wait --event end --session <identity>   # waits until that sign-in ends"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "session", $operation: "wait", event: options.event,
        ...(options.session ? { identity: options.session } : {}),
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type IdentityOptions = CommonOptions & Readonly<{ session: string }>
type ListOptions = CommonOptions & Readonly<{ search?: string, limit: number, offset: number }>
type ListConnectionsOptions = ListOptions & Readonly<{ session: string }>
type WaitOptions = CommonOptions & Readonly<{
    session?: string
    event: "sessionCreate" | "sessionEnd" | "connectionAttach" | "connectionDetach" | "end"
    timeout?: number
}>
