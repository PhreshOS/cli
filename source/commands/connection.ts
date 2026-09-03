import type { System as SystemContract } from "@phreshos/core"
import { System } from "@phreshos/node"

export type ConnectedSystem = SystemContract & Readonly<{ disconnect(): Promise<void> }>
export type ConnectSystem = () => Promise<ConnectedSystem>

export const connectSystem: ConnectSystem = () => System.connect()

/** Give one command exclusive ownership of one Node SDK System connection. */
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
