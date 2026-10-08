import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { test } from "vitest"
import { skill } from "../dist/commands/skill.js"

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url))

const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" })

function paths(node, into = []) {
    into.push(node.path.join(" "))
    for (const child of node.commands ?? []) paths(child, into)
    return into
}

test("the root help sends agents to the skill, and the skill prints without a System", () => {
    assert.match(run("--help"), /Agents: run phresh skill first/)
    assert.equal(run("skill").trim(), skill.trim())
})

test("every command the skill names exists, so the skill cannot drift from the CLI", () => {
    const known = new Set(paths(JSON.parse(run("describe", "--all", "--json"))))
    const named = [...skill.matchAll(/phresh ((?:[a-z][a-z-]*)(?: [a-z][a-z-]*)?)/g)].map(match => match[1])
    assert.ok(named.length > 5)
    for (const name of named) {
        const words = name.split(" ")
        assert.ok(known.has(name) || known.has(words[0]), `phresh ${name} is not a command`)
    }
})

test("the skill points to the documentation for building Programs", () => {
    assert.match(skill, /https:\/\/phreshos\.com\/docs/)
    assert.match(skill, /https:\/\/phreshos\.com\/llms\.txt/)
})
