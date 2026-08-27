import {
    systemControl,
    systemControlOperation,
    type SystemControlCapabilityName,
    type SystemControlClient,
    type SystemControlRequest
} from "@phreshos/core"
import type { Command } from "commander"
import LocalSystemControl from "./client.ts"

/** Build the CLI directly from Core's authoritative capability catalog. */
export default function controlCommands(system: Command, provided?: SystemControlClient) {

    let client = provided
    const current = () => client ?? (client = new LocalSystemControl())

    for (const [capabilityName, capability] of Object.entries(systemControl)) {

        const group = system.command(capabilityName)
            .description(capability.description)
            .addHelpText("after", `\nOperating guidance:\n${capability.guidance.map(item => `  - ${item}`).join("\n")}\n`)

        for (const [operationName, operation] of Object.entries(capability.operations)) {

            group.command(operationName)
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
                })
        }
    }

    system.command("describe")
        .description("inspect the authoritative System control vocabulary")
        .argument("[capability]", "program, process, endpoint, or window")
        .argument("[operation]", "an operation within the capability")
        .option("--compact", "write machine-readable JSON on one line")
        .action(function (capability: string | undefined, operation: string | undefined, options: { compact?: boolean }) {

            const result = describe(capability, operation)

            console.log(JSON.stringify(result, null, options.compact ? undefined : 2))
        })
}

function describe(capabilityName?: string, operationName?: string) {

    if (!capabilityName) return Object.entries(systemControl).map(([name, capability]) => ({ name, description: capability.description }))

    if (!Object.hasOwn(systemControl, capabilityName)) throw new Error(`Unknown System control capability "${capabilityName}"`)

    const capability = systemControl[capabilityName as SystemControlCapabilityName]

    if (!operationName) return {
        name: capabilityName,
        description: capability.description,
        guidance: capability.guidance,
        operations: Object.entries(capability.operations).map(([name, operation]) => ({
            name,
            mode: operation.mode,
            description: operation.description
        }))
    }

    const operation = systemControlOperation(capabilityName, operationName)

    if (!operation) throw new Error(`Unknown System control operation "${capabilityName}.${operationName}"`)

    return { capability: capabilityName, operation: operationName, ...operation }
}

function operationHelp(capability: SystemControlCapabilityName, operation: string) {

    const definition = systemControlOperation(capability, operation)

    if (!definition) return ""

    return `\nInput schema:\n${JSON.stringify(definition.input, null, 2)}\n\nExamples:\n${definition.examples.map(example => `  phresh system ${capability} ${operation} --input '${JSON.stringify(example)}'`).join("\n")}\n`
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
