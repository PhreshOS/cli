import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import {
    clientOverrideOptions,
    endpointOptions,
    processOptions,
    option,
    serverOverrideOptions,
    timeoutOption,
    withJson
} from "./options.ts"
import {
    dataOutput,
    endpointActionPresentation,
    endpointOutput,
    endpointPresentation,
    eventOutput,
    eventPresentation,
    lifecyclePresentation,
    valuePresentation
} from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { bounded, clientLaunch, payload, serverLaunch, type ClientOptions, type CommonOptions, type ProcessCoordinates, type ServerOptions } from "./input.ts"
import type { EndpointName } from "./projection.ts"
import { executeDescription } from "./execution.ts"

export default function endpointCommands(root: Command, connect: ConnectSystem) {
    const endpoints = defineCommand(root, {
        name: "endpoint",
        description: "the two sides of a run: start or stop them, ask them, tell them",
        guidance: [
            "An Endpoint is one side of a run (Process): server, on this machine, or client, its Window. Name the run with --process (and --program for a name) and the side with --endpoint.",
            "Only a Server answers questions (ask); both sides can be told things (publish) and heard (wait).",
            "Before talking to a Program, read its agent documentation: phresh program agent --program <identity> names its events and what they take.",
            "Payloads on the command line are JSON."
        ]
    })

    defineCommand<EndpointOptions>(endpoints, {
        name: "inspect",
        description: executeDescription("endpoint", "inspect"),
        requiresSystem: true,
        options: withJson(...endpointOptions),
        output: dataOutput(endpointOutput, "The selected Endpoint", endpointPresentation),
        examples: ["phresh endpoint inspect --process main --program terminal --endpoint server   # whether that run's Server is running and ready"]
    }, async ({ options }) => executeEndpoint(connect, options, { $operation: "inspect" }))

    defineCommand<EndpointOptions & ClientOptions & ServerOptions>(endpoints, {
        name: "start",
        description: executeDescription("endpoint", "start"),
        requiresSystem: true,
        options: withJson(...endpointOptions, ...clientOverrideOptions, ...serverOverrideOptions),
        output: dataOutput(endpointOutput, "The started Endpoint", endpointActionPresentation),
        examples: ["phresh endpoint start --process main --program terminal --endpoint client   # opens that run's Window again, if it was closed"]
    }, async ({ options }) => {
        const client = clientLaunch(options)
        const server = serverLaunch(options)
        if (options.endpoint === "server" && client !== undefined) throw new Error("Client overrides require --endpoint client")
        if (options.endpoint === "client" && server !== undefined) throw new Error("Server overrides require --endpoint server")
        const launch = options.endpoint === "client"
            ? typeof client === "object" ? client : undefined
            : typeof server === "object" ? server : undefined
        return executeEndpoint(connect, options, { $operation: "start", ...(launch ? { launch } : {}) })
    })

    defineCommand<EndpointOptions>(endpoints, {
        name: "stop",
        description: executeDescription("endpoint", "stop"),
        requiresSystem: true,
        options: withJson(...endpointOptions),
        output: dataOutput(endpointOutput, "The stopped Endpoint", endpointActionPresentation),
        examples: ["phresh endpoint stop --process main --program terminal --endpoint client   # closes its Window; the run keeps its Server"]
    }, async ({ options }) => executeEndpoint(connect, options, { $operation: "stop" }))

    defineCommand<EndpointOptions & TimeoutOptions>(endpoints, {
        name: "waitReady",
        aliases: ["wait-ready"],
        description: executeDescription("endpoint", "waitReady"),
        requiresSystem: true,
        options: withJson(...endpointOptions, timeoutOption),
        output: dataOutput(endpointOutput, "The ready Server Endpoint", endpointActionPresentation),
        examples: ["phresh endpoint wait-ready --process main --program terminal --endpoint server   # waits until its Server can answer"]
    }, async ({ options }) => executeEndpoint(connect, options, {
        $operation: "waitReady",
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<EndpointOptions & LifecycleOptions & TimeoutOptions>(endpoints, {
        name: "waitLifecycle",
        aliases: ["wait-lifecycle"],
        description: executeDescription("endpoint", "waitLifecycle"),
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "Endpoint lifecycle event", { mandatory: true, choices: ["start", "stop"] }),
            timeoutOption
        ),
        output: dataOutput(value.object({
            scope: value.string("Endpoint lifecycle subscription scope"),
            event: value.enumeration(["start", "stop"], "observed lifecycle event")
        }, ["scope", "event"], "Endpoint lifecycle event"), "One Endpoint lifecycle event", lifecyclePresentation),
        examples: ["phresh endpoint wait-lifecycle --process main --program terminal --endpoint server --event start   # waits until its Server starts"]
    }, async ({ options }) => executeEndpoint(connect, options, {
        $operation: "waitLifecycle",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<EndpointOptions & EventOptions & TimeoutOptions>(endpoints, {
        name: "ask",
        description: executeDescription("endpoint", "ask"),
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON"),
            timeoutOption
        ),
        output: dataOutput(value.any("answer returned by the Server event contract"), "The Server answer", valuePresentation),
        examples: ["phresh endpoint ask --process main --program terminal --endpoint server --event status --json   # asks its Server the question status"]
    }, async ({ options }) => {
        const input = payload(options.payload)
        return executeEndpoint(connect, options, {
            $operation: "ask",
            event: options.event,
            ...(options.payload === undefined ? {} : { input }),
            ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
        })
    })

    defineCommand<EndpointOptions & EventOptions>(endpoints, {
        name: "publish",
        description: executeDescription("endpoint", "publish"),
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON")
        ),
        output: dataOutput(endpointOutput, "The Endpoint after publishing", endpointActionPresentation),
        examples: ["phresh endpoint publish --process main --program terminal --endpoint client --event changed --payload '{\"value\":1}'   # tells its Client changed, with a JSON payload"]
    }, async ({ options }) => executeEndpoint(connect, options, {
        $operation: "publish",
        event: options.event,
        ...(options.payload === undefined ? {} : { input: payload(options.payload) })
    }))

    defineCommand<EndpointOptions & EventOptions & TimeoutOptions>(endpoints, {
        name: "wait",
        description: executeDescription("endpoint", "wait"),
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "event name", { mandatory: true }),
            timeoutOption
        ),
        output: dataOutput(eventOutput("The observed Endpoint event"), "One Endpoint event", eventPresentation),
        examples: ["phresh endpoint wait --process main --program terminal --endpoint client --event changed --json   # waits until its Client publishes changed"]
    }, async ({ options }) => executeEndpoint(connect, options, {
        $operation: "wait",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    const memory = defineCommand(endpoints, {
        name: "memory",
        description: "read and change one running Client's memory"
    })

    defineCommand<MemoryOptions & { key: string }>(memory, {
        name: "get",
        description: executeDescription("endpoint", "memoryGet"),
        requiresSystem: true,
        options: withJson(...processOptions, option("--key <key>", "Memory key", { mandatory: true })),
        output: dataOutput(value.any("JSON value or null"), "The Client memory value", valuePresentation)
    }, ({ options }) => executeMemory(connect, options, "memoryGet", { key: options.key }))

    defineCommand<MemoryOptions & { key: string, value: string }>(memory, {
        name: "set",
        description: executeDescription("endpoint", "memorySet"),
        requiresSystem: true,
        options: withJson(...processOptions, option("--key <key>", "Memory key", { mandatory: true }), option("--value <json>", "JSON value", { mandatory: true })),
        output: dataOutput(value.any("Stored JSON value"), "The stored value", valuePresentation)
    }, ({ options }) => executeMemory(connect, options, "memorySet", { key: options.key, value: payload(options.value) }))

    defineCommand<MemoryOptions & { key: string }>(memory, {
        name: "delete",
        description: executeDescription("endpoint", "memoryDelete"),
        requiresSystem: true,
        options: withJson(...processOptions, option("--key <key>", "Memory key", { mandatory: true })),
        output: dataOutput(value.boolean("Whether the key existed"), "Deletion result", valuePresentation)
    }, ({ options }) => executeMemory(connect, options, "memoryDelete", { key: options.key }))

    defineCommand<MemoryOptions>(memory, {
        name: "entries",
        description: executeDescription("endpoint", "memoryEntries"),
        requiresSystem: true,
        options: withJson(...processOptions),
        output: dataOutput(value.any("Key-value entries"), "The Client memory entries", valuePresentation)
    }, ({ options }) => executeMemory(connect, options, "memoryEntries"))
}

async function executeEndpoint(
    connect: ConnectSystem,
    options: EndpointOptions,
    operation: Readonly<Record<string, unknown> & { $operation: string }>
) {
    const request = parseExecuteRequest({
        $domain: "endpoint",
        ...operation,
        process: options.process,
        ...(options.program ? { program: options.program } : {}),
        endpoint: options.endpoint
    })
    return connected(connect, system => system.execute(request))
}

function timeout(value?: number) {
    return value === undefined ? undefined : bounded(value, "--timeout", 1)
}

async function executeMemory(connect: ConnectSystem, options: MemoryOptions, operation: "memoryGet" | "memorySet" | "memoryDelete" | "memoryEntries", fields: Record<string, unknown> = {}) {
    const request = parseExecuteRequest({ $domain: "endpoint", $operation: operation, process: options.process, ...(options.program ? { program: options.program } : {}), ...fields })
    return connected(connect, system => system.execute(request))
}

type EndpointOptions = CommonOptions & ProcessCoordinates & Readonly<{ endpoint: EndpointName }>
type MemoryOptions = CommonOptions & ProcessCoordinates
type EventOptions = Readonly<{ event: string, payload?: string }>
type LifecycleOptions = Readonly<{ event: "start" | "stop" }>
type TimeoutOptions = Readonly<{ timeout?: number }>
