import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import metadata from "../package.json" with { type: "json" }

const repository = resolve(import.meta.dirname, "..")

const temporary = await mkdtemp(join(tmpdir(), "phresh-cli-package-"))

const npm = process.platform === "win32"

    ? { command: process.execPath, prefix: [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] }

    : { command: "npm", prefix: [] }

let archive

try {

    const packed = JSON.parse(execFileSync(npm.command, [...npm.prefix, "pack", "--json", "--ignore-scripts"], { cwd: repository, encoding: "utf8" }))

    const artifact = packed[0]

    assert.equal(artifact.name, metadata.name)

    assert.equal(artifact.version, metadata.version)

    archive = join(repository, artifact.filename)

    const files = artifact.files.map(file => file.path)

    assert.ok(files.includes("dist/system/lifecycle.js"))

    assert.ok(files.includes("dist/system/service/macos.js"))

    assert.ok(files.includes("dist/system/service/linux.js"))

    assert.ok(files.includes("dist/system/service/background.js"))

    assert.ok(files.includes("dist/system/service/systemd.js"))

    assert.ok(files.includes("dist/system/service/windows.js"))

    assert.ok(files.includes("dist/system/service/windows-runner.js"))

    assert.equal(files.some(file => file.startsWith("source/") || file.startsWith("tests/") || file.startsWith("scripts/")), false)

    execFileSync(npm.command, [...npm.prefix, "install", archive, "--no-audit", "--no-fund"], { cwd: temporary, stdio: "pipe" })

    const cli = join(temporary, "node_modules", "@phreshos", "cli", "dist", "cli.js")

    const version = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" })

    assert.equal(version.trim(), metadata.version)

    assert.match(version, /\n\n$/)

    const help = execFileSync(process.execPath, [cli, "system", "--help"], { encoding: "utf8" })

    for (const word of ["install", "uninstall", "status", "version", "start", "stop", "enable", "disable"]) assert.match(help, new RegExp(`\\b${word}\\b`))

    assert.match(help, /\n\n$/)

    const installHelp = execFileSync(process.execPath, [cli, "install", "--help"], { encoding: "utf8" })

    assert.match(installHelp, /\[name\]/)

    assert.match(installHelp, /--run/)

    assert.match(installHelp, /--startup/)

    const created = join(temporary, "created")

    execFileSync(process.execPath, [cli, "create", created, "--name", "Created Program", "--package-manager", "npm", "--no-install"], { cwd: temporary, stdio: "pipe" })

    const manifest = JSON.parse(await readFile(join(created, "package.json"), "utf8"))

    assert.equal(manifest.name, "created")

    assert.equal(manifest.devDependencies[metadata.name], `^${metadata.version}`)

    console.log(`Verified ${metadata.name}@${metadata.version} as an installed package`)
}

finally {

    if (archive) await rm(archive, { force: true })

    await rm(temporary, { recursive: true, force: true })
}
