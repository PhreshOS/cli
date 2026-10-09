import assert from "node:assert/strict"
import { test } from "vitest"
import { fetchSystem, renderFetch } from "../dist/commands/fetch.js"

const colors = {
    background: "#fbf8f4", foreground: "#2b211a", default: "#fffdfa", primary: "#f5b37d", secondary: "#3f7de0",
    success: "#3f9a4e", warning: "#d99a1e", danger: "#d8483b", info: "oklch(0.7 0.1 200)"
}

function fakeSystem(calls) {
    const program = startup => ({ startup: { async get() { return startup } } })
    const process = running => ({ client: { async running() { return running } } })
    return {
        async about() { return { name: "PhreshOS", version: "1.0.0", release: { name: "Sprout", program: "sprout" }, startedAt: new Date("2026-09-30T08:00:00.000Z") } },
        authentication: {
            async state() { return { username: "owner" } },
            async connections() { return [{}] },
            async sessions() { return [{}, {}] }
        },
        program: { async list(options) { calls.push(options); return [program({}), program(null), program(null)] } },
        process: { async list() { return [process(true), process(false)] } },
        appearance: { async snapshot() { return { wallpapers: { light: { signIn: "sign-in-light.webp", desktop: "meadow.jpg" }, dark: { signIn: "sign-in-dark.webp", desktop: "desktop-dark.webp" } }, colors: { light: colors, dark: colors } } } },
        async disconnect() { calls.push("disconnect") }
    }
}

test("fetch reads the System through one connection and counts what runs", async () => {
    const calls = []
    const fetched = await fetchSystem(async () => fakeSystem(calls))
    assert.deepEqual(calls, [{ installed: true }, "disconnect"])
    assert.equal(fetched.username, "owner")
    assert.deepEqual(fetched.programs, { installed: 3, startup: 1 })
    assert.deepEqual(fetched.processes, { running: 2, windows: 1 })
    assert.deepEqual(fetched.connections, { desktops: 1, sessions: 2 })
})

test("fetch shows the logo beside the report, and colors only where the terminal draws them", async () => {
    const fetched = await fetchSystem(async () => fakeSystem([]))
    const plain = renderFetch(fetched, false, Date.parse("2026-09-30T08:00:30.000Z"))
    assert.doesNotMatch(plain, /\x1b\[/)
    const lines = plain.split("\n")
    assert.match(lines[0], /▄.*owner@PhreshOS$/)
    const column = lines[0].indexOf("owner")
    assert.ok(lines.slice(2, 8).every(line => line.indexOf(line.trim().split(/\s{2,}/).at(-1)) >= column))
    assert.match(plain, /System {5}PhreshOS 1\.0\.0 · Sprout/)
    assert.match(plain, /Processes  2 running · 1 Window$/m)
    assert.match(plain, /Uptime {5}less than a minute/)
    const later = Date.parse("2026-10-02T11:05:00.000Z")
    assert.match(renderFetch(fetched, false, later), /Uptime {5}2 days, 3 hours$/m)
    assert.match(plain, /Wallpaper  meadow\.jpg · desktop-dark\.webp/)

    const painted = renderFetch(fetched, true)
    // Nine colors in each theme; the one that is not hex is left out.
    const blocks = painted.split("\n").slice(-2).map(line => (line.match(/███/g) ?? []).length)
    assert.deepEqual(blocks, [8, 8])
})
