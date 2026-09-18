import { inspect } from "node:util"
import type { DataOutputContract, OutputPresentation } from "../contract/output.ts"
import { assertValue } from "../contract/schema.ts"
import { readPath, renderFields, renderList } from "./format.ts"

/** Validate command data once, then select its machine or human representation. */
export function writeData(result: unknown, contract: DataOutputContract, machine: boolean) {
    const normalized = result ?? null
    assertValue(normalized, contract.value)

    if (machine || contract.presentation.format === "json") {
        console.log(JSON.stringify(normalized))
        return
    }

    console.log(render(normalized, contract.presentation))
    console.log()
}

function render(value: unknown, presentation: OutputPresentation): string {
    switch (presentation.format) {
        case "list": return renderCollection(value, presentation)
        case "fields": return renderFields(presentation.fields, value)
        case "document": return String(readPath(value, presentation.content) ?? "")
        case "value": return inspect(value, { colors: false, depth: null, compact: false })
        case "json": return JSON.stringify(value)
    }
}

function renderCollection(value: unknown, presentation: Extract<OutputPresentation, { format: "list" }>) {
    const selected = readPath(value, presentation.rows)
    const rows = Array.isArray(selected) ? selected : []

    if (rows.length === 0) return presentation.empty

    const list = renderList(presentation.fields, rows)
    const totalValue = presentation.total ? readPath(value, presentation.total) : rows.length
    const total = typeof totalValue === "number" ? totalValue : rows.length
    const noun = total === 1 ? presentation.item : presentation.items
    const summary = rows.length === total
        ? `${total} ${noun}`
        : `${rows.length} of ${total} ${noun}`
    const truncated = presentation.truncated && readPath(value, presentation.truncated) === true
        ? " · more available"
        : ""

    return `${list}\n\n${summary}${truncated}`
}
