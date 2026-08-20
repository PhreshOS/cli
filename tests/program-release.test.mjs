import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import test from "node:test"
import AdmZip from "adm-zip"
import { prepareOfficialProgram, resolveOfficialProgramRelease, selectProgramRelease } from "../dist/program-release.js"

test("selects the newest complete stable Program release", function () {

    const selected = selectProgramRelease([

        release("v0.1.0"),

        release("v0.2.0", { prerelease: true }),

        release("v0.1.2"),

        release("v0.1.3", { assets: [] })
    ])

    assert.equal(selected.version, "0.1.2")
})

test("verifies and prepares an official Program package", async function () {

    const archive = new AdmZip()

    archive.addFile("program.json", Buffer.from(JSON.stringify({

        identity: "setup",

        name: "Setup",

        version: "0.1.0",

        client: { location: "client" }
    })))

    archive.addFile("client/index.html", Buffer.from("<!doctype html>"))

    const bytes = archive.toBuffer()

    const digest = createHash("sha256").update(bytes).digest("hex")

    const prepared = await prepareOfficialProgram("setup", async url => {

        const address = String(url)

        if (address.includes("/releases?")) return Response.json([release("v0.1.0")])

        if (address.endsWith(".sha256")) return new Response(`${digest}  setup@0.1.0.zip\n`)

        return new Response(bytes)
    })

    const program = prepared.program

    assert.equal(program.identity, "setup")

    assert.equal(program.version, "0.1.0")

    assert.equal(existsSync(program.client.location), true)

    const location = program.client.location

    await prepared.dispose()

    assert.equal(existsSync(location), false)
})

test("derives the official repository and release identity from its assets", async function () {

    let requested

    const selected = await resolveOfficialProgramRelease("phresh", async url => {

        requested = String(url)

        return Response.json([release("v0.1.2", {

            assets: [

                { name: "phresh-program@0.1.2.zip", browser_download_url: "https://example.test/phresh-program@0.1.2.zip" },

                { name: "phresh-program@0.1.2.zip.sha256", browser_download_url: "https://example.test/phresh-program@0.1.2.zip.sha256" }
            ]
        })])
    })

    assert.equal(requested, "https://api.github.com/repos/PhreshOS/phresh-program/releases?per_page=100")

    assert.equal(selected.identity, "phresh-program")

    assert.equal(selected.version, "0.1.2")
})

test("derives Flambo from the Program repository convention", async function () {

    let requested

    const selected = await resolveOfficialProgramRelease("flambo", async url => {

        requested = String(url)

        return Response.json([release("v0.1.0", {

            assets: [

                { name: "flambo@0.1.0.zip", browser_download_url: "https://example.test/flambo@0.1.0.zip" },

                { name: "flambo@0.1.0.zip.sha256", browser_download_url: "https://example.test/flambo@0.1.0.zip.sha256" }
            ]
        })])
    })

    assert.equal(requested, "https://api.github.com/repos/PhreshOS/flambo-program/releases?per_page=100")

    assert.equal(selected.identity, "flambo")

    assert.equal(selected.version, "0.1.0")
})

test("rejects names that cannot identify an official Program repository", async function () {

    await assert.rejects(

        resolveOfficialProgramRelease("../flambo", async () => { throw new Error("fetch must not run") }),

        /official Program name/
    )
})

function release(tag, overrides = {}) {

    const version = tag.slice(1)

    return {

        tag_name: tag,

        draft: false,

        prerelease: false,

        assets: [

            { name: `setup@${version}.zip`, browser_download_url: `https://example.test/setup@${version}.zip` },

            { name: `setup@${version}.zip.sha256`, browser_download_url: `https://example.test/setup@${version}.zip.sha256` }
        ],

        ...overrides
    }
}
