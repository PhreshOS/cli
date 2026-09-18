import type { Command } from "commander"
import endpointCommands from "./endpoint.ts"
import processCommands from "./process.ts"
import programCommands from "./program.ts"
import { connectSystem, type ConnectSystem } from "./connection.ts"
import windowCommands from "./window.ts"
import executeCommand from "./execute.ts"
import operationCommands from "./operation.ts"

/** Expose the shared System domains through explicit Node SDK executors. */
export default function accessCommands(program: Command, connect: ConnectSystem = connectSystem) {
    executeCommand(program, connect)
    operationCommands(program, connect)
    programCommands(program, connect)
    processCommands(program, connect)
    endpointCommands(program, connect)
    windowCommands(program, connect)
}
