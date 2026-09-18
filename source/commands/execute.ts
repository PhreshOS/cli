import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { connected, type ConnectSystem } from "./connection.ts"
import { dataOutput } from "./schemas.ts"

/** Expose the shared SDK Execute adapter as an exact JSON interface. */
export default function executeCommand(root: Command, connect: ConnectSystem) {
    defineCommand<Record<string, never>, [string]>(root, {
        name: "execute",
        description: "execute one raw JSON operation through the Node SDK",
        arguments: [{ syntax: "<request>", description: "Execute request encoded as JSON" }],
        guidance: ["Use operation.list and operation.describe to discover the available request contracts."],
        examples: [
            "phresh execute '{\"$domain\":\"operation\",\"$operation\":\"list\"}'",
            "phresh execute '{\"$domain\":\"endpoint\",\"$operation\":\"ask\",\"program\":\"tilo\",\"process\":\"main\",\"endpoint\":\"server\",\"event\":\"board.list\",\"input\":null}'"
        ],
        output: dataOutput(value.any("JSON result returned by the selected Execute operation"), "Execute result", { format: "json" }),
        requiresSystem: true
    }, async ({ arguments: [source] }) => {
        let value: unknown
        try { value = JSON.parse(source) }
        catch { throw new Error("The Execute request must be valid JSON") }

        const request = parseExecuteRequest(value)
        return connected(connect, system => system.execute(request))
    })
}

