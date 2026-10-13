import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { dataOutput, eventOutput, eventPresentation, lifecyclePresentation, serviceOutput, servicePresentation, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { bounded, payload, type CommonOptions } from "./input.ts"
import { executeDescription } from "./execution.ts"
import { option, timeoutOption, withJson } from "./options.ts"

const addressOptions = [
    option("--name <name>", "the Service name, such as file-picker-v1", { mandatory: true }),
    option("--endpoint <endpoint>", "the kind of Endpoint that must hold it; left out, either", { choices: ["server", "client"] })
] as const

const availabilityEvents = ["available", "unavailable"] as const

export default function serviceCommands(root: Command, connect: ConnectSystem) {
    const services = defineCommand(root, {
        name: "service",
        description: "talk to the Services Programs offer, by their names",
        guidance: [
            "A Service is reached by its name (--name), public across the System and held by one Endpoint at a time. Who provides it stays out of sight; the same name reaches its next holder.",
            "Which runs hold a Service shows in the Process list (phresh process list): each side carries the Service name it holds.",
            "A Program's agent documentation (phresh program agent --program <identity>) says which Services it offers and what they answer."
        ]
    })

    defineCommand<ServiceOptions>(services, {
        name: "inspect",
        description: executeDescription("service", "inspect"),
        requiresSystem: true,
        options: withJson(...addressOptions),
        output: dataOutput(serviceOutput, "The selected Service", servicePresentation),
        examples: ["phresh service inspect --name file-picker-v1   # whether that Service is available now"]
    }, async ({ options }) => executeAddressedService(connect, options, { $operation: "inspect" }))

    defineCommand<ServiceOptions & TimeoutOptions>(services, {
        name: "waitReady",
        aliases: ["wait-ready"],
        description: executeDescription("service", "waitReady"),
        requiresSystem: true,
        options: withJson(...addressOptions, timeoutOption),
        output: dataOutput(serviceOutput, "The ready Service", servicePresentation),
        examples: ["phresh service wait-ready --name file-picker-v1   # waits until it is"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "waitReady",
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))

    defineCommand<ServiceOptions & EventOptions & TimeoutOptions>(services, {
        name: "ask",
        description: executeDescription("service", "ask"),
        requiresSystem: true,
        options: withJson(
            option("--name <name>", "the Service name, such as file-picker-v1; a Server answers", { mandatory: true }),
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON"),
            timeoutOption
        ),
        output: dataOutput(value.any("answer returned by the Server Service contract"), "The Service answer", valuePresentation),
        examples: ["phresh service ask --name file-picker-v1 --event open --payload '{}' --timeout 600000 --json   # asks a person to choose a file, waiting up to ten minutes"]
    }, async ({ options }) => executeService(connect, {
        name: options.name,
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
        examples: ["phresh service publish --name board-canvas-v1 --event changed   # tells it something, without an answer"]
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
        examples: ["phresh service wait --name board-canvas-v1 --event changed   # waits until it publishes changed"]
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
        examples: ["phresh service wait-lifecycle --name file-picker-v1 --event available   # waits until something holds it and is ready"]
    }, async ({ options }) => executeAddressedService(connect, options, {
        $operation: "waitLifecycle",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: timeout(options.timeout) })
    }))
}

function executeAddressedService(connect: ConnectSystem, options: ServiceOptions, operation: Record<string, unknown> & { $operation: string }) {
    return executeService(connect, {
        ...operation,
        name: options.name,
        ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint })
    })
}

function executeService(connect: ConnectSystem, operation: Record<string, unknown> & { $operation: string }) {
    const request = parseExecuteRequest({ $domain: "service", ...operation })
    return connected(connect, system => system.execute(request))
}

function timeout(value?: number) { return value === undefined ? undefined : bounded(value, "--timeout", 1) }

type ServiceOptions = CommonOptions & Readonly<{ name: string, endpoint?: "server" | "client" }>
type EventOptions = Readonly<{ event: string, payload?: string }>
type AvailabilityOptions = Readonly<{ event: "available" | "unavailable" }>
type TimeoutOptions = Readonly<{ timeout?: number }>
