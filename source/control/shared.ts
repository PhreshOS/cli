import type {
    Launch,
    LaunchClient,
    Position,
    Size,
    System as SystemContract,
    SystemClientEntity,
    SystemProcessEntity,
    SystemProgramEntity,
    SystemServerEntity,
    Window
} from "@phreshos/core"
import { System } from "@phreshos/node"

export type ConnectedSystem = SystemContract & Readonly<{ disconnect(): Promise<void> }>
export type ConnectSystem = () => Promise<ConnectedSystem>
export type Endpoint = SystemServerEntity | SystemClientEntity
export type EndpointName = "server" | "client"
export type Metric = number | string

export const connectSystem: ConnectSystem = () => System.connect()

export async function connected<Result>(connect: ConnectSystem, action: (system: ConnectedSystem) => Promise<Result>) {
    const system = await connect()

    try { return await action(system) }
    finally { await system.disconnect() }
}

export async function requireProgram(system: SystemContract, identity: string) {
    const program = await system.program.find(identity)
    if (!program) throw new Error(`Unknown Program "${identity}"`)
    return program
}

export async function requireProcess(system: SystemContract, identity: string, programIdentity?: string) {
    const process = programIdentity
        ? await (await requireProgram(system, programIdentity)).process.find(identity)
        : await system.process.find(identity)

    if (!process) throw new Error(`Unknown Process "${identity}"`)
    return process
}

export function endpoint(process: SystemProcessEntity, name: EndpointName): Endpoint {
    return name === "server" ? process.server : process.client
}

export async function programView(program: SystemProgramEntity) {
    return {
        identity: program.identity,
        name: program.name,
        version: program.version,
        description: program.description,
        installed: await program.installed(),
        hasAgent: program.hasAgent,
        server: program.server,
        client: program.client
    }
}

export async function processView(process: SystemProcessEntity) {
    const [server, client] = await Promise.all([process.server.exists(), process.client.exists()])

    return {
        identity: process.identity,
        name: process.name,
        program: process.program().identity,
        startedAt: process.startedAt.toISOString(),
        server: { declared: process.program().server !== null, running: server },
        client: { declared: process.program().client !== null, running: client }
    }
}

export async function endpointView(process: SystemProcessEntity, name: EndpointName) {
    const program = process.program()

    return {
        process: process.identity,
        program: program.identity,
        endpoint: name,
        declared: name === "server" ? program.server !== null : program.client !== null,
        running: await endpoint(process, name).exists()
    }
}

export async function windowView(process: SystemProcessEntity) {
    const window = process.client.window
    const [title, position, size, minimized, front, layer, location] = await Promise.all([
        window.title(),
        window.position(),
        window.size(),
        window.minimized(),
        window.front(),
        window.layer(),
        window.location()
    ])

    return { process: process.identity, title, position, size, minimized, front, layer, location }
}

export function output(value: unknown, compact?: boolean) {
    console.log(JSON.stringify(value ?? null, null, compact ? undefined : 2))
}

export function payload(value?: string) {
    if (value === undefined) return undefined

    try { return JSON.parse(value) as unknown }
    catch { throw new Error("--payload must be valid JSON") }
}

export function metric(value: string): Metric {
    const trimmed = value.trim()
    return /^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed) ? Number(trimmed) : trimmed
}

export function integer(value: string) {
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed)) throw new Error(`Expected an integer, received "${value}"`)
    return parsed
}

export function bounded(value: number, name: string, minimum: number, maximum?: number) {
    if (value < minimum || (maximum !== undefined && value > maximum)) {
        throw new Error(`${name} must be between ${minimum} and ${maximum ?? "Infinity"}`)
    }
    return value
}

export function position(x: string, y: string): Position {
    return { x: metric(x), y: metric(y) }
}

export function size(width: string, height: string): Size {
    return { width: metric(width), height: metric(height) }
}

export function page<Value>(values: readonly Value[], search: string | undefined, offset = 0, limit = 30, text: (value: Value) => string) {
    const query = search?.trim().toLocaleLowerCase()
    const matches = query ? values.filter(value => text(value).toLocaleLowerCase().includes(query)) : [...values]

    return {
        data: matches.slice(offset, offset + limit),
        total: matches.length,
        truncated: offset + limit < matches.length
    }
}

export function launch(options: LaunchOptions, named = false): Launch {
    const client = clientLaunch(options)
    const values = entries(options.option)
    const result: {
        name?: string
        server?: boolean
        client?: boolean | LaunchClient
        options?: Readonly<Record<string, string>>
    } = {}

    if (options.name !== undefined) result.name = options.name
    if (options.server !== undefined) result.server = options.server
    if (client !== undefined) result.client = client
    if (Object.keys(values).length) result.options = values
    if (named && !result.name) throw new Error("--name is required")

    return result
}

export function clientLaunch(options: ClientOptions): boolean | LaunchClient | undefined {
    const configured = options.clientTitle !== undefined
        || options.clientWidth !== undefined
        || options.clientHeight !== undefined
        || options.clientX !== undefined
        || options.clientY !== undefined
        || options.clientLayer !== undefined
        || options.clientLocation !== undefined
        || options.clientMinimized === true

    if (!configured) return options.client
    if (options.client === false) throw new Error("Client overrides cannot be combined with --no-client")
    if ((options.clientWidth === undefined) !== (options.clientHeight === undefined)) {
        throw new Error("--client-width and --client-height must be supplied together")
    }
    if ((options.clientX === undefined) !== (options.clientY === undefined)) {
        throw new Error("--client-x and --client-y must be supplied together")
    }

    return {
        ...(options.clientTitle === undefined ? {} : { title: options.clientTitle }),
        ...(options.clientWidth === undefined ? {} : { size: size(options.clientWidth, options.clientHeight!) }),
        ...(options.clientX === undefined ? {} : { position: position(options.clientX, options.clientY!) }),
        ...(options.clientLayer === undefined ? {} : { layer: options.clientLayer }),
        ...(options.clientLocation === undefined ? {} : { location: options.clientLocation }),
        ...(options.clientMinimized === true ? { minimize: true } : {})
    }
}

export function collect(value: string, previous: string[] = []) {
    return [...previous, value]
}

function entries(values: readonly string[] = []) {
    const result: Record<string, string> = {}

    for (const value of values) {
        const boundary = value.indexOf("=")
        if (boundary < 1) throw new Error("--option must use name=value")
        result[value.slice(0, boundary)] = value.slice(boundary + 1)
    }

    return result
}

export type CommonOptions = Readonly<{ compact?: boolean }>
export type ProcessCoordinates = Readonly<{ process: string, program?: string }>
export type ClientOptions = Readonly<{
    client?: boolean
    clientTitle?: string
    clientWidth?: string
    clientHeight?: string
    clientX?: string
    clientY?: string
    clientLayer?: "window" | "under" | "over"
    clientLocation?: string
    clientMinimized?: boolean
}>
export type LaunchOptions = ClientOptions & Readonly<{
    name?: string
    server?: boolean
    option?: readonly string[]
}>

export async function wait(target: { waitFor(event: never, timeout?: number): Promise<unknown> }, event: string, timeout?: number) {
    return target.waitFor(event as never, timeout)
}

export function windowOf(process: SystemProcessEntity): Window {
    return process.client.window
}
