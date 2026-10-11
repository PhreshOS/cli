import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"
import { json, position, writeIcon } from "./input.ts"
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
        examples: ["phresh system about --json   # name, version, release, and when it started"]
    }, () => connected(connect, system => system.execute({ $domain: "system", $operation: "about" })))

    defineCommand<SystemIconOptions>(system, {
        name: "icon",
        description: "Write the System's icon to a PNG file.",
        requiresSystem: true,
        options: withJson(
            option("--size <size>", "rendered size", { choices: ["small", "medium", "large"] }),
            option("--output <file>", "PNG file to write", { mandatory: true })
        ),
        output: dataOutput(value.any("written file"), "Where the icon was written", { format: "value" }),
        examples: ["phresh system icon --output phreshos.png   # the System's icon as a PNG file; --size small, medium, or large"]
    }, ({ options }) => connected(connect, async system => writeIcon(await system.icon(options.size), options.output)))

    defineCommand<SystemOpenOptions>(system, {
        name: "open",
        description: executeDescription("system", "open"),
        requiresSystem: true,
        options: withJson(
            option("--type <media-type>", "exact media type of what to open", { mandatory: true }),
            option("--uri <uri>", "where it is", { mandatory: true }),
            option("--x <value>", "where its Window's left edge is, as for phresh window move, unless the Program that opens it declares where its Windows open; given with --y; left out, the Window opens centered on the middle of the plane"),
            option("--y <value>", "where its Window's top edge is, as --x; given with --x")
        ),
        output: dataOutput(value.nullable(value.any("opened")), "It was opened", { format: "value" }),
        examples: [
            "phresh system open --type image/png --uri file:///home/me/picture.png   # opens the picture with the Program that opens PNG images",
            "phresh system open --type inode/directory --uri file:///home/me --x '1/2 - 600' --y -300   # opens the folder with its Window's left edge 600 pixels left of the view's right edge, unless its Program says where"
        ]
    }, ({ options }) => {
        if ((options.x === undefined) !== (options.y === undefined)) throw new Error("--x and --y are given together")
        return connected(connect, system => system.execute({
            $domain: "system",
            $operation: "open",
            type: options.type,
            uri: options.uri,
            ...(options.x !== undefined && options.y !== undefined ? { position: position(options.x, options.y) } : {})
        }))
    })

    defineCommand<SystemLogsOptions>(system, {
        name: "logs",
        description: executeDescription("system", "logs"),
        requiresSystem: true,
        options: withJson(
            option("--statement <sql>", "read-only SQL statement", { mandatory: true }),
            option("--values <json>", "bound statement values encoded as a JSON array")
        ),
        output: dataOutput(value.array(value.any("log query row"), "log query rows"), "System log query result", { format: "value" }),
        examples: ["phresh system logs --statement 'select * from logs order by createdAt desc limit 20'   # the 20 newest System records"]
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
    readonly x?: string
    readonly y?: string
    readonly json?: boolean
}

type SystemIconOptions = Readonly<{ json?: boolean, size?: "small" | "medium" | "large", output: string }>
