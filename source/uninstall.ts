import { readConfig } from "./project.ts"
import { dim, heading } from "./style.ts"
import { Gateway } from "@phreshos/node"
import writeProgramCommandOutput from "./program-command-output.ts"

/** Uninstall an installed Program by name or by the current project's identity. */
export default async function uninstall(options: UninstallOptions = {}) {

    const identity = options.name ?? (await readConfig(options.directory ?? process.cwd())).identity

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity)) throw new Error(`The Program name "${identity}" is invalid`)

    const gateway = await Gateway.open()

    try {
      for await (const event of gateway.uninstall(identity, { everything: options.everything === true })) {

        if (event.event === "output") return writeProgramCommandOutput(event)

        if (event.event !== "uninstalled") return

        heading(identity, "uninstalled")

        console.log(options.everything

            ? `  ${dim("Its processes, installed files, stored data, and runtime record were removed.")}\n`

            : `  ${dim("Its installed files were removed. Processes, stored data, and runtime state were kept.")}\n`)
      }
    }

    finally { await gateway.close() }
}

export interface UninstallOptions {

    name?: string
    everything?: boolean
    directory?: string
}
