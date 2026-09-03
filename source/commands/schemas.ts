import type { OutputContract } from "../contract/command.ts"
import type { ValueContract } from "../contract/schema.ts"
import { value } from "../contract/schema.ts"

const metric: ValueContract = {
    anyOf: [value.number("pixels"), value.string("workspace-relative expression")]
}

const endpointDeclaration = value.nullable(value.object({
    start: value.boolean("whether a default Process starts this Endpoint"),
    service: value.boolean("default Service role for new incarnations")
}, ["start", "service"], "resolved Server Endpoint declaration"))

const permissions = value.object({
    all: value.array(value.string("permission value"), "all permission values"),
    services: value.array(value.string("Program identity"), "permitted Service Programs"),
    programs: value.array(value.string("Program identity"), "permitted Programs"),
    appearance: value.array(value.string("permission value"), "appearance permission values"),
    desktopPreferences: value.array(value.string("permission value"), "Desktop preferences permission values")
}, [], "immutable Client permissions")

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
    layer: value.enumeration(["window", "under", "over"], "Window layer"),
    location: value.string("current Client location")
}, ["process", "title", "position", "size", "minimized", "front", "layer", "location"], "Window state")

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

export function jsonOutput(schema: ValueContract, description: string): OutputContract {
    return { format: "json", description, value: schema }
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
