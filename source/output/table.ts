import Table from "cli-table3"
import stringWidth from "string-width"
import type { OutputField } from "../contract/output.ts"

const style = Object.freeze({ head: [], border: [] })

/** Render a table at its natural width, constraining and wrapping it only when necessary. */
export function renderTable(fields: readonly OutputField[], rows: readonly unknown[]) {
    const width = terminalWidth()

    if (width < minimumTableWidth(fields)) {
        return rows.map(row => renderFields(fields, row)).join("\n")
    }

    const natural = createTable(fields, rows)
    const rendered = natural.toString()

    if (rendered.split("\n").every(line => stringWidth(line) <= width)) return rendered

    return createTable(fields, rows, allocateWidths(width, fields)).toString()
}

/** Render one value vertically so field names remain readable on narrow terminals. */
export function renderFields(fields: readonly OutputField[], source: unknown) {
    const rows = fields.map(field => [field.label, display(readPath(source, field.path), true)])
    const width = terminalWidth()
    const desiredLabelWidth = Math.max(6, ...fields.map(field => stringWidth(field.label) + 2))
    const labelWidth = Math.min(24, Math.max(6, width - 11), desiredLabelWidth)
    const valueWidth = Math.max(8, width - labelWidth - 3)
    const table = new Table({
        colWidths: [labelWidth, valueWidth],
        wordWrap: true,
        wrapOnWordBoundary: false,
        style
    })

    table.push(...rows)
    return table.toString()
}

export function readPath(source: unknown, path: string): unknown {
    if (!path) return source

    return path.split(".").reduce<unknown>((current, key) => {
        if (typeof current !== "object" || current === null) return undefined
        return (current as Record<string, unknown>)[key]
    }, source)
}

export function display(value: unknown, expanded = false): string {
    if (value === null || value === undefined || value === "") return "—"
    if (typeof value === "boolean") return value ? "yes" : "no"
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value)
    if (Array.isArray(value) && !expanded) return value.length ? value.map(item => display(item)).join(", ") : "—"
    return JSON.stringify(value, null, expanded ? 2 : undefined)
}

function createTable(fields: readonly OutputField[], rows: readonly unknown[], colWidths?: number[]) {
    const table = new Table({
        head: fields.map(field => field.label),
        ...(colWidths ? { colWidths } : {}),
        wordWrap: true,
        wrapOnWordBoundary: false,
        style
    })

    table.push(...rows.map(row => fields.map(field => display(readPath(row, field.path)))))
    return table
}

function allocateWidths(width: number, fields: readonly OutputField[]) {
    const minimums = fields.map(field => minimumColumnWidth(field))
    const available = width - fields.length - 1
    const remaining = available - minimums.reduce((total, current) => total + current, 0)
    const weights = fields.map(field => field.width ?? 1)
    const totalWeight = weights.reduce((total, current) => total + current, 0)
    const widths = minimums.map((minimum, index) => minimum + Math.floor(remaining * weights[index]! / totalWeight))
    let remainder = available - widths.reduce((total, current) => total + current, 0)

    for (let index = 0; remainder > 0; index = (index + 1) % widths.length) {
        widths[index] = widths[index]! + 1
        remainder--
    }

    return widths
}

function minimumTableWidth(fields: readonly OutputField[]) {
    return fields.reduce((total, field) => total + minimumColumnWidth(field), fields.length + 1)
}

function minimumColumnWidth(field: OutputField) {
    return Math.max(6, stringWidth(field.label) + 2)
}

function terminalWidth() {
    const configured = Number(process.env.COLUMNS)
    if (Number.isFinite(configured) && configured > 0) return Math.floor(configured)
    return process.stdout.columns ?? 80
}
