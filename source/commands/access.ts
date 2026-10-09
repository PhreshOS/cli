import type { Command } from "commander"
import endpointCommands from "./endpoint.ts"
import processCommands from "./process.ts"
import programCommands from "./program.ts"
import { connectSystem, type ConnectSystem } from "./system-connection.ts"
import connectionCommands from "./connection.ts"
import sessionCommands from "./session.ts"
import windowCommands from "./window.ts"
import executeCommand from "./execute.ts"
import fetchCommand from "./fetch.ts"
import operationCommands from "./operation.ts"
import serviceCommands from "./service.ts"
import systemCommands from "./system.ts"
import appearanceCommands from "./appearance.ts"
import openingCommands from "./opening.ts"
import permissionCommands from "./permission.ts"
import authenticationCommands from "./authentication.ts"

/** Expose the shared System domains through explicit Node SDK executors. */
export default function accessCommands(program: Command, connect: ConnectSystem = connectSystem) {
    executeCommand(program, connect)
    fetchCommand(program, connect)
    operationCommands(program, connect)
    programCommands(program, connect)
    processCommands(program, connect)
    endpointCommands(program, connect)
    serviceCommands(program, connect)
    systemCommands(program, connect)
    connectionCommands(program, connect)
    sessionCommands(program, connect)
    windowCommands(program, connect)
    appearanceCommands(program, connect)
    openingCommands(program, connect)
    permissionCommands(program, connect)
    authenticationCommands(program, connect)
}
