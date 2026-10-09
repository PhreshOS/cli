import type { Command } from "commander"
import { createInterface } from "node:readline"
import { Writable } from "node:stream"
import { defineCommand } from "../contract/command.ts"
import { value } from "../contract/schema.ts"
import type { CommonOptions } from "./input.ts"
import { option, withJson } from "./options.ts"
import { dataOutput, valuePresentation } from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { executeDescription } from "./execution.ts"

export default function authenticationCommands(root: Command, connect: ConnectSystem) {
    const authentication = defineCommand(root, {
        name: "authentication",
        description: "the owner's username and password, and signing out everywhere",
        guidance: [
            "There is one owner. New credentials apply to the next sign-in; browsers already signed in stay signed in.",
            "Change credentials or sign everyone out only when the owner asks."
        ]
    })

    defineCommand<CommonOptions>(authentication, {
        name: "state",
        description: executeDescription("authentication", "state"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.any("sign-in identity"), "The owner's username", valuePresentation),
        examples: ["phresh authentication state   # the owner's username"]
    }, () => connected(connect, system => system.execute({ $domain: "authentication", $operation: "state" })))

    defineCommand<CommonOptions>(authentication, {
        name: "requirements",
        description: executeDescription("authentication", "requirements"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.any("credential lengths"), "The lengths this System accepts", valuePresentation),
        examples: ["phresh authentication requirements   # the lengths a username and password must have"]
    }, () => connected(connect, system => system.execute({ $domain: "authentication", $operation: "requirements" })))

    defineCommand<CredentialOptions>(authentication, {
        name: "setCredentials",
        aliases: ["set-credentials"],
        description: executeDescription("authentication", "setCredentials"),
        requiresSystem: true,
        options: withJson(option("--username <name>", "new username", { mandatory: true })),
        output: dataOutput(value.nullable(value.any("nothing")), "The credentials are replaced", valuePresentation),
        // The password never appears in the command, where shell history and process lists would keep it.
        examples: ["phresh authentication set-credentials --username owner   # asks for the new password in the terminal", "printf '%s' \"$PASSWORD\" | phresh authentication set-credentials --username owner   # the same, the password read from standard input"]
    }, async ({ options }) => {
        const password = await secret()
        return connected(connect, system => system.execute({ $domain: "authentication", $operation: "setCredentials", username: options.username, password }))
    })

    defineCommand<CommonOptions>(authentication, {
        name: "signOutAll",
        aliases: ["sign-out-all"],
        description: executeDescription("authentication", "signOutAll"),
        requiresSystem: true,
        options: withJson(),
        output: dataOutput(value.nullable(value.any("nothing")), "Every Session has ended", valuePresentation),
        examples: ["phresh authentication sign-out-all   # signs out every browser, the owner's too; ask first"]
    }, () => connected(connect, system => system.execute({ $domain: "authentication", $operation: "signOutAll" })))
}

/** Reads the new password: typed twice without echo in a terminal, or once from piped input. */
async function secret() {
    if (!process.stdin.isTTY) {
        let text = ""
        for await (const chunk of process.stdin) text += chunk
        return text.replace(/\r?\n$/, "")
    }
    const first = await hidden("New password: ")
    if (await hidden("Again: ") !== first) throw new Error("The passwords do not match")
    return first
}

async function hidden(prompt: string) {
    process.stderr.write(prompt)
    const silent = new Writable({ write(_chunk, _encoding, done) { done() } })
    const reader = createInterface({ input: process.stdin, output: silent, terminal: true })
    try { return await new Promise<string>(resolve => reader.question("", resolve)) }
    finally {
        reader.close()
        process.stderr.write("\n")
    }
}

type CredentialOptions = CommonOptions & Readonly<{ username: string }>
