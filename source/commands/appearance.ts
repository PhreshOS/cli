import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { bounded, json, type CommonOptions } from "./input.ts"
import { option, timeoutOption, withJson } from "./options.ts"
import { dataOutput, eventOutput, eventPresentation, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"

export default function appearanceCommands(root: Command, connect: ConnectSystem) {
    const appearance = defineCommand(root, {
        name: "appearance",
        description: "read and change the System Appearance"
    })

    defineCommand<CommonOptions>(appearance, {
        name: "get",
        description: executeDescription("appearance", "get"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.any("Appearance"), "The complete Appearance", valuePresentation),
        examples: ["phresh appearance get --json"]
    }, () => connected(connect, system => system.execute({ $domain: "appearance", $operation: "get" })))

    defineCommand<UpdateOptions>(appearance, {
        name: "update",
        description: executeDescription("appearance", "update"),
        requiresSystem: true,
        options: withJson(option("--value <json>", "partial Appearance as a JSON object", { mandatory: true })),
        output: dataOutput(value.any("Appearance"), "The complete Appearance after the change", valuePresentation),
        examples: ["phresh appearance update --value '{\"tempo\":1.2}'"]
    }, ({ options }) => connected(connect, system => {
        const parsed = json(options.value, "--value")
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--value must be a JSON object")
        return system.execute({ $domain: "appearance", $operation: "update", value: parsed as Record<string, never> })
    }))

    defineCommand<WaitOptions>(appearance, {
        name: "wait",
        description: executeDescription("appearance", "wait"),
        requiresSystem: true,
        options: withJson(option("--event <event>", "Appearance event", { mandatory: true, choices: ["change"] }), timeoutOption),
        output: dataOutput(eventOutput("The observed Appearance event"), "One Appearance event", eventPresentation),
        examples: ["phresh appearance wait --event change"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "appearance", $operation: "wait", event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    })))
}

type UpdateOptions = CommonOptions & Readonly<{ value: string }>
type WaitOptions = CommonOptions & Readonly<{ event: "change", timeout?: number }>
