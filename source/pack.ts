import { Project } from "@phreshos/gateway"
import { line } from "./style.ts"

/** Package the current Project and present only its command-facing progress. */
export default async function pack(directory = process.cwd()) {
    const project = await Project.open(directory)

    if (project.config.buildCommand) line("build", project.config.buildCommand)

    const packed = await project.pack()

    console.log(`\nPacked ${packed.archive}`)

    return packed.archive
}
