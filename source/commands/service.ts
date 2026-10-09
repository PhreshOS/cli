import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { dataOutput, eventOutput, eventPresentation, lifecyclePresentation, pageOutput, serviceListPresentation, serviceOutput, servicePresentation, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { bounded, integer, page, payload, type CommonOptions } from "./input.ts"
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
        description: "find the Services Programs offer, and talk to them",
        guidance: [
            "A Service is one side of a named run, offered for others to talk to. Its address is the Program, the run's name (--process), and the side (--endpoint).",
            "service list shows the Services ready now. An address stays the same while its run restarts, so you can wait for it to come back.",
            "A Program's agent documentation (phresh program agent --program <identity>) says which Services it offers and what they answer."
        ]
    })

    defineCommand<CommonOptions & { name?: string, limit: number, offset: number }>(services, {
        name: "list",
        description: executeDescription("service", "list"),
        requiresSystem: true,
        options: withJson(
            option("--name <name>", "only Services with this name; left out, every one"),
            option("--limit <count>", "maximum returned Services", { parse: value => integer(value), default: 30 }),
            option("--offset <count>", "number of matching Services to skip", { parse: value => integer(value), default: 0 })
        ),
        output: dataOutput(pageOutput(serviceOutput, "ready Services"), "A bounded page of Services", serviceListPresentation),
        examples: ["phresh service list   # every Service ready now", "phresh service list --name ssh   # only Services named ssh"]
    }, ({ options }) => connected(connect, async system => {
        const values = await system.execute({ $domain: "service", $operation: "list", ...(options.name === undefined ? {} : { name: options.name }) })
        return page(values, undefined, bounded(options.offset, "--offset", 0), bounded(options.limit, "--limit", 1, 100), value => value.process)
    }))

    defineCommand<ServiceOptions>(services, {
        name: "inspect",
        description: executeDescription("service", "inspect"),
        requiresSystem: true,
        options: withJson(...addressOptions),
        output: dataOutput(serviceOutput, "The selected Service", servicePresentation),
        examples: ["phresh service inspect --program terminal --process ssh --endpoint server   # whether that Service is available now"]
    }, async ({ options }) => executeAddressedService(connect, options, { $operation: "inspect" }))

    defineCommand<ServiceOptions & TimeoutOptions>(services, {
        name: "waitReady",
        aliases: ["wait-ready"],
        description: executeDescription("service", "waitReady"),
        requiresSystem: true,
        options: withJson(...addressOptions, timeoutOption),
        output: dataOutput(serviceOutput, "The ready Service", servicePresentation),
        examples: ["phresh service wait-ready --program terminal --process ssh --endpoint server   # waits until it is"]
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
        examples: ["phresh service ask --program tilo --process board --endpoint server --event board.list --json   # asks the board Service of Tilo a question"]
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
        examples: ["phresh service publish --program tilo --process board --endpoint client --event changed   # tells it something, without an answer"]
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
        examples: ["phresh service wait --program tilo --process board --endpoint client --event changed   # waits until it publishes changed"]
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
        examples: ["phresh service wait-lifecycle --program tilo --process board --endpoint server --event available   # waits until it becomes available"]
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
        examples: ["phresh service wait-discovery --event available   # waits until any Service becomes available"]
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
