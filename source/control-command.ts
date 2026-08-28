import {
    systemControl,
    systemControlOperation,
    type SystemControlCapabilityName,
    type SystemControlClient,
    type SystemControlRequest
} from "@phreshos/core"
import type { Command } from "commander"
import LocalSystemControl from "./control-client.ts"
import { commandContract } from "./command-contract.ts"

/** Build the top-level running-System commands from Core's authoritative catalog. */
export default function controlCommands(program: Command, provided?: SystemControlClient) {

    let client = provided
    const current = () => client ?? (client = new LocalSystemControl())

    for (const [capabilityName, capability] of Object.entries(systemControl)) {

        const group = commandContract(program.command(capabilityName)
            .description(capability.description)
            .addHelpText("after", `\nOperating guidance:\n${capability.guidance.map(item => `  - ${item}`).join("\n")}\n`), {
                guidance: capability.guidance,
                capability
            })

        for (const [operationName, operation] of Object.entries(capability.operations)) {

            commandContract(group.command(operationName)
                .description(operation.description)
                .option("--input <json>", "operation input as one JSON object", "{}")
                .option("--compact", "write machine-readable JSON on one line")
                .addHelpText("after", operationHelp(capabilityName as SystemControlCapabilityName, operationName))
                .action(async function (options: ControlOptions) {

                    const input = parseInput(options.input)
                    const result = await current().execute({
                        capability: capabilityName,
                        operation: operationName,
                        input
                    } as SystemControlRequest)

                    console.log(JSON.stringify(result ?? null, null, options.compact ? undefined : 2))
                }), { capability: operation })
        }
    }
}

function operationHelp(capability: SystemControlCapabilityName, operation: string) {

    const definition = systemControlOperation(capability, operation)

    if (!definition) return ""

    return `\nInput schema:\n${JSON.stringify(definition.input, null, 2)}\n\nExamples:\n${definition.examples.map(example => `  phresh ${capability} ${operation} --input '${JSON.stringify(example)}'`).join("\n")}\n`
}

function parseInput(value: string) {

    let parsed: unknown

    try { parsed = JSON.parse(value) }
    catch { throw new Error("--input must be valid JSON") }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--input must be one JSON object")

    return parsed
}

interface ControlOptions {

    input: string
    compact?: boolean
}
