import type { ValueContract } from "./schema.ts"

/** Describe both the returned data and its default human representation. */
export type OutputContract = DataOutputContract | TextOutputContract

export interface DataOutputContract {
    readonly format: "data"
    readonly description: string
    readonly value: ValueContract
    readonly presentation: OutputPresentation
}

export interface TextOutputContract {
    readonly format: "text"
    readonly description: string
}

export type OutputPresentation =
    | ListPresentation
    | FieldsPresentation
    | DocumentPresentation
    | ValuePresentation
    | JsonPresentation

export interface ListPresentation {
    readonly format: "list"
    readonly rows: string
    readonly fields: readonly OutputField[]
    readonly item: string
    readonly items: string
    readonly empty: string
    readonly total?: string
    readonly truncated?: string
}

export interface FieldsPresentation {
    readonly format: "fields"
    readonly fields: readonly OutputField[]
}

export interface DocumentPresentation {
    readonly format: "document"
    readonly content: string
}

export interface ValuePresentation {
    readonly format: "value"
}

export interface JsonPresentation {
    readonly format: "json"
}

export interface OutputField {
    readonly label: string
    readonly path: string
}
