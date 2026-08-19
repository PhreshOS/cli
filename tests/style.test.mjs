import assert from "node:assert/strict"
import test from "node:test"
import { heading } from "../dist/style.js"

test("heading does not add a second command-opening line", function () {

    const original = console.log
    const output = []

    console.log = value => output.push(value ?? "")

    try { heading("Phresh Program 0.1.3", "installed") }

    finally { console.log = original }

    assert.equal(output.length, 2)
    assert.match(output[0], /Phresh Program 0\.1\.3.*installed/)
    assert.equal(output[1], "")
})
