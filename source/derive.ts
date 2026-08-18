import type { Config } from "@phreshos/core"
import { resolve } from "node:path"

/**
 * A Program's runtime description, composed from its authoring description.
 *
 * `phresh.config` is not a program's configuration; a program's
 * configuration is derived from it. Three times, and they differ only in
 * where each half is said to be:
 *
 *   pack          `server` or `client` — the canonical places the
 *                 package lays out for the system to install
 *   production    `location`, absolute — the built files, where they are
 *   development   the server at the project root; the client at its
 *                 required development URL
 *
 * Every program field crosses untouched.
 *
 * The paths are absolute and that is not tidiness: a program's relative
 * paths resolve against the program.json they were read from, and a
 * derived one does not live beside the source.
 */
export type Which = "production" | "development"

export default function derive(config: Config, directory: string, which: Which) {

    const server = serverHalf(config.server, which)

    const client = clientHalf(config.client, which)

    if (which === "development" && !config.server?.development && !config.client?.development) {

        // Where a `development` block is learned, now that nothing writes
        // one for you. It shows each half's distinct shape because their
        // development locations are deliberately not the same concept.
        throw new Error([

            "Nothing here says how this program is developed.",

            "",

            "Say how the server runs or where the client is served:",

            "",

            "    server: {",

            "        …",

            "        development: { startCommand: \"tsx source/server/main.ts\" }",

            "    }",

            "",

            "    client: {",

            "        …",

            "        development: { url: \"http://localhost:5173\", startCommand: \"bun run dev\" }",

            "    }"

        ].join("\n"))
    }

    return {

        identity: config.identity,

        name: config.name,

        version: config.version,

        description: config.description,

        // Like the icon, the document stays where the author put it for an
        // attached run. Installation and packaging give it its canonical
        // name; the runtime receives an absolute source path here because a
        // derived description has no file beside which to resolve it.
        apiDocs: config.apiDocs && resolve(directory, config.apiDocs),

        // Where it already is. Unlike pack, which gives it its canonical
        // name, this points into the authoring tree and leaves it alone.
        icon: config.icon && resolve(directory, config.icon),

        // Beside the source, and said out loud. A program built from an
        // object resolves what it leaves unsaid against the *system's*
        // working directory — so silence here means a program keeps what
        // it keeps wherever the system happened to be started, which is
        // nobody's idea of its own place.
        storage: resolve(directory, "storage"),

        ...server && { server: {

            location: resolve(directory, server.location),

            start: server.start,

            installCommand: config.server?.installCommand,

            startCommand: server.startCommand
        } },

        // A URL stands as written; a directory is made absolute. The
        // contract reads both from the one field, and which it is is
        // decided by the same test the system uses.
        ...client && { client: {

            location: /^https?:\/\//i.test(client.location) ? client.location : resolve(directory, client.location),

            start: client.start,

            title: config.client?.title,

            size: config.client?.size,

            position: config.client?.position,

            layer: config.client?.layer,

            minimize: config.client?.minimize
        } }
    }
}

// Only the fields each development shape owns are selected. Unknown
// runtime values do not become program fields merely because they were
// present in a JavaScript object.
function serverHalf(half: Config["server"], which: Which) {

    if (!half) return null

    const { development, ...declared } = half

    if (which === "production" || !development) return declared

    return {

        ...declared,

        location: ".",

        startCommand: development.startCommand
    }
}

function clientHalf(half: Config["client"], which: Which) {

    if (!half) return null

    const { development, ...declared } = half

    if (which === "production" || !development) return declared

    return {

        ...declared,

        location: development.url
    }
}
