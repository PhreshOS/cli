import assert from "node:assert/strict"
import { Command } from "commander"
import test from "node:test"
import controlCommands from "../dist/system/control/command.js"
import { controlPath } from "../dist/system/control/client.js"
import { join } from "node:path"

test("System control follows the selected owner-local storage root", function () {
    assert.equal(controlPath({}, "/Users/person"), join("/Users/person", ".phreshos", "control.sock"))
    assert.equal(controlPath({ PHRESHOS_HOME: "/state" }, "/Users/person"), join("/state", "control.sock"))
})

test("System control commands follow the Core capability hierarchy", async function () {

    const calls = []
    const client = {
        async execute(request) {
            calls.push(request)
            return { moved: true }
        }
    }
    const program = new Command().exitOverride().name("phresh")
    const system = program.command("system")

    controlCommands(system, client)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync([
            "node", "phresh", "system", "window", "move", "--compact", "--input",
            JSON.stringify({ process: "one", position: { x: "50%", y: 0 } })
        ])
    } finally {
        console.log = original
    }

    assert.deepEqual(calls, [{
        capability: "window",
        operation: "move",
        input: { process: "one", position: { x: "50%", y: 0 } }
    }])
    assert.deepEqual(written, [JSON.stringify({ moved: true })])
})

test("System describe exposes schemas without contacting a running System", async function () {

    const program = new Command().exitOverride().name("phresh")
    const system = program.command("system")

    controlCommands(system)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync(["node", "phresh", "system", "describe", "endpoint", "ask", "--compact"])
    } finally {
        console.log = original
    }

    const described = JSON.parse(written[0])

    assert.equal(described.capability, "endpoint")
    assert.equal(described.operation, "ask")
    assert.equal(described.mode, "request")
    assert.deepEqual(described.input.required, ["process", "endpoint", "event"])
})
