import { readConfig } from "./project.ts"
import { dim, heading } from "./style.ts"
import speak from "./program-intake.ts"

/** Uninstall the Program declared by the current project. */
export default async function uninstall(everything = false, directory = process.cwd()) {

    const config = await readConfig(directory)

    await speak({ word: "uninstall", identity: config.identity, everything }, function (event) {

        if (event.event !== "uninstalled") return

        heading(config.name ?? config.identity, "uninstalled")

        console.log(everything

            ? `  ${dim("Its processes, installed files, stored data, and runtime record were removed.")}\n`

            : `  ${dim("Its installed files were removed. Processes, stored data, and runtime state were kept.")}\n`)
    })
}
