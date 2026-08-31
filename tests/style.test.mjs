import assert from "node:assert/strict"
import test from "node:test"
import { blank, failure, heading, line } from "../dist/style.js"

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

test("a detailed report keeps one opening separator and one closing blank line", function () {

    const original = console.log
    const output = []

    console.log = value => output.push(value ?? "")

    try {
        heading("Setup 0.1.30", "installed")
        line("process", "2446bd59-4226-4937-951c-00478beebe88")
        blank()
    }

    finally { console.log = original }

    assert.equal(output.length, 4)
    assert.match(output[0], /Setup 0\.1\.30.*installed/)
    assert.equal(output[1], "")
    assert.match(output[2], /process.*2446bd59-4226-4937-951c-00478beebe88/)
    assert.equal(output[3], "")
})

test("a failure adds no second opening blank line", function () {

    const original = console.error
    const output = []

    console.error = value => output.push(value ?? "")

    try { failure("No System is listening") }

    finally { console.error = original }

    assert.deepEqual(output, ["  phresh: No System is listening", ""])
})
