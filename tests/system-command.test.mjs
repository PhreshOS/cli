import assert from "node:assert/strict"
import { Command } from "commander"
import test from "node:test"
import { ReportedFailure } from "../dist/prompts.js"
import systemCommands from "../dist/system/command.js"

const absent = {

    async status() {

        return state()
    }
}

test("every unavailable System command gives the same concise installation direction", async function () {

    let expected

    for (const name of ["status", "version", "start", "stop", "enable", "disable"]) {

        const { output, error } = await run(name, absent)

        assert.ok(error instanceof ReportedFailure)

        expected ??= output

        assert.equal(output, expected)

        assert.match(output, /PhreshOS System is not installed/)

        assert.match(output, /phresh system install/)
    }
})

test("System status reports only its version, service, and startup state", async function () {

    const lifecycle = {

        async status() {

            return state({

                installed: { version: "0.1.0", digest: "a".repeat(64), directory: "/system", installedAt: "now" },

                registered: true,

                enabled: true,

                running: true,

                ready: true,

                pid: 123
            })
        }
    }

    const { output, error } = await run("status", lifecycle)

    assert.equal(error, undefined)

    assert.match(output, /version\s+0\.1\.0/)

    assert.match(output, /service\s+ready/)

    assert.match(output, /startup\s+enabled/)

    for (const hidden of ["installation", "process", "intake", "files", "log", "123", "/system"]) assert.doesNotMatch(output, new RegExp(hidden))

    const lines = output.split("\n")

    assert.equal(lines.slice(0, -1).includes(""), false)

    assert.equal(lines.at(-1), "")
})

test("System version returns the installed System release", async function () {

    const lifecycle = {

        async status() {

            return state({ installed: { version: "0.1.0", digest: "a".repeat(64), directory: "/system", installedAt: "now" } })
        }
    }

    const { output, error } = await run("version", lifecycle)

    assert.equal(error, undefined)

    assert.match(output, /PhreshOS 0\.1\.0/)
})

async function run(name, lifecycle) {

    const program = new Command().exitOverride()

    program.name("phresh")

    systemCommands(program, lifecycle)

    const written = []

    const original = console.log

    console.log = (...values) => written.push(values.join(" "))

    let error

    try {

        await program.parseAsync(["node", "phresh", "system", name])
    }

    catch (caught) {

        error = caught
    }

    finally {

        console.log = original
    }

    return { output: written.join("\n"), error }
}

function state(overrides = {}) {

    return {

        registered: false,

        enabled: false,

        running: false,

        ready: false,

        root: "/system",

        intake: "/state/intake.sock",

        log: "/state/service.log",

        ...overrides
    }
}
