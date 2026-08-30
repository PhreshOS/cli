import { Option, type Command } from "commander"
import { collect } from "./shared.ts"

export function outputOptions(command: Command) {
    return command.option("--compact", "write machine-readable JSON on one line")
}

export function processOptions(command: Command) {
    return command
        .requiredOption("--process <identity>", "Process identity or Program-local name")
        .option("--program <identity>", "owning Program identity when resolving a Process name")
}

export function endpointOptions(command: Command) {
    return processOptions(command)
        .addOption(new Option("--endpoint <endpoint>", "Endpoint kind").choices(["server", "client"]).makeOptionMandatory())
}

export function clientOptions(command: Command) {
    return clientOverrideOptions(command)
        .option("--client", "start the Client Endpoint")
        .option("--no-client", "do not start the Client Endpoint")
}

export function clientOverrideOptions(command: Command) {
    return command
        .option("--client-title <title>", "initial Window title")
        .option("--client-width <value>", "initial Window width")
        .option("--client-height <value>", "initial Window height")
        .option("--client-x <value>", "initial Window horizontal position")
        .option("--client-y <value>", "initial Window vertical position")
        .addOption(new Option("--client-layer <layer>", "initial Window layer").choices(["window", "under", "over"]))
        .option("--client-location <location>", "initial page beneath the Client location")
        .option("--client-minimized", "open the Window minimized")
}

export function launchOptions(command: Command) {
    return clientOptions(command)
        .option("--name <name>", "stable Program-local Process name")
        .option("--server", "start the Server Endpoint")
        .option("--no-server", "do not start the Server Endpoint")
        .option("--option <name=value>", "immutable Process option; repeat for more values", collect, [])
}
