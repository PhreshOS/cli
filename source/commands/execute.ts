import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { dataOutput } from "./schemas.ts"

/** Expose the shared SDK Execute adapter as an exact JSON interface. */
export default function executeCommand(root: Command, connect: ConnectSystem) {
    defineCommand<Record<string, never>, [string]>(root, {
        name: "execute",
        description: "run any System operation as one JSON request",
        arguments: [{ syntax: "<request>", description: "Execute request encoded as JSON" }],
        guidance: [
            "Every command of this CLI is one of these operations; prefer the command, which checks its options. Use execute when a script builds requests as data.",
            "phresh operation list names the operations; phresh operation describe --domain <domain> --operation <operation> gives the JSON Schema of what one takes and returns."
        ],
        examples: [
            "phresh execute '{\"$domain\":\"operation\",\"$operation\":\"list\"}'   # every operation, as JSON",
            "phresh execute '{\"$domain\":\"endpoint\",\"$operation\":\"ask\",\"program\":\"tilo\",\"process\":\"main\",\"endpoint\":\"server\",\"event\":\"board.list\",\"input\":null}'   # the same as phresh endpoint ask"
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
