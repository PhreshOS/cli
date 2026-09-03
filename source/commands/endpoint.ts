import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import {
    clientOverrideOptions,
    endpointOptions,
    option,
    serverOverrideOptions,
    timeoutOption,
    withJson
} from "./options.ts"
import { endpointOutput, eventOutput, jsonOutput } from "./schemas.ts"
import { connected, requireProcess, type ConnectSystem } from "./connection.ts"
import { bounded, clientLaunch, payload, serverLaunch, type ClientOptions, type CommonOptions, type ProcessCoordinates, type ServerOptions } from "./input.ts"
import { wait } from "./observation.ts"
import { endpoint, endpointView, type EndpointName } from "./projection.ts"

export default function endpointCommands(root: Command, connect: ConnectSystem) {
    const endpoints = defineCommand(root, {
        name: "endpoint",
        description: "inspect, control, and communicate with Process Endpoints",
        guidance: ["Select the exact Process and either its server or client Endpoint."]
    })

    defineCommand<EndpointOptions>(endpoints, {
        name: "inspect",
        description: "read whether one Endpoint is declared and running",
        requiresSystem: true,
        options: withJson(...endpointOptions),
        output: jsonOutput(endpointOutput, "The selected Endpoint"),
        examples: ["phresh endpoint inspect --process main --program terminal --endpoint server"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        return await endpointView(process, name)
    }))

    defineCommand<EndpointOptions & ClientOptions & ServerOptions>(endpoints, {
        name: "start",
        description: "start a fresh Endpoint incarnation",
        requiresSystem: true,
        options: withJson(...endpointOptions, ...clientOverrideOptions, ...serverOverrideOptions),
        output: jsonOutput(endpointOutput, "The started Endpoint"),
        examples: ["phresh endpoint start --process main --program terminal --endpoint server --server-service"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        const client = clientLaunch(options)
        const server = serverLaunch(options)
        if (name === "server" && client !== undefined) throw new Error("Client overrides require --endpoint client")
        if (name === "client" && server !== undefined) throw new Error("Server overrides require --endpoint server")
        if (name === "client") await process.client.start(typeof client === "object" ? client : undefined)
        else await process.server.start(typeof server === "object" ? server : undefined)
        return await endpointView(process, name)
    }))

    defineCommand<EndpointOptions>(endpoints, {
        name: "stop",
        description: "stop one Endpoint",
        requiresSystem: true,
        options: withJson(...endpointOptions),
        output: jsonOutput(endpointOutput, "The stopped Endpoint"),
        examples: ["phresh endpoint stop --process main --program terminal --endpoint client"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        await endpoint(process, name).stop()
        return await endpointView(process, name)
    }))

    defineCommand<EndpointOptions & TimeoutOptions>(endpoints, {
        name: "waitReady",
        aliases: ["wait-ready"],
        description: "wait until the Server Endpoint reports readiness",
        requiresSystem: true,
        options: withJson(...endpointOptions, timeoutOption),
        output: jsonOutput(endpointOutput, "The ready Server Endpoint"),
        examples: ["phresh endpoint wait-ready --process main --program terminal --endpoint server --timeout 30000"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        if (name !== "server") throw new Error("waitReady requires --endpoint server")
        await process.server.waitReady(timeout(options.timeout))
        return await endpointView(process, "server")
    }))

    defineCommand<EndpointOptions & LifecycleOptions & TimeoutOptions>(endpoints, {
        name: "waitLifecycle",
        aliases: ["wait-lifecycle"],
        description: "wait for one lifecycle transition of an exact Endpoint",
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "Endpoint lifecycle event", { mandatory: true, choices: ["start", "stop"] }),
            timeoutOption
        ),
        output: jsonOutput(value.object({
            scope: value.string("Endpoint lifecycle subscription scope"),
            event: value.enumeration(["start", "stop"], "observed lifecycle event")
        }, ["scope", "event"], "Endpoint lifecycle event"), "One Endpoint lifecycle event"),
        examples: ["phresh endpoint wait-lifecycle --process main --program terminal --endpoint server --event start"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        await wait(endpoint(process, name).lifecycle, options.event, timeout(options.timeout))
        return { scope: `endpoint:${process.identity}:${name}:lifecycle`, event: options.event }
    }))

    defineCommand<EndpointOptions & EventOptions & TimeoutOptions>(endpoints, {
        name: "ask",
        description: "ask a Server event and return its answer",
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON"),
            timeoutOption
        ),
        output: jsonOutput(value.any("answer returned by the Server event contract"), "The Server answer"),
        examples: ["phresh endpoint ask --process main --program terminal --endpoint server --event status --json"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        if (name !== "server") throw new Error("ask requires --endpoint server")
        const input = payload(options.payload)
        const answer = options.timeout === undefined
            ? await process.server.ask(options.event, input)
            : await process.server.timeout(timeout(options.timeout)!).ask(options.event, input)
        return answer
    }))

    defineCommand<EndpointOptions & EventOptions>(endpoints, {
        name: "publish",
        description: "publish one event without waiting for an answer",
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "event name", { mandatory: true }),
            option("--payload <json>", "arbitrary event payload as JSON")
        ),
        output: jsonOutput(endpointOutput, "The Endpoint after publishing"),
        examples: ["phresh endpoint publish --process main --program terminal --endpoint client --event changed --payload '{\"value\":1}'"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        endpoint(process, name).publish(options.event, payload(options.payload))
        return await endpointView(process, name)
    }))

    defineCommand<EndpointOptions & EventOptions & TimeoutOptions>(endpoints, {
        name: "wait",
        description: "wait for the next event emitted by one live Endpoint",
        requiresSystem: true,
        options: withJson(
            ...endpointOptions,
            option("--event <event>", "event name", { mandatory: true }),
            timeoutOption
        ),
        output: jsonOutput(eventOutput("The observed Endpoint event"), "One Endpoint event"),
        examples: ["phresh endpoint wait --process main --program terminal --endpoint client --event changed --json"]
    }, async ({ options }) => withEndpoint(connect, options, async (process, name) => {
        return {
            scope: `endpoint:${process.identity}:${name}`,
            event: options.event,
            payload: await wait(endpoint(process, name), options.event, timeout(options.timeout))
        }
    }))
}

async function withEndpoint<Result>(
    connect: ConnectSystem,
    options: EndpointOptions,
    action: (process: Awaited<ReturnType<typeof requireProcess>>, endpoint: EndpointName) => Promise<Result>
) {
    return await connected(connect, async system => {
        return await action(await requireProcess(system, options.process, options.program), options.endpoint)
    })
}

function timeout(value?: number) {
    return value === undefined ? undefined : bounded(value, "--timeout", 1)
}

type EndpointOptions = CommonOptions & ProcessCoordinates & Readonly<{ endpoint: EndpointName }>
type EventOptions = Readonly<{ event: string, payload?: string }>
type LifecycleOptions = Readonly<{ event: "start" | "stop" }>
type TimeoutOptions = Readonly<{ timeout?: number }>
