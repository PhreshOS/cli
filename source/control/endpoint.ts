import { Option, type Command } from "commander"
import { commandContract } from "../command-contract.ts"
import { clientOverrideOptions, endpointOptions, outputOptions, serverOverrideOptions } from "./options.ts"
import {
    bounded,
    clientLaunch,
    connected,
    endpoint,
    endpointView,
    integer,
    output,
    payload,
    requireProcess,
    serverLaunch,
    wait,
    type ClientOptions,
    type CommonOptions,
    type ConnectSystem,
    type EndpointName,
    type ProcessCoordinates,
    type ServerOptions
} from "./shared.ts"

export default function endpointCommands(root: Command, connect: ConnectSystem) {
    const endpoints = commandContract(root.command("endpoint")
        .description("inspect, control, and communicate with Process Endpoints"))

    outputOptions(endpointOptions(endpoints.command("inspect")
        .description("read whether one Endpoint is declared and running")))
        .action(async (options: EndpointOptions) => withEndpoint(connect, options, async (process, name) => {
            output(await endpointView(process, name), options.compact)
        }))

    outputOptions(serverOverrideOptions(clientOverrideOptions(endpointOptions(endpoints.command("start")
        .description("start a fresh Endpoint incarnation")))))
        .action(async (options: EndpointOptions & ClientOptions & ServerOptions) => withEndpoint(connect, options, async (process, name) => {
            const client = clientLaunch(options)
            const server = serverLaunch(options)
            if (name === "server" && client !== undefined) throw new Error("Client overrides require --endpoint client")
            if (name === "client" && server !== undefined) throw new Error("Server overrides require --endpoint server")
            if (name === "client") await process.client.start(typeof client === "object" ? client : undefined)
            else await process.server.start(typeof server === "object" ? server : undefined)
            output(await endpointView(process, name), options.compact)
        }))

    outputOptions(endpointOptions(endpoints.command("stop")
        .description("stop one Endpoint")))
        .action(async (options: EndpointOptions) => withEndpoint(connect, options, async (process, name) => {
            await endpoint(process, name).stop()
            output(await endpointView(process, name), options.compact)
        }))

    outputOptions(endpointOptions(endpoints.command("waitReady")
        .alias("wait-ready")
        .description("wait until the Server Endpoint reports readiness")
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer)))
        .action(async (options: EndpointOptions & TimeoutOptions) => withEndpoint(connect, options, async (process, name) => {
            if (name !== "server") throw new Error("waitReady requires --endpoint server")
            await process.server.waitReady(timeout(options.timeout))
            output(await endpointView(process, "server"), options.compact)
        }))

    outputOptions(endpointOptions(endpoints.command("waitLifecycle")
        .alias("wait-lifecycle")
        .description("wait for one lifecycle transition of an exact Endpoint")
        .addOption(new Option("--event <event>", "Endpoint lifecycle event")
            .choices(["start", "stop"])
            .makeOptionMandatory())
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer)))
        .action(async (options: EndpointOptions & LifecycleOptions & TimeoutOptions) => withEndpoint(connect, options, async (process, name) => {
            await wait(endpoint(process, name).lifecycle, options.event, timeout(options.timeout))
            output({
                scope: `endpoint:${process.identity}:${name}:lifecycle`,
                event: options.event
            }, options.compact)
        }))

    outputOptions(endpointOptions(endpoints.command("ask")
        .description("ask a Server event and return its answer")
        .requiredOption("--event <event>", "event name")
        .option("--payload <json>", "arbitrary event payload as JSON")
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer)))
        .action(async (options: EndpointOptions & EventOptions & TimeoutOptions) => withEndpoint(connect, options, async (process, name) => {
            if (name !== "server") throw new Error("ask requires --endpoint server")
            const value = payload(options.payload)
            const answer = options.timeout === undefined
                ? await process.server.ask(options.event, value)
                : await process.server.timeout(timeout(options.timeout)!).ask(options.event, value)
            output(answer, options.compact)
        }))

    outputOptions(endpointOptions(endpoints.command("publish")
        .description("publish one event without waiting for an answer")
        .requiredOption("--event <event>", "event name")
        .option("--payload <json>", "arbitrary event payload as JSON")))
        .action(async (options: EndpointOptions & EventOptions) => withEndpoint(connect, options, async (process, name) => {
            endpoint(process, name).publish(options.event, payload(options.payload))
            output(await endpointView(process, name), options.compact)
        }))

    outputOptions(endpointOptions(endpoints.command("wait")
        .description("wait for the next event emitted by one live Endpoint")
        .requiredOption("--event <event>", "event name")
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer)))
        .action(async (options: EndpointOptions & EventOptions & TimeoutOptions) => withEndpoint(connect, options, async (process, name) => {
            output({
                scope: `endpoint:${process.identity}:${name}`,
                event: options.event,
                payload: await wait(endpoint(process, name), options.event, timeout(options.timeout))
            }, options.compact)
        }))
}

async function withEndpoint(
    connect: ConnectSystem,
    options: EndpointOptions,
    action: (process: Awaited<ReturnType<typeof requireProcess>>, endpoint: EndpointName) => Promise<void>
) {
    await connected(connect, async system => {
        await action(await requireProcess(system, options.process, options.program), options.endpoint)
    })
}

function timeout(value?: number) {
    return value === undefined ? undefined : bounded(value, "--timeout", 1)
}

type EndpointOptions = CommonOptions & ProcessCoordinates & Readonly<{ endpoint: EndpointName }>
type EventOptions = Readonly<{ event: string, payload?: string }>
type LifecycleOptions = Readonly<{ event: "start" | "stop" }>
type TimeoutOptions = Readonly<{ timeout?: number }>
