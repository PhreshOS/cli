import { Project, type ProjectMode } from "@phreshos/node"
import { relative } from "node:path"
import { dim, heading, line } from "./style.ts"

/** Run the current project through one connected System. */
export default async function launch(mode: ProjectMode, directory = process.cwd(), options: Record<string, string> = {}) {
  const project = await Project.open(directory)
  const program = project.description(mode)

  heading(`${program.name ?? program.identity}${program.version ? ` ${program.version}` : ""}`, mode)
  if (mode === "production" && project.config.buildCommand) line("build", project.config.buildCommand)
  if (program.server) line(program.server.startCommand ? "server" : "server worker", String(program.server.startCommand ?? program.server.entryFile), place(project.directory, program.server.location))
  if (program.client) line("client", project.config.client?.development?.startCommand ?? place(project.directory, program.client.location))
  line("storage", place(project.directory, String(program.storage)))
  if (Object.keys(options).length) line("options", Object.entries(options).map(([name, value]) => `${name}=${value}`).join("  "))
  console.log("")

  const system = await (await import("@phreshos/node")).System.connect()
  const controller = new AbortController()
  let interrupted = false
  let ended: Ended | null = null

  const stop = () => {
    if (interrupted) return
    interrupted = true
    controller.abort(new Error("The local Program run was interrupted"))
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, stop)

  try {
    const result = mode === "development"
      ? await project.dev(system, { options, signal: controller.signal })
      : await project.start(system, { options, signal: controller.signal })

    console.log(`\n  ${dim("ran as")} ${result.process.identity}`)
    ended = { code: result.exit.code, signal: result.exit.signal }
  } catch (error) {
    if (!interrupted) throw error
  } finally {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, stop)
    await system.disconnect()
  }

  if (interrupted) process.exit(130)
  if (!ended) throw new Error("The System closed before the Program ended")

  console.log(`\n  ${dim(ended.signal ? `ended on ${ended.signal}` : `ended with ${ended.code ?? 0}`)}\n`)
  process.exit(ended.signal ? 128 : ended.code ?? 0)
}

function place(directory: string, location: string) {
  return /^https?:\/\//i.test(location) ? location : `./${relative(directory, location)}`
}

interface Ended {
  code: number | null
  signal: string | null
}
