import type { OptionContract } from "../contract/command.ts"
import { collect, integer } from "./input.ts"

export const jsonOption = option("--json", "write the result as machine-readable JSON on one line")

export const processOptions = Object.freeze([
    option("--process <identity>", "Process identity or Program-local name", { mandatory: true }),
    option("--program <identity>", "owning Program identity when resolving a Process name")
])

export const endpointOptions = Object.freeze([
    ...processOptions,
    option("--endpoint <endpoint>", "Endpoint kind", { mandatory: true, choices: ["server", "client"] })
])

export const clientOverrideOptions = Object.freeze([
    option("--client-service", "address this Client incarnation through system.service()"),
    option("--no-client-service", "do not address this Client incarnation through system.service()"),
    option("--client-title <title>", "initial Window title"),
    option("--client-width <value>", "initial Window width"),
    option("--client-height <value>", "initial Window height"),
    option("--client-x <value>", "initial Window horizontal position"),
    option("--client-y <value>", "initial Window vertical position"),
    option("--client-layer <layer>", "initial Window layer", { choices: ["window", "under", "over"] }),
    option("--client-location <location>", "initial page beneath the Client location"),
    option("--client-minimized", "open the Window minimized")
])

export const serverOverrideOptions = Object.freeze([
    option("--server-service", "address this Server incarnation through system.service()"),
    option("--no-server-service", "do not address this Server incarnation through system.service()")
])

export const launchOptions = Object.freeze([
    ...serverOverrideOptions,
    option("--client", "start the Client Endpoint"),
    option("--no-client", "do not start the Client Endpoint"),
    ...clientOverrideOptions,
    option("--name <name>", "stable Program-local Process name"),
    option("--server", "start the Server Endpoint"),
    option("--no-server", "do not start the Server Endpoint"),
    option("--option <name=value>", "immutable Process option; repeat for more values", {
        default: [],
        repeatable: true,
        parse: (value, previous) => collect(value, Array.isArray(previous) ? previous as string[] : [])
    })
])

export const namedLaunchOptions = Object.freeze(launchOptions.map(current => current.flags === "--name <name>"
    ? Object.freeze({ ...current, mandatory: true })
    : current))

export const timeoutOption = option("--timeout <milliseconds>", "maximum wait in milliseconds", {
    parse: value => integer(value)
})

export function withJson(...options: readonly OptionContract[]) {
    return Object.freeze([...options, jsonOption])
}

export function option(flags: string, description: string, values: Omit<OptionContract, "flags" | "description"> = {}): OptionContract {
    return Object.freeze({ flags, description, ...values })
}
