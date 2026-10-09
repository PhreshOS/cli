import type { OptionContract } from "../contract/command.ts"
import { layers } from "@phreshos/core"
import { collect, integer } from "./input.ts"

export const jsonOption = option("--json", "write the complete result as JSON on one line, for scripts and agents; left out, a short readable summary")

export const processOptions = Object.freeze([
    option("--process <identity>", "the Process: its identity, or its name within the Program (a name needs --program)", { mandatory: true }),
    option("--program <identity>", "the Program the named Process belongs to; needed only when --process is a name")
])

export const endpointOptions = Object.freeze([
    ...processOptions,
    option("--endpoint <endpoint>", "which side of the Process: server (on this machine) or client (its Window)", { mandatory: true, choices: ["server", "client"] })
])

export const clientOverrideOptions = Object.freeze([
    option("--client-service", "offer this Client as a Service; left out, as the Program declares"),
    option("--no-client-service", "do not offer this Client as a Service, even if the Program does"),
    option("--client-title <title>", "the Window's title; left out, as the Program declares"),
    option("--client-width <value>", "the Window's width: pixels, or a share of the view such as 1/2 or 50%; needs --client-height; left out, as the Program declares"),
    option("--client-height <value>", "the Window's height, as --client-width; needs --client-width"),
    option("--client-x <value>", "where the Window's left edge is, counted from the middle of the view (0 is the middle, not the screen's edge): pixels, or a share of the view such as -1/2 for the left edge; needs --client-y; left out, where the Desktop is looking"),
    option("--client-y <value>", "where the Window's top edge is, counted from the middle of the view, as --client-x; needs --client-x"),
    option("--client-layer <layer>", "where the Client is drawn; left out, window, as an ordinary Window (other layers need the layers permission)", { choices: layers }),
    option("--client-minimized", "open the Window minimized; left out, open"),
    option("--client-maximized", "open the Window maximized; left out, at its size")
])

export const serverOverrideOptions = Object.freeze([
    option("--server-service", "offer this Server as a Service; left out, as the Program declares"),
    option("--no-server-service", "do not offer this Server as a Service, even if the Program does")
])

export const launchOptions = Object.freeze([
    ...serverOverrideOptions,
    option("--client", "start the Client (its Window) even if the Program does not by default; left out, as the Program declares"),
    option("--no-client", "do not start the Client, even if the Program does by default"),
    ...clientOverrideOptions,
    option("--name <name>", "a name for this run, unique within its Program, to find it again later; left out, the Program's own default name, if any"),
    option("--replace", "with --name: end the running Process of that name and start this one in its place; left out, a taken name fails"),
    option("--server", "start the Server even if the Program does not by default; left out, as the Program declares"),
    option("--no-server", "do not start the Server, even if the Program does by default"),
    option("--option <name=value>", "a value the Process is started with, such as document=notes.md; repeat for more; left out, none beyond the Program's own", {
        default: [],
        repeatable: true,
        parse: (value, previous) => collect(value, Array.isArray(previous) ? previous as string[] : [])
    })
])

export const namedLaunchOptions = Object.freeze(launchOptions.map(current => current.flags === "--name <name>"
    ? Object.freeze({ ...current, mandatory: true })
    : current))

export const timeoutOption = option("--timeout <milliseconds>", "how long to wait before failing; left out, 10 seconds", {
    parse: value => integer(value)
})

export function withJson(...options: readonly OptionContract[]) {
    return Object.freeze([...options, jsonOption])
}

export function option(flags: string, description: string, values: Omit<OptionContract, "flags" | "description"> = {}): OptionContract {
    return Object.freeze({ flags, description, ...values })
}
