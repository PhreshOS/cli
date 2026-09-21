import assert from "node:assert/strict"
import { Command } from "commander"
import { test } from "vitest"
import accessCommands from "../dist/commands/access.js"
import describeCommands from "../dist/commands/describe.js"
import { gatewayPath } from "../dist/gateway.js"
import { clientLaunch, launch, serverLaunch } from "../dist/commands/input.js"
import { assertCommandContracts, attachCommandContract, defineCommand } from "../dist/contract/command.js"
import { join } from "node:path"
import { execute, layers, listExecuteOperations } from "@phreshos/core"
import { assertValue } from "../dist/contract/schema.js"
import { programOutput, windowOutput } from "../dist/commands/schemas.js"
import { executeCommandPaths } from "../dist/commands/execution.js"

test("CLI accepts every shared layer in launch flags and emitted Window and Program data", () => {
    const program = new Command().exitOverride().name("phresh")
    accessCommands(program, async () => { throw new Error("must not connect") })
    const options = descendants(program).flatMap(command => command.options).filter(option => option.flags === "--client-layer <layer>")
    assert(options.length > 0)
    for (const option of options) assert.deepEqual(option.argChoices, [...layers])
    const declaration = programOutput.properties.client.anyOf.find(candidate => candidate.type === "object")
    for (const layer of layers) {
        assert.deepEqual(clientLaunch({ clientLayer: layer }), { layer })
        assertValue(layer, windowOutput.properties.layer)
        assertValue(layer, declaration.properties.layer)
    }
    assert.throws(() => assertValue("unknown", windowOutput.properties.layer))
})

test("the selected home has one owner-local gateway", function () {

    assert.equal(gatewayPath("/Users/person/.phreshos", "linux"), join("/Users/person", ".phreshos", "gateway.sock"))
    assert.equal(gatewayPath("/state", "linux"), join("/state", "gateway.sock"))
})

test("running-System commands use shared handles and explicit flags", async function () {

    const calls = []
    const window = {
        async move(position) { calls.push(["move", position]) },
        async title() { return "Example" },
        async header() { return true },
        async frame() { return true },
        async transaction() { return false },
        async position() { return { x: 50, y: 0 } },
        async size() { return { width: 800, height: 600 } },
        async minimized() { return false },
        async maximized() { return false },
        async front() { return true },
        async layer() { return "window" }
    }
    const process = {
        identity: "one",
        client: { window }
    }
    const system = {
        process: { async find(identity) { calls.push(["find", identity]); return process } },
        execute(request) { return execute(this, request) },
        async disconnect() { calls.push(["disconnect"]) }
    }
    const program = new Command().exitOverride().name("phresh")

    accessCommands(program, async () => system)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync([
            "node", "phresh", "window", "move", "--json",
            "--process", "one", "--x", "50%", "--y", "0"
        ])
    } finally {
        console.log = original
    }

    assert.deepEqual(calls, [
        ["find", "one"],
        ["move", { x: "50%", y: 0 }],
        ["disconnect"]
    ])
    assert.equal(written.length, 1)
    assert.deepEqual(JSON.parse(written[0]), {
        process: "one",
        title: "Example",
        header: true,
        frame: true,
        transaction: false,
        position: { x: 50, y: 0 },
        size: { width: 800, height: 600 },
        minimized: false, maximized: false,
        front: true,
        layer: "window"
    })
})

test("the command contract validates emitted data before selecting a representation", async function () {
    const program = new Command().exitOverride().name("phresh")

    defineCommand(program, {
        name: "example",
        description: "example",
        output: {
            format: "data",
            description: "example result",
            value: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false },
            presentation: { format: "fields", fields: [{ label: "Value", path: "value" }] }
        }
    }, async () => ({ value: 1 }))

    await assert.rejects(
        program.parseAsync(["node", "phresh", "example"]),
        /result\.value must be string/
    )
})

test("describe covers the actual command tree without contacting the System", async function () {

    const program = new Command().exitOverride().name("phresh")

    accessCommands(program)
    describeCommands(program)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync(["node", "phresh", "describe", "endpoint", "ask", "--json"])
    } finally {
        console.log = original
    }

    const described = JSON.parse(written[0])

    assert.deepEqual(described.path, ["endpoint", "ask"])
    assert.equal(described.name, "ask")
    assert.equal(described.options.find(option => option.flags === "--process <identity>").mandatory, true)
    assert.equal(described.options.find(option => option.flags === "--process <identity>").value, "required")
    assert.equal(described.options.find(option => option.flags === "--endpoint <endpoint>").mandatory, true)
    assert.equal(described.options.find(option => option.flags === "--event <event>").mandatory, true)
    assert.equal(described.options.some(option => option.flags.includes("--input")), false)
    assert.equal(described.requiresSystem, true)
    assert.equal(described.output.format, "data")
    assert.equal(described.output.presentation.format, "value")
    assert.ok(described.examples.length > 0)
})

test("execute accepts and returns the authoritative raw JSON contract", async function () {
    const program = new Command().exitOverride().name("phresh")
    const system = {
        execute(request) { return execute(this, request) },
        async disconnect() {}
    }
    accessCommands(program, async () => system)

    const written = []
    const original = console.log
    console.log = value => written.push(String(value))

    try {
        await program.parseAsync([
            "node", "phresh", "execute",
            JSON.stringify({ $domain: "operation", $operation: "list", domain: "endpoint" })
        ])
    }
    finally {
        console.log = original
    }

    const result = JSON.parse(written[0])
    assert(result.length > 0)
    assert(result.every(operation => operation.domain === "endpoint"))
})

test("every Execute operation has a flattened human-facing command", function () {
    const program = new Command().exitOverride().name("phresh")
    accessCommands(program, async () => { throw new Error("must not connect") })

    const expected = listExecuteOperations().map(operation => `${operation.domain}.${operation.operation}`).sort()
    assert.deepEqual(Object.keys(executeCommandPaths).sort(), expected)

    const registered = new Set(descendants(program).map(commandPath))
    for (const path of Object.values(executeCommandPaths)) {
        assert(registered.has(path.join(" ")), `Missing flattened command: ${path.join(" ")}`)
    }
})

test("program logs passes read-only SQL directly through Execute", async function () {
    const requests = []
    const system = {
        execute(request) {
            requests.push(request)
            return Promise.resolve([{ createdAt: 1, process: "main", source: "server", kind: "log", content: "ready" }])
        },
        async disconnect() {}
    }
    const program = new Command().exitOverride().name("phresh")
    accessCommands(program, async () => system)

    const written = []
    const original = console.log
    console.log = value => written.push(String(value))

    try {
        await program.parseAsync([
            "node", "phresh", "program", "logs", "--json",
            "--program", "terminal",
            "--statement", "select * from logs where process = ?",
            "--values", '["main"]'
        ])
    }
    finally {
        console.log = original
    }

    assert.deepEqual(requests, [{
        $domain: "program",
        $operation: "logs",
        identity: "terminal",
        statement: "select * from logs where process = ?",
        values: ["main"]
    }])
    assert.deepEqual(JSON.parse(written[0]), [{
        createdAt: 1,
        process: "main",
        source: "server",
        kind: "log",
        content: "ready"
    }])
})

test("the Program output contract excludes permission declarations", async function () {
    const program = new Command().exitOverride().name("phresh")
    accessCommands(program, async () => { throw new Error("must not connect") })
    describeCommands(program)

    const written = []
    const original = console.log
    console.log = value => written.push(value)

    try {
        await program.parseAsync(["node", "phresh", "describe", "program", "inspect", "--json"])
    }
    finally {
        console.log = original
    }

    const described = JSON.parse(written[0])
    const client = described.output.value.properties.client.anyOf.find(candidate => candidate.type === "object")
    assert.equal(Object.hasOwn(client.properties, "permissions"), false)
    assert.equal(client.required.includes("permissions"), false)
})

test("human collection output remains structured while JSON preserves complete data", async function () {
    const program = new Command().exitOverride().name("phresh")
    const output = {
        format: "data",
        description: "Programs",
        value: {
            type: "object",
            properties: {
                data: { type: "array", items: { type: "object", additionalProperties: true } },
                total: { type: "integer" },
                truncated: { type: "boolean" }
            },
            required: ["data", "total", "truncated"],
            additionalProperties: false
        },
        presentation: {
            format: "list",
            rows: "data",
            fields: [
                { label: "Name", path: "name" },
                { label: "Identity", path: "identity" },
                { label: "Version", path: "version" },
                { label: "Installed", path: "installed" },
                { label: "Description", path: "description" }
            ],
            item: "Program",
            items: "Programs",
            empty: "No matching Programs",
            total: "total",
            truncated: "truncated"
        }
    }
    const result = {
        data: [{
            name: "Terminal",
            identity: "terminal",
            version: "1.0.0",
            installed: true,
            description: "A deliberately long description that must wrap inside the available terminal width"
        }],
        total: 3,
        truncated: true
    }

    defineCommand(program, {
        name: "list",
        description: "list",
        options: [{ flags: "--json", description: "machine output" }],
        output
    }, async () => result)

    const written = []
    const originalLog = console.log
    console.log = value => written.push(String(value ?? ""))

    try {
        await program.parseAsync(["node", "phresh", "list"])
        const human = written.join("\n")
        assert.match(human, /Terminal/)
        assert.match(human, /1 of 3 Programs · more available/)
        assert.doesNotMatch(human, /…/)
        assert.equal(human.trimStart().startsWith("{"), false)

        written.length = 0
        await program.parseAsync(["node", "phresh", "list", "--json"])
        assert.equal(written.length, 1)
        assert.deepEqual(JSON.parse(written[0]), result)
    }
    finally {
        console.log = originalLog
    }
})

test("every System-access command is registered through the CLI contract", function () {
    const program = new Command().exitOverride().name("phresh")

    attachCommandContract(program, { name: "phresh", description: "test root" })
    accessCommands(program, async () => { throw new Error("must not connect") })
    describeCommands(program)

    assert.doesNotThrow(() => assertCommandContracts(program))
})

test("only boundary values without a native flag shape retain JSON syntax", function () {
    const program = new Command().exitOverride().name("phresh")

    accessCommands(program, async () => { throw new Error("must not connect") })

    const options = descendants(program).flatMap(command => command.options.map(option => ({
        path: commandPath(command),
        flags: option.flags
    })))

    assert.equal(options.some(option => option.flags.includes("--input")), false)
    assert.deepEqual(options.filter(option => option.flags.includes("<json>")), [
        { path: "program allowsPermission", flags: "--value <json>" },
        { path: "program allowPermission", flags: "--value <json>" },
        { path: "program requestPermission", flags: "--value <json>" },
        { path: "program logs", flags: "--values <json>" },
        { path: "endpoint ask", flags: "--payload <json>" },
        { path: "endpoint publish", flags: "--payload <json>" },
        { path: "service ask", flags: "--payload <json>" },
        { path: "service publish", flags: "--payload <json>" }
    ])
})

test("launch flags preserve complete Endpoint service choices", function () {
    const program = new Command().exitOverride().name("phresh")
    accessCommands(program, async () => { throw new Error("must not connect") })
    const flags = descendants(program).flatMap(command => command.options.map(option => option.flags))

    assert(flags.includes("--no-server-service"))
    assert(flags.includes("--no-client-service"))
    assert.equal(flags.some(flag => flag.includes("private")), false)
    assert.deepEqual(serverLaunch({ serverService: true }), { service: true })
    assert.deepEqual(serverLaunch({ serverService: false }), { service: false })
    assert.deepEqual(clientLaunch({ clientService: true, clientTitle: "Shared" }), {
        service: true,
        title: "Shared"
    })
    assert.deepEqual(launch({
        name: "main",
        serverService: false,
        clientService: true
    }), {
        name: "main",
        server: { service: false },
        client: { service: true }
    })
    assert.throws(() => serverLaunch({ server: false, serverService: false }), /--no-server/)
    assert.throws(() => clientLaunch({ client: false, clientService: true }), /--no-client/)
})

function descendants(command) {
    return command.commands.flatMap(child => [child, ...descendants(child)])
}

function commandPath(command) {
    const names = []
    let current = command
    while (current.parent?.parent) {
        names.unshift(current.name())
        current = current.parent
    }
    names.unshift(current.name())
    return names.join(" ")
}
