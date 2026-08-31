import assert from "node:assert/strict"
import { Command } from "commander"
import test from "node:test"
import controlCommands from "../dist/control/command.js"
import describeCommands from "../dist/describe-command.js"
import { gatewayPath } from "../dist/gateway.js"
import { clientLaunch, launch, serverLaunch } from "../dist/control/shared.js"
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

    controlCommands(program, async () => system)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync([
            "node", "phresh", "window", "move", "--compact",
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

test("describe covers the actual command tree without contacting the System", async function () {

    const program = new Command().exitOverride().name("phresh")

    controlCommands(program)
    describeCommands(program)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync(["node", "phresh", "describe", "endpoint", "ask", "--compact"])
    } finally {
        console.log = original
    }

    const described = JSON.parse(written[0])

    assert.deepEqual(described.path, ["endpoint", "ask"])
    assert.equal(described.name, "ask")
    assert.equal(described.options.find(option => option.flags === "--process <identity>").value, "required")
    assert.equal(described.options.find(option => option.flags === "--endpoint <endpoint>").value, "required")
    assert.equal(described.options.find(option => option.flags === "--event <event>").value, "required")
    assert.equal(described.options.some(option => option.flags.includes("--input")), false)
})

test("only arbitrary Endpoint payloads retain JSON syntax", function () {
    const program = new Command().exitOverride().name("phresh")

    controlCommands(program, async () => { throw new Error("must not connect") })

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
    assert.deepEqual(serverLaunch({ serverService: true }), { service: true })
    assert.deepEqual(serverLaunch({ serverPrivate: true }), { service: false })
    assert.deepEqual(clientLaunch({ clientService: true, clientTitle: "Shared" }), {
        service: true,
        title: "Shared"
    })
    assert.deepEqual(launch({
        name: "main",
        serverPrivate: true,
        clientService: true
    }), {
        name: "main",
        server: { service: false },
        client: { service: true }
    })
    assert.throws(() => serverLaunch({ serverService: true, serverPrivate: true }), /both a Service and private/)
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
