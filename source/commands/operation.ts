import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { connected, type ConnectSystem } from "./connection.ts"
import { executeDescription } from "./execution.ts"
import { option, withJson } from "./options.ts"
import { dataOutput, valuePresentation } from "./schemas.ts"

const summary = value.object({
    domain: value.string("operation domain"),
    operation: value.string("operation name"),
    description: value.string("operation meaning")
}, ["domain", "operation", "description"], "Execute operation")

const description = value.object({
    domain: value.string("operation domain"),
    operation: value.string("operation name"),
    description: value.string("operation meaning"),
    request: value.any("request JSON Schema"),
    result: value.any("successful result JSON Schema")
}, ["domain", "operation", "description", "request", "result"], "Execute operation contract")

export default function operationCommands(root: Command, connect: ConnectSystem) {
    const operations = defineCommand(root, {
        name: "operation",
        description: "discover operations available through Execute"
    })

    defineCommand<OperationListOptions>(operations, {
        name: "list",
        description: executeDescription("operation", "list"),
        requiresSystem: true,
        options: withJson(option("--domain <domain>", "restrict results to one operation domain")),
        output: dataOutput(value.array(summary, "Execute operations"), "Available Execute operations", {
            format: "list",
            rows: "",
            fields: [
                { label: "Domain", path: "domain" },
                { label: "Operation", path: "operation" },
                { label: "Description", path: "description" }
            ],
            item: "Operation",
            items: "Operations",
            empty: "No matching operations"
        }),
        examples: ["phresh operation list", "phresh operation list --domain endpoint --json"]
    }, ({ options }) => connected(connect, system => system.execute({
        $domain: "operation",
        $operation: "list",
        ...(options.domain ? { domain: options.domain } : {})
    })))

    defineCommand<OperationDescribeOptions>(operations, {
        name: "describe",
        description: executeDescription("operation", "describe"),
        requiresSystem: true,
        options: withJson(
            option("--domain <domain>", "operation domain", { mandatory: true }),
            option("--operation <operation>", "operation name", { mandatory: true })
        ),
        output: dataOutput(description, "Execute operation contract", valuePresentation),
        examples: ["phresh operation describe --domain endpoint --operation ask --json"]
    }, ({ options }) => connected(connect, async system => {
        const result = await system.execute({
            $domain: "operation",
            $operation: "describe",
            domain: options.domain,
            operation: options.operation
        })
        if (!result) throw new Error(`Unknown Execute operation ${options.domain}.${options.operation}`)
        return result
    }))
}

interface OperationListOptions {
    readonly domain?: string
    readonly json?: boolean
}

interface OperationDescribeOptions {
    readonly domain: string
    readonly operation: string
    readonly json?: boolean
}
