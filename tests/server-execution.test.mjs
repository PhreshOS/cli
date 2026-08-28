import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import derive from "../dist/derive.js"
import pack from "../dist/pack.js"
import { readConfig } from "../dist/project.js"

test("derives one Server execution mode without retaining the other", function () {
  const directory = "/project"
  const config = {
    identity: "worker-program",
    server: {
      location: "dist/server",
      entryFile: "main.js",
      development: { startCommand: "tsx source/server/main.ts" }
    }
  }

  assert.deepEqual(derive(config, directory, "production").server, {
    location: "/project/dist/server",
    start: undefined,
    installCommand: undefined,
    uninstallCommand: undefined,
    entryFile: "main.js"
  })

  assert.deepEqual(derive(config, directory, "development").server, {
    location: "/project",
    start: undefined,
    installCommand: undefined,
    uninstallCommand: undefined,
    startCommand: "tsx source/server/main.ts"
  })
})

test("packages entryFile as the installable worker declaration", async function () {
  const directory = await mkdtemp(join(tmpdir(), "phresh-worker-package-"))

  try {
    await mkdir(join(directory, "server"))
    await writeFile(join(directory, "server", "main.js"), "export {}\n")
    await writeFile(join(directory, "package.json"), JSON.stringify({ name: "worker-package", version: "1.0.0", type: "module" }))
    await writeFile(join(directory, "phresh.config.ts"), `
type Execution = { location: string, entryFile: string }
const server: Execution = { location: "server", entryFile: "main.js" }
export default { identity: "worker-package", server } as const
`)

    const config = await readConfig(directory)

    assert.equal(config.server?.entryFile, "main.js")

    await pack(directory)

    const installed = JSON.parse(await readFile(join(directory, "program.json"), "utf8"))

    assert.deepEqual(installed.server, { location: "server", entryFile: "main.js" })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("rejects absent, conflicting, and escaping Server execution declarations", async function () {
  for (const [name, server] of [
    ["absent", { location: "server" }],
    ["conflicting", { location: "server", startCommand: "node main.js", entryFile: "main.js" }],
    ["escaping", { location: "server", entryFile: "../main.js" }]
  ]) {
    const directory = await mkdtemp(join(tmpdir(), `phresh-worker-${name}-`))

    try {
      await writeFile(join(directory, "phresh.config.ts"), `export default ${JSON.stringify({ identity: `${name}-worker`, server })}\n`)
      await assert.rejects(readConfig(directory))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
})
