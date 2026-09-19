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
    const program = process.program()
    const [server, client] = await Promise.all([
        program.server === null
            ? Promise.resolve({ running: false, service: false })
            : Promise.all([process.server.running(), process.server.isService()]).then(([running, service]) => ({ running, service })),
        program.client === null
            ? Promise.resolve({ running: false, service: false })
            : Promise.all([process.client.running(), process.client.isService()]).then(([running, service]) => ({ running, service }))
    ])

    return {
        identity: process.identity,
        name: process.name,
        program: program.identity,
        startedAt: process.startedAt.toISOString(),
        server: { declared: program.server !== null, ...server },
        client: { declared: program.client !== null, ...client }
    }
}

export async function endpointView(process: Process, name: EndpointName) {
    const program = process.program()

    return {
        process: process.identity,
        program: program.identity,
        endpoint: name,
        declared: name === "server" ? program.server !== null : program.client !== null,
        running: await endpoint(process, name).running(),
        service: await endpoint(process, name).isService()
    }
}

export async function windowView(process: Process) {
    const window = process.client.window
    const [title, header, position, size, minimized, maximized, front, layer] = await Promise.all([
        window.title(),
        window.header(),
        window.position(),
        window.size(),
        window.minimized(),
        window.maximized(),
        window.front(),
        window.layer()
    ])

    return { process: process.identity, title, header, position, size, minimized, maximized, front, layer }
}
