import type { OutputField } from "../contract/output.ts"

/** Render records as readable field blocks without terminal-table layout work. */
export function renderList(fields: readonly OutputField[], rows: readonly unknown[]) {
    return rows.map(row => renderFields(fields, row)).join("\n\n")
}

/** Render one value as aligned labels with indented multiline values. */
export function renderFields(fields: readonly OutputField[], source: unknown) {
    const width = Math.max(...fields.map(field => field.label.length), 0)

    return fields.map(field => {
        const value = display(readPath(source, field.path), true)
        const lines = value.split("\n")
        const prefix = `${field.label.padEnd(width)}  `
        const continuation = " ".repeat(prefix.length)
        return [prefix + lines[0], ...lines.slice(1).map(line => continuation + line)].join("\n")
    }).join("\n")
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

