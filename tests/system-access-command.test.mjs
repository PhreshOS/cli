import assert from "node:assert/strict"
import { Command } from "commander"
import test from "node:test"
import accessCommands from "../dist/commands/access.js"
import describeCommands from "../dist/commands/describe.js"
import { gatewayPath } from "../dist/gateway.js"
import { clientLaunch, launch, serverLaunch } from "../dist/commands/input.js"
import { assertCommandContracts, attachCommandContract, defineCommand } from "../dist/contract/command.js"
import { join } from "node:path"

test("the selected home has one owner-local gateway", function () {

    assert.equal(gatewayPath("/Users/person/.phreshos", "linux"), join("/Users/person", ".phreshos", "gateway.sock"))
    assert.equal(gatewayPath("/state", "linux"), join("/state", "gateway.sock"))
})

test("running-System commands use shared handles and explicit flags", async function () {

    const calls = []
    const window = {
        async move(position) { calls.push(["move", position]) },
        async title() { return "Example" },
        async position() { return { x: 50, y: 0 } },
        async size() { return { width: 800, height: 600 } },
        async minimized() { return false },
        async front() { return true },
        async layer() { return "window" },
        async location() { return "/" }
    }
    const process = {
        identity: "one",
        client: { window }
    }
    const system = {
        process: { async find(identity) { calls.push(["find", identity]); return process } },
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
        position: { x: 50, y: 0 },
        size: { width: 800, height: 600 },
        minimized: false,
        front: true,
        layer: "window",
        location: "/"
    })
})

test("the command contract validates emitted JSON before writing it", async function () {
    const program = new Command().exitOverride().name("phresh")

    defineCommand(program, {
        name: "example",
        description: "example",
        output: {
            format: "json",
            description: "example result",
            value: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false }
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
    assert.equal(described.output.format, "json")
    assert.ok(described.examples.length > 0)
})

test("every System-access command is registered through the CLI contract", function () {
    const program = new Command().exitOverride().name("phresh")

    attachCommandContract(program, { name: "phresh", description: "test root" })
    accessCommands(program, async () => { throw new Error("must not connect") })
    describeCommands(program)

    assert.doesNotThrow(() => assertCommandContracts(program))
})

test("only arbitrary Endpoint payloads retain JSON syntax", function () {
    const program = new Command().exitOverride().name("phresh")

    accessCommands(program, async () => { throw new Error("must not connect") })

    const options = descendants(program).flatMap(command => command.options.map(option => ({
        path: commandPath(command),
        flags: option.flags
    })))

    assert.equal(options.some(option => option.flags.includes("--input")), false)
    assert.deepEqual(options.filter(option => option.flags.includes("<json>")), [
        { path: "endpoint ask", flags: "--payload <json>" },
        { path: "endpoint publish", flags: "--payload <json>" }
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
