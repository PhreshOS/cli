import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { bounded, type CommonOptions } from "./input.ts"
import { option, timeoutOption, withJson } from "./options.ts"
import { dataOutput, eventOutput, eventPresentation, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"

export default function permissionCommands(root: Command, connect: ConnectSystem) {
    const permission = defineCommand(root, {
        name: "permission",
        description: "decide permission requests waiting for the owner"
    })

    defineCommand<CommonOptions>(permission, {
        name: "requests",
        description: executeDescription("permission", "requests"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.array(value.any("permission request"), "permission requests"), "Permission requests waiting for a decision", valuePresentation),
        examples: ["phresh permission requests --json"]
    }, () => connected(connect, system => system.execute({ $domain: "permission", $operation: "requests" })))

    for (const decision of ["allow", "deny", "cancel"] as const) {
        defineCommand<RequestOptions>(permission, {
            name: decision,
            description: executeDescription("permission", decision),
            requiresSystem: true,
            options: withJson(option("--request <identity>", "permission request identity", { mandatory: true })),
            output: dataOutput(value.nullable(value.any("nothing")), "The request ended", valuePresentation),
            examples: [`phresh permission ${decision} --request <identity>`]
        }, ({ options }) => connected(connect, system => system.execute({ $domain: "permission", $operation: decision, request: options.request })))
    }

    defineCommand<WaitOptions>(permission, {
        name: "wait",
        description: executeDescription("permission", "wait"),
        requiresSystem: true,
        options: withJson(option("--event <event>", "Permission event", { mandatory: true, choices: ["permissionRequest", "permissionResolve"] }), timeoutOption),
        output: dataOutput(eventOutput("The observed Permission event"), "One Permission event", eventPresentation),
        examples: ["phresh permission wait --event permissionRequest"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "permission", $operation: "wait", event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type RequestOptions = CommonOptions & Readonly<{ request: string }>
type WaitOptions = CommonOptions & Readonly<{ event: "permissionRequest" | "permissionResolve", timeout?: number }>
