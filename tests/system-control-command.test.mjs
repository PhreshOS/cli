import assert from "node:assert/strict"
import { Command } from "commander"
import test from "node:test"
import controlCommands from "../dist/control-command.js"
import describeCommands from "../dist/describe-command.js"
import { gatewayPath } from "../dist/gateway.js"
import { join } from "node:path"

test("the selected home has one owner-local gateway", function () {

    assert.equal(gatewayPath("/Users/person/.phreshos", "linux"), join("/Users/person", ".phreshos", "gateway.sock"))
    assert.equal(gatewayPath("/state", "linux"), join("/state", "gateway.sock"))
})

test("running-System capabilities are top-level commands", async function () {

    const calls = []
    const client = {
        async execute(request) {
            calls.push(request)
            return { moved: true }
        }
    }
    const program = new Command().exitOverride().name("phresh")

    controlCommands(program, client)

    const written = []
    const original = console.log

    console.log = value => written.push(value)

    try {
        await program.parseAsync([
            "node", "phresh", "window", "move", "--compact", "--input",
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
    assert.equal(described.capability.mode, "request")
    assert.deepEqual(described.capability.input.required, ["process", "endpoint", "event"])
})
