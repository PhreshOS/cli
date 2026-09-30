import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"
import { json } from "./input.ts"
import { option, withJson } from "./options.ts"
import { dataOutput } from "./schemas.ts"

/** Add running-System capabilities to the System lifecycle command family. */
export default function systemAccessCommands(root: Command, connect: ConnectSystem) {
    const system = root.commands.find(command => command.name() === "system") ?? defineCommand(root, {
        name: "system",
        description: "access the running PhreshOS System"
    })

    defineCommand<JsonOptions>(system, {
        name: "about",
        description: executeDescription("system", "about"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.any("the System's name, version, and release"), "What this System is", { format: "value" }),
        examples: ["phresh system about --json"]
    }, () => connected(connect, system => system.execute({ $domain: "system", $operation: "about" })))

    defineCommand<SystemOpenOptions>(system, {
        name: "open",
        description: executeDescription("system", "open"),
        requiresSystem: true,
        options: withJson(
            option("--type <media-type>", "exact media type of what to open", { mandatory: true }),
            option("--uri <uri>", "where it is", { mandatory: true })
        ),
        output: dataOutput(value.nullable(value.any("opened")), "It was opened", { format: "value" }),
        examples: ["phresh system open --type image/png --uri file:///home/me/picture.png"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "system",
        $operation: "open",
        type: options.type,
        uri: options.uri
    })))

    defineCommand<SystemLogsOptions>(system, {
        name: "logs",
        description: executeDescription("system", "logs"),
        requiresSystem: true,
        options: withJson(
            option("--statement <sql>", "read-only SQL statement", { mandatory: true }),
            option("--values <json>", "bound statement values encoded as a JSON array")
        ),
        output: dataOutput(value.array(value.any("log query row"), "log query rows"), "System log query result", { format: "value" }),
        examples: ["phresh system logs --statement 'select createdAt, level, source, kind, content, data from logs order by createdAt desc limit 100' --json"]
    }, ({ options }) => connected(connect, system => {
        const parsed = options.values === undefined ? undefined : json(options.values, "--values")
        if (parsed !== undefined && !Array.isArray(parsed)) throw new Error("--values must be a JSON array")

        return system.execute({
            $domain: "system",
            $operation: "logs",
            statement: options.statement,
            ...(parsed === undefined ? {} : { values: parsed })
        })
    }))
}

interface SystemLogsOptions {
    readonly statement: string
    readonly values?: string
    readonly json?: boolean
}

interface JsonOptions {
    readonly json?: boolean
}

interface SystemOpenOptions {
    readonly type: string
    readonly uri: string
    readonly json?: boolean
}
