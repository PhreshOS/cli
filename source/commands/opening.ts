import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { bounded, type CommonOptions } from "./input.ts"
import { option, timeoutOption, withJson } from "./options.ts"
import { dataOutput, eventOutput, eventPresentation, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"

export default function openingCommands(root: Command, connect: ConnectSystem) {
    const opening = defineCommand(root, {
        name: "opening",
        description: "which Program opens each kind of file or link, and requests waiting for the owner to choose",
        guidance: [
            "A type is a media type such as image/png, or a family such as image/*. A default makes that Program open it without asking.",
            "Choosing for a waiting request decides for the owner: do it only as the owner would."
        ]
    })

    defineCommand<CommonOptions>(opening, {
        name: "defaults",
        description: executeDescription("opening", "defaults"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.any("default Program identity by type"), "The default of each type and family", valuePresentation),
        examples: ["phresh opening defaults   # which Program opens each media type"]
    }, () => connected(connect, system => system.execute({ $domain: "opening", $operation: "defaults" })))

    defineCommand<TypeOptions & Readonly<{ program: string }>>(opening, {
        name: "setDefault",
        aliases: ["set-default"],
        description: executeDescription("opening", "setDefault"),
        requiresSystem: true,
        options: withJson(
            option("--type <type>", "exact media type, or a family such as image/*", { mandatory: true }),
            option("--program <identity>", "Program identity", { mandatory: true })
        ),
        output: dataOutput(value.nullable(value.any("nothing")), "The default is set", valuePresentation),
        examples: ["phresh opening set-default --type 'image/*' --program preview   # preview opens every image"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "opening", $operation: "setDefault", type: options.type, program: options.program })))

    defineCommand<TypeOptions>(opening, {
        name: "clearDefault",
        aliases: ["clear-default"],
        description: executeDescription("opening", "clearDefault"),
        requiresSystem: true,
        options: withJson(option("--type <type>", "exact media type, or a family such as image/*", { mandatory: true })),
        output: dataOutput(value.nullable(value.any("nothing")), "The default is removed", valuePresentation),
        examples: ["phresh opening clear-default --type image/png   # PNG images have no default again"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "opening", $operation: "clearDefault", type: options.type })))

    defineCommand<CommonOptions>(opening, {
        name: "requests",
        description: executeDescription("opening", "requests"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.array(value.any("open request"), "open requests"), "Open requests waiting for a choice", valuePresentation),
        examples: ["phresh opening requests --json   # open requests waiting for the owner to choose"]
    }, () => connected(connect, system => system.execute({ $domain: "opening", $operation: "requests" })))

    defineCommand<RequestOptions & Readonly<{ program: string, always?: boolean }>>(opening, {
        name: "choose",
        description: executeDescription("opening", "choose"),
        requiresSystem: true,
        options: withJson(
            option("--request <identity>", "open request identity", { mandatory: true }),
            option("--program <identity>", "Program identity", { mandatory: true }),
            option("--always", "also make it the default for this type")
        ),
        output: dataOutput(value.nullable(value.any("nothing")), "It was opened", valuePresentation),
        examples: ["phresh opening choose --request <identity> --program preview   # opens it with preview; add --always to make preview the default"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "opening", $operation: "choose", request: options.request, program: options.program,
        ...(options.always ? { always: true } : {})
    })))

    defineCommand<RequestOptions>(opening, {
        name: "cancel",
        description: executeDescription("opening", "cancel"),
        requiresSystem: true,
        options: withJson(option("--request <identity>", "open request identity", { mandatory: true })),
        output: dataOutput(value.nullable(value.any("nothing")), "The request ended", valuePresentation),
        examples: ["phresh opening cancel --request <identity>   # opens nothing"]
    }, ({ options }) => connected(connect, system => system.execute({ $domain: "opening", $operation: "cancel", request: options.request })))

    defineCommand<WaitOptions>(opening, {
        name: "wait",
        description: executeDescription("opening", "wait"),
        requiresSystem: true,
        options: withJson(option("--event <event>", "Opening event", { mandatory: true, choices: ["openRequest", "openResolve", "changeDefault"] }), timeoutOption),
        output: dataOutput(eventOutput("The observed Opening event"), "One Opening event", eventPresentation),
        examples: ["phresh opening wait --event openRequest   # waits until something asks to be opened"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "opening", $operation: "wait", event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type TypeOptions = CommonOptions & Readonly<{ type: string }>
type RequestOptions = CommonOptions & Readonly<{ request: string }>
type WaitOptions = CommonOptions & Readonly<{ event: "openRequest" | "openResolve" | "changeDefault", timeout?: number }>
