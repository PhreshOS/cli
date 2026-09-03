/** JSON-compatible value contract exposed by CLI discovery. */
export type ValueContract = Readonly<{
    type?: "array" | "boolean" | "integer" | "null" | "number" | "object" | "string"
    description?: string
    enum?: readonly (boolean | number | string | null)[]
    properties?: Readonly<Record<string, ValueContract>>
    required?: readonly string[]
    items?: ValueContract
    additionalProperties?: boolean | ValueContract
    anyOf?: readonly ValueContract[]
}>

export const value = Object.freeze({

    any: (description: string): ValueContract => ({ description }),

    string: (description: string): ValueContract => ({ type: "string", description }),

    number: (description: string): ValueContract => ({ type: "number", description }),

    integer: (description: string): ValueContract => ({ type: "integer", description }),

    boolean: (description: string): ValueContract => ({ type: "boolean", description }),

    literal: (literal: boolean | number | string | null, description: string): ValueContract => ({
        ...(literal === null ? { type: "null" as const } : { type: typeof literal as "boolean" | "number" | "string" }),
        enum: [literal],
        description
    }),

    enumeration: (values: readonly string[], description: string): ValueContract => ({
        type: "string",
        enum: values,
        description
    }),

    array: (items: ValueContract, description: string): ValueContract => ({ type: "array", items, description }),

    object: (
        properties: Readonly<Record<string, ValueContract>>,
        required: readonly string[],
        description: string,
        additionalProperties: boolean | ValueContract = false
    ): ValueContract => ({ type: "object", properties, required, additionalProperties, description }),

    nullable: (schema: ValueContract): ValueContract => ({ anyOf: [schema, { type: "null" }] })
})

/** Validate one emitted JSON value against its declared CLI output contract. */
export function assertValue(value: unknown, contract: ValueContract, path = "result"): void {
    if (contract.anyOf) {
        if (contract.anyOf.some(candidate => accepts(value, candidate))) return
        throw new Error(`${path} does not match its CLI contract`)
    }

    if (contract.enum && !contract.enum.some(candidate => Object.is(candidate, value))) {
        throw new Error(`${path} is not one of its declared values`)
    }

    if (!contract.type) return

    if (contract.type === "null") {
        if (value !== null) throw new Error(`${path} must be null`)
        return
    }

    if (contract.type === "array") {
        if (!Array.isArray(value)) throw new Error(`${path} must be an array`)
        if (contract.items) value.forEach((item, index) => assertValue(item, contract.items!, `${path}[${index}]`))
        return
    }

    if (contract.type === "object") {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`)

        const record = value as Record<string, unknown>
        for (const name of contract.required ?? []) {
            if (!Object.hasOwn(record, name)) throw new Error(`${path}.${name} is required by its CLI contract`)
        }
        for (const [name, item] of Object.entries(record)) {
            const property = contract.properties?.[name]
            if (property) assertValue(item, property, `${path}.${name}`)
            else if (contract.additionalProperties === false) throw new Error(`${path}.${name} is not declared by its CLI contract`)
            else if (typeof contract.additionalProperties === "object") assertValue(item, contract.additionalProperties, `${path}.${name}`)
        }
        return
    }

    if (contract.type === "integer") {
        if (!Number.isInteger(value)) throw new Error(`${path} must be an integer`)
        return
    }

    if (typeof value !== contract.type) throw new Error(`${path} must be ${contract.type}`)
}

function accepts(value: unknown, contract: ValueContract) {
    try {
        assertValue(value, contract)
        return true
    }
    catch {
        return false
    }
}
