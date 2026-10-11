import { readConfig } from "./project.ts"
import { blank, dim, heading } from "./style.ts"
import writeProgramCommandOutput from "./program-command-output.ts"

/** Uninstall an installed Program by name or by the current project's identity. */
export default async function uninstall(options: UninstallOptions = {}) {

    const identity = options.name ?? (await readConfig(options.directory ?? process.cwd())).identity

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity)) throw new Error(`The Program name "${identity}" is invalid`)

    const system = await (await import("@phreshos/node")).System.connect()

    try {
      const program = await system.program.find(identity)

      if (!program) throw new Error("The System does not know this Program")

      for await (const chunk of program.uninstall({ purge: options.purge })) writeProgramCommandOutput(chunk)

      heading(identity, "uninstalled")

      console.log(options.purge

          ? `  ${dim("Its Processes ended; its installed files, data, and Program state were removed.")}`

          : `  ${dim("Its Processes ended and its installed files were removed. Its data and Program state stay for a later install.")}`)

      blank()
    }

    finally { await system.disconnect() }
}

export interface UninstallOptions {

    name?: string
    purge?: boolean
    directory?: string
}
