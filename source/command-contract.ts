import type { Command } from "commander"

const contracts = new WeakMap<Command, CommandContract>()

/** Attach machine-readable policy to the same Commander node that owns syntax. */
export function commandContract(command: Command, contract: CommandContract = {}) {

    contracts.set(command, Object.freeze({
        ...contract,
        ...(contract.guidance ? { guidance: Object.freeze([...contract.guidance]) } : {})
    }))

    return command
}

export function readCommandContract(command: Command) {

    return contracts.get(command)
}

export interface CommandContract {

    guidance?: readonly string[]
}
