import type { Command } from "commander"
import endpointCommands from "./endpoint.ts"
import processCommands from "./process.ts"
import programCommands from "./program.ts"
import { connectSystem, type ConnectSystem } from "./connection.ts"
import windowCommands from "./window.ts"

/** Expose the shared System domains through explicit Node SDK executors. */
export default function accessCommands(program: Command, connect: ConnectSystem = connectSystem) {
    programCommands(program, connect)
    processCommands(program, connect)
    endpointCommands(program, connect)
    windowCommands(program, connect)
}
