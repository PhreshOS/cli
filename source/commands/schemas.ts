import type { OutputContract, OutputPresentation } from "../contract/output.ts"
import { layers } from "@phreshos/core"
import type { ValueContract } from "../contract/schema.ts"
import { value } from "../contract/schema.ts"

const metric: ValueContract = {
    anyOf: [value.number("pixels"), value.string("workspace-relative expression")]
}

const transaction: ValueContract = {
    anyOf: [
        value.boolean("default or disabled transaction"),
        value.number("duration in milliseconds"),
        value.object({
            duration: value.number("duration in milliseconds"),
            easing: value.any("CSS easing name or cubic Bézier tuple")
        }, ["duration", "easing"], "appearance transaction")
    ]
}

const surface: ValueContract = {
    anyOf: [
        value.boolean("default or absent surface"),
        value.object({
            radius: { anyOf: [value.number("radius in pixels"), value.literal("full", "fully rounded radius")] },
            color: value.string("Appearance color role or CSS color"),
            material: {
                anyOf: [
                    value.literal(false, "disabled Material"),
                    value.object({
                        grain: value.number("grain frequency"),
                        grainAmount: value.number("grain intensity"),
                        backdrop: value.number("backdrop blur"),
                        opacity: value.number("Material opacity"),
                        distortion: value.number("backdrop distortion"),
                        saturation: value.number("backdrop saturation")
                    }, [], "partial Appearance Material")
                ]
            }
        }, [], "Window surface customization")
    ]
}

const endpointDeclaration = value.nullable(value.object({
    start: value.boolean("whether a default Process starts this Endpoint"),
    service: value.boolean("default Service role for new execution contexts")
}, ["start", "service"], "resolved Server Endpoint declaration"))

const clientDeclaration = value.nullable(value.object({
    start: value.boolean("whether a default Process starts this Endpoint"),
    service: value.boolean("default Service role for new execution contexts"),
    title: value.nullable(value.string("default Window title")),
    header: value.nullable(value.boolean("default Window header visibility")),
    surface: value.nullable(surface),
    transaction: value.nullable(transaction),
    size: value.nullable(value.object({ width: metric, height: metric }, ["width", "height"], "default Window size")),
    position: value.nullable(value.object({ x: metric, y: metric }, ["x", "y"], "default Window position")),
    layer: value.nullable(value.enumeration(layers, "default Window layer")),
    minimize: value.nullable(value.boolean("default minimized state")),
    maximize: value.nullable(value.boolean("default maximized state"))
}, ["start", "service", "title", "header", "surface", "transaction", "size", "position", "layer", "minimize", "maximize"], "resolved Client Endpoint declaration"))

export const programOutput = value.object({
    identity: value.string("stable Program identity"),
    assetId: value.string("public Program asset identity"),
    name: value.string("human-readable Program name"),
    version: value.string("Resolved Program version"),
    description: value.nullable(value.string("Program description")),
    installed: value.boolean("whether production files are installed"),
    hasAgent: value.boolean("whether the Program provides agent documentation"),
    server: endpointDeclaration,
    client: clientDeclaration
}, ["identity", "assetId", "name", "version", "description", "installed", "hasAgent", "server", "client"], "Program state")

export const processOutput = value.object({
    identity: value.string("unique Process identity"),
    name: value.nullable(value.string("stable Program-local Process name")),
    program: value.string("owning Program identity"),
    startedAt: value.string("ISO start time"),
    server: endpointState("Server Endpoint state"),
    client: endpointState("Client Endpoint state")
}, ["identity", "name", "program", "startedAt", "server", "client"], "Process state")

export const endpointOutput = value.object({
    process: value.string("owning Process identity"),
    program: value.string("owning Program identity"),
    endpoint: value.enumeration(["server", "client"], "Endpoint kind"),
    declared: value.boolean("whether the Program declares this Endpoint"),
    running: value.boolean("whether the Endpoint currently has a running execution context"),
    service: value.boolean("whether this Endpoint execution context is addressable as a Service")
}, ["process", "program", "endpoint", "declared", "running", "service"], "Endpoint state")

export const serviceOutput = value.object({
    program: value.string("owning Program identity"),
    process: value.string("Process and Service name"),
    endpoint: value.enumeration(["server", "client"], "Endpoint kind"),
    available: value.boolean("whether a ready Endpoint is currently available at this address")
}, ["program", "process", "endpoint", "available"], "Service state")

export const windowOutput = value.object({
    process: value.string("owning Process identity"),
    title: value.string("Window title"),
    header: value.boolean("whether the Desktop-owned Window header is shown"),
    surface,
    transaction,
    position: value.object({ x: metric, y: metric }, ["x", "y"], "Window position"),
    size: value.object({ width: metric, height: metric }, ["width", "height"], "Window size"),
    minimized: value.boolean("whether the Window is minimized"),
    maximized: value.boolean("whether the Window is maximized"),
    front: value.boolean("whether the Window is at the front of its layer"),
    layer: value.enumeration(layers, "Window layer")
}, ["process", "title", "header", "surface", "transaction", "position", "size", "minimized", "maximized", "front", "layer"], "Window state")

export const programPresentation: OutputPresentation = fields(
    ["Identity", "identity"],
    ["Asset", "assetId"],
    ["Name", "name"],
    ["Version", "version"],
    ["Description", "description"],
    ["Installed", "installed"],
    ["Agent", "hasAgent"],
    ["Server", "server"],
    ["Client", "client"]
)

export const programListPresentation: OutputPresentation = list("data", "Program", "Programs", "No matching Programs", [
    { label: "Name", path: "name" },
    { label: "Identity", path: "identity" },
    { label: "Version", path: "version" },
    { label: "Installed", path: "installed" }
])

export const processPresentation: OutputPresentation = fields(
    ["Identity", "identity"],
    ["Name", "name"],
    ["Program", "program"],
    ["Started", "startedAt"],
    ["Server declared", "server.declared"],
    ["Server running", "server.running"],
    ["Server service", "server.service"],
    ["Client declared", "client.declared"],
    ["Client running", "client.running"],
    ["Client service", "client.service"]
)

export const processActionPresentation: OutputPresentation = fields(
    ["Process", "identity"],
    ["Name", "name"],
    ["Program", "program"],
    ["Server", "server.running"],
    ["Client", "client.running"]
)

export const processIdentityPresentation: OutputPresentation = fields(
    ["Process", "identity"],
    ["Program", "program"]
)

export const processListPresentation: OutputPresentation = list("data", "Process", "Processes", "No matching Processes", [
    { label: "Name", path: "name" },
    { label: "Identity", path: "identity" },
    { label: "Program", path: "program" },
    { label: "Server", path: "server.running" },
    { label: "Client", path: "client.running" }
])

export const endpointPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Program", "program"],
    ["Endpoint", "endpoint"],
    ["Declared", "declared"],
    ["Running", "running"],
    ["Service", "service"]
)

export const endpointActionPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Endpoint", "endpoint"],
    ["Running", "running"],
    ["Service", "service"]
)

export const servicePresentation: OutputPresentation = fields(
    ["Program", "program"],
    ["Service", "process"],
    ["Endpoint", "endpoint"],
    ["Available", "available"]
)

export const serviceListPresentation: OutputPresentation = list("data", "Service", "Services", "No matching Services", [
    { label: "Service", path: "process" },
    { label: "Program", path: "program" },
    { label: "Endpoint", path: "endpoint" }
])

export const windowPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Title", "title"],
    ["Header", "header"],
    ["Surface", "surface"],
    ["Transaction", "transaction"],
    ["Position", "position"],
    ["Size", "size"],
    ["Minimized", "minimized"],
    ["Maximized", "maximized"],
    ["Front", "front"],
    ["Layer", "layer"]
)

export const windowPositionPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Position", "position"]
)

export const windowSizePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Size", "size"]
)

export const windowGeometryPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Position", "position"],
    ["Size", "size"]
)

export const windowMinimizePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Minimized", "minimized"]
)

export const windowMaximizePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Maximized", "maximized"]
)

export const windowTitlePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Title", "title"]
)

export const windowHeaderPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Header", "header"]
)

export const windowSurfacePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Surface", "surface"]
)

export const windowTransactionPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Transaction", "transaction"]
)

export const windowRaisePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Front", "front"]
)

export const eventPresentation: OutputPresentation = fields(
    ["Scope", "scope"],
    ["Event", "event"],
    ["Payload", "payload"]
)

export const lifecyclePresentation: OutputPresentation = fields(
    ["Scope", "scope"],
    ["Event", "event"]
)

export const commandPresentation: OutputPresentation = fields(
    ["Path", "path"],
    ["Name", "name"],
    ["Aliases", "aliases"],
    ["Description", "description"],
    ["Arguments", "arguments"],
    ["Options", "options"],
    ["Guidance", "guidance"],
    ["Examples", "examples"],
    ["Requires System", "requiresSystem"],
    ["Output", "output"],
    ["Commands", "commands"]
)

export const valuePresentation: OutputPresentation = { format: "value" }

export function pageOutput(items: ValueContract, description: string) {
    return value.object({
        data: value.array(items, description),
        total: value.integer("total matching values"),
        truncated: value.boolean("whether more matching values exist")
    }, ["data", "total", "truncated"], description)
}

export function eventOutput(description: string, payload: ValueContract = value.any("event payload")) {
    return value.object({
        scope: value.string("subscription scope"),
        event: value.string("event name"),
        payload
    }, ["scope", "event", "payload"], description)
}

export function dataOutput(schema: ValueContract, description: string, presentation: OutputPresentation): OutputContract {
    return { format: "data", description, value: schema, presentation }
}

export function textOutput(description: string): OutputContract {
    return { format: "text", description }
}

function endpointState(description: string) {
    return value.object({
        declared: value.boolean("whether the Program declares this Endpoint"),
        running: value.boolean("whether the Endpoint currently has a running execution context"),
        service: value.boolean("whether this Endpoint execution context is a Service")
    }, ["declared", "running", "service"], description)
}

function fields(...values: readonly (readonly [label: string, path: string])[]): OutputPresentation {
    return {
        format: "fields",
        fields: values.map(([label, path]) => ({ label, path }))
    }
}

function list(
    rows: string,
    item: string,
    items: string,
    empty: string,
    fields: Extract<OutputPresentation, { format: "list" }>["fields"]
): OutputPresentation {
    return { format: "list", rows, fields, item, items, empty, total: "total", truncated: "truncated" }
}
