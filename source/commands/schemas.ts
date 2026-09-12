import { clientPermissionCatalog } from "@phreshos/core"
import type { OutputContract, OutputPresentation } from "../contract/output.ts"
import type { ValueContract } from "../contract/schema.ts"
import { value } from "../contract/schema.ts"

const metric: ValueContract = {
    anyOf: [value.number("pixels"), value.string("workspace-relative expression")]
}

const endpointDeclaration = value.nullable(value.object({
    start: value.boolean("whether a default Process starts this Endpoint"),
    service: value.boolean("default Service role for new incarnations")
}, ["start", "service"], "resolved Server Endpoint declaration"))

const permissions = value.object(Object.fromEntries(
    Object.entries(clientPermissionCatalog).map(([name, domain]) => [name, domain === "none"
        ? { type: "array" as const, maxItems: 0, description: `${name} presence-only grant` }
        : value.array(value.string(permissionValueDescription(domain)), `${name} permission values`)
    ])
), [], "immutable Client permissions")

const clientDeclaration = value.nullable(value.object({
    start: value.boolean("whether a default Process starts this Endpoint"),
    service: value.boolean("default Service role for new incarnations"),
    title: value.nullable(value.string("default Window title")),
    size: value.nullable(value.object({ width: metric, height: metric }, ["width", "height"], "default Window size")),
    position: value.nullable(value.object({ x: metric, y: metric }, ["x", "y"], "default Window position")),
    layer: value.nullable(value.enumeration(["window", "under", "over"], "default Window layer")),
    minimize: value.nullable(value.boolean("default minimized state")),
    permissions
}, ["start", "service", "title", "size", "position", "layer", "minimize", "permissions"], "resolved Client Endpoint declaration"))

export const programOutput = value.object({
    identity: value.string("stable Program identity"),
    assetId: value.string("public Program asset identity"),
    name: value.string("human-readable Program name"),
    version: value.nullable(value.string("Program version")),
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
    running: value.boolean("whether the Endpoint currently exists"),
    service: value.boolean("whether this Endpoint incarnation is addressable as a Service")
}, ["process", "program", "endpoint", "declared", "running", "service"], "Endpoint state")

export const windowOutput = value.object({
    process: value.string("owning Process identity"),
    title: value.string("Window title"),
    position: value.object({ x: metric, y: metric }, ["x", "y"], "Window position"),
    size: value.object({ width: metric, height: metric }, ["width", "height"], "Window size"),
    minimized: value.boolean("whether the Window is minimized"),
    front: value.boolean("whether the Window is at the front of its layer"),
    layer: value.enumeration(["window", "under", "over"], "Window layer")
}, ["process", "title", "position", "size", "minimized", "front", "layer"], "Window state")

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

export const programListPresentation: OutputPresentation = table("data", "Program", "Programs", "No matching Programs", [
    { label: "Name", path: "name", width: 2 },
    { label: "Identity", path: "identity", width: 2 },
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

export const processListPresentation: OutputPresentation = table("data", "Process", "Processes", "No matching Processes", [
    { label: "Name", path: "name", width: 2 },
    { label: "Identity", path: "identity", width: 2 },
    { label: "Program", path: "program", width: 2 },
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

export const windowPresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Title", "title"],
    ["Position", "position"],
    ["Size", "size"],
    ["Minimized", "minimized"],
    ["Front", "front"],
    ["Layer", "layer"],
    ["Location", "location"]
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

export const windowTitlePresentation: OutputPresentation = fields(
    ["Process", "process"],
    ["Title", "title"]
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
        running: value.boolean("whether the Endpoint currently exists"),
        service: value.boolean("whether this Endpoint incarnation is a Service")
    }, ["declared", "running", "service"], description)
}

function fields(...values: readonly (readonly [label: string, path: string])[]): OutputPresentation {
    return {
        format: "fields",
        fields: values.map(([label, path]) => ({ label, path }))
    }
}

function table(
    rows: string,
    item: string,
    items: string,
    empty: string,
    columns: Extract<OutputPresentation, { format: "table" }>["columns"]
): OutputPresentation {
    return { format: "table", rows, columns, item, items, empty, total: "total", truncated: "truncated" }
}

function permissionValueDescription(domain: Exclude<(typeof clientPermissionCatalog)[keyof typeof clientPermissionCatalog], "none">) {
    switch (domain) {
        case "program": return "Program identity"
        case "network": return "network destination scope"
        case "storage": return "storage path scope"
    }
}
