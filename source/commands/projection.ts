import type { ClientEndpoint, Process, Program, ServerEndpoint, Window } from "@phreshos/core"

export type Endpoint = ServerEndpoint | ClientEndpoint
export type EndpointName = "server" | "client"

export function endpoint(process: Process, name: EndpointName): Endpoint {
    return name === "server" ? process.server : process.client
}

export function windowOf(process: Process): Window {
    return process.client.window
}

export async function programView(program: Program) {
    return {
        identity: program.identity,
        assetId: program.assetId,
        name: program.name,
        version: program.version,
        description: program.description,
        installed: await program.installed(),
        hasAgent: program.hasAgent,
        server: program.server,
        client: program.client
    }
}

export async function processView(process: Process) {
    const [server, client, serverService, clientService] = await Promise.all([
        process.server.exists(),
        process.client.exists(),
        process.server.isService(),
        process.client.isService()
    ])

    return {
        identity: process.identity,
        name: process.name,
        program: process.program().identity,
        startedAt: process.startedAt.toISOString(),
        server: { declared: process.program().server !== null, running: server, service: serverService },
        client: { declared: process.program().client !== null, running: client, service: clientService }
    }
}

export async function endpointView(process: Process, name: EndpointName) {
    const program = process.program()

    return {
        process: process.identity,
        program: program.identity,
        endpoint: name,
        declared: name === "server" ? program.server !== null : program.client !== null,
        running: await endpoint(process, name).exists(),
        service: await endpoint(process, name).isService()
    }
}

export async function windowView(process: Process) {
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
