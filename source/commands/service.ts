import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { dataOutput, eventOutput, eventPresentation, lifecyclePresentation, serviceListPresentation, serviceOutput, servicePresentation, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./connection.ts"
import { bounded, payload, type CommonOptions } from "./input.ts"
import { executeDescription } from "./execution.ts"
import { option, timeoutOption, withJson } from "./options.ts"

const addressOptions = [
    option("--program <identity>", "owning Program identity", { mandatory: true }),
    option("--process <name>", "Process and Service name", { mandatory: true }),
    option("--endpoint <endpoint>", "Endpoint kind", { mandatory: true, choices: ["server", "client"] })
] as const

const availabilityEvents = ["available", "unavailable"] as const

export default function serviceCommands(root: Command, connect: ConnectSystem) {
    const services = defineCommand(root, {
        name: "service",
        description: "discover and communicate with named Endpoint Services",
        guidance: ["Discovery returns ready Services; exact addresses remain stable while their providers are unavailable."]
    })

    defineCommand<CommonOptions>(services, {
        name: "list",
        description: executeDescription("service", "list"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.array(serviceOutput, "ready Services"), "Visible Services", serviceListPresentation),
        examples: ["phresh service list"]
    }, async () => executeService(connect, { $operation: "list" }))

    defineCommand<CommonOptions & { name: string }>(services, {
        name: "search",
        description: executeDescription("service", "search"),
        requiresSystem: true,
        options: withJson(option("--name <name>", "Process and Service name", { mandatory: true })),
        output: dataOutput(value.array(serviceOutput, "matching ready Services"), "Matching Services", serviceListPresentation),
        examples: ["phresh service search --name ssh"]
    }, async ({ options }) => executeService(connect, { $operation: "search", name: options.name }))

    defineCommand<ServiceOptions>(services, {
        name: "inspect",
        description: executeDescription("service", "inspect"),
        requiresSystem: true,
        options: withJson(...addressOptions),
        output: dataOutput(serviceOutput, "The selected Service", servicePresentation),
        examples: ["phresh service inspect --program terminal --process ssh --endpoint server"]
    }, async ({ options }) => executeAddressedService(connect, options, { $operation: "inspect" }))

    defineCommand<ServiceOptions & TimeoutOptions>(services, {
        name: "waitReady",
        aliases: ["wait-ready"],
        description: executeDescription("service", "waitReady"),
        requiresSystem: true,
        options: withJson(...addressOptions, timeoutOption),
        output: dataOutput(serviceOutput, "The ready Service", servicePresentation),
        examples: ["phresh service wait-ready --program terminal --process ssh --endpoint server"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "waitReady",
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<ServiceOptions & EventOptions & TimeoutOptions>(services, {
        name: "ask",
        description: executeDescription("service", "ask"),
        requiresSystem: true,
        options: withJson(
            option("--program <identity>", "owning Program identity", { mandatory: true }),
            option("--process <name>", "Process and Service name", { mandatory: true }),
            option("--endpoint <endpoint>", "Endpoint kind", { mandatory: true, choices: ["server"] }),
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON"),
            timeoutOption
        ),
        output: dataOutput(value.any("answer returned by the Server Service contract"), "The Service answer", valuePresentation),
        examples: ["phresh service ask --program tilo --process board --endpoint server --event board.list --json"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "ask",
        event: options.event,
        ...(options.payload === undefined ? {} : { input: payload(options.payload) }),
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<ServiceOptions & EventOptions>(services, {
        name: "publish",
        description: executeDescription("service", "publish"),
        requiresSystem: true,
        options: withJson(
            ...addressOptions,
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON")
        ),
        output: dataOutput(serviceOutput, "The addressed Service", servicePresentation),
        examples: ["phresh service publish --program tilo --process board --endpoint client --event changed"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "publish",
        event: options.event,
        ...(options.payload === undefined ? {} : { input: payload(options.payload) })
    }))

    defineCommand<ServiceOptions & EventOptions & TimeoutOptions>(services, {
        name: "wait",
        description: executeDescription("service", "wait"),
        requiresSystem: true,
        options: withJson(...addressOptions, option("--event <event>", "event name", { mandatory: true }), timeoutOption),
        output: dataOutput(eventOutput("The observed Service event"), "One Service event", eventPresentation),
        examples: ["phresh service wait --program tilo --process board --endpoint client --event changed"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "wait",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<ServiceOptions & AvailabilityOptions & TimeoutOptions>(services, {
        name: "waitLifecycle",
        aliases: ["wait-lifecycle"],
        description: executeDescription("service", "waitLifecycle"),
        requiresSystem: true,
        options: withJson(...addressOptions, option("--event <event>", "availability event", { mandatory: true, choices: availabilityEvents }), timeoutOption),
        output: dataOutput(eventOutput("The observed Service availability event"), "One Service lifecycle event", lifecyclePresentation),
        examples: ["phresh service wait-lifecycle --program tilo --process board --endpoint server --event available"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "waitLifecycle",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<CommonOptions & AvailabilityOptions & TimeoutOptions>(services, {
        name: "waitDiscovery",
        aliases: ["wait-discovery"],
        description: executeDescription("service", "waitDiscovery"),
        requiresSystem: true,
        options: withJson(option("--event <event>", "discovery event", { mandatory: true, choices: availabilityEvents }), timeoutOption),
        output: dataOutput(eventOutput("The observed Service discovery event"), "One Service discovery event", lifecyclePresentation),
        examples: ["phresh service wait-discovery --event available"]
    }, async ({ options }) => executeService(connect, {
        $operation: "waitDiscovery",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))
}

function executeAddressedService(connect: ConnectSystem, options: ServiceOptions, operation: Record<string, unknown> & { $operation: string }) {
    return executeService(connect, {
        ...operation,
        program: options.program,
        process: options.process,
        endpoint: options.endpoint
    })
}

function executeService(connect: ConnectSystem, operation: Record<string, unknown> & { $operation: string }) {
    const request = parseExecuteRequest({ $domain: "service", ...operation })
    return connected(connect, system => system.execute(request))
}

function timeout(value?: number) { return value === undefined ? undefined : bounded(value, "--timeout", 1) }

type ServiceOptions = CommonOptions & Readonly<{ program: string, process: string, endpoint: "server" | "client" }>
type EventOptions = Readonly<{ event: string, payload?: string }>
type AvailabilityOptions = Readonly<{ event: "available" | "unavailable" }>
type TimeoutOptions = Readonly<{ timeout?: number }>
