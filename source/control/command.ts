import type { Command } from "commander"
import endpointCommands from "./endpoint.ts"
import processCommands from "./process.ts"
import programCommands from "./program.ts"
import { connectSystem, type ConnectSystem } from "./shared.ts"
import windowCommands from "./window.ts"

/** Expose the shared System handles as explicit CLI commands. */
export default function controlCommands(program: Command, connect: ConnectSystem = connectSystem) {
    programCommands(program, connect)
    processCommands(program, connect)
    endpointCommands(program, connect)
    windowCommands(program, connect)
}
