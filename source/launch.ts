import { Project, type ProjectMode } from "@phreshos/node"
import type { SystemProcessRunEvent, SystemProgramEntity } from "@phreshos/core"
import { relative } from "node:path"
import { blank, dim, heading, line } from "./style.ts"

/** Run the current project through one connected System. */
export default async function launch(mode: ProjectMode, directory = process.cwd(), options: Record<string, string> = {}) {
  const project = await Project.open(directory)
  const definition = mode === "development" ? project.developmentDefinition() : project.productionDefinition()

  heading(`${definition.name ?? definition.identity}${definition.version ? ` ${definition.version}` : ""}`, mode)
  if (mode === "production" && project.config.buildCommand) line("build", project.config.buildCommand)
  if (definition.server) line(definition.server.startCommand ? "server" : "server worker", String(definition.server.startCommand ?? definition.server.entryFile), place(project.directory, definition.server.location))
  if (definition.client) line("client", project.config.client?.development?.startCommand ?? place(project.directory, definition.client.location))
  line("storage", place(project.directory, String(definition.storage)))
  if (Object.keys(options).length) line("options", Object.entries(options).map(([name, value]) => `${name}=${value}`).join("  "))
  blank()

  const system = await (await import("@phreshos/node")).System.connect()
  const controller = new AbortController()
  let interrupted = false
  let ended: Ended | null = null
  let attached = false

  const stop = () => {
    if (interrupted) return
    interrupted = true
    controller.abort(new Error("The local Program run was interrupted"))
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, stop)

  try {
    const lifecycle = mode === "development"
      ? await project.dev(system, { options, signal: controller.signal })
      : await project.start(system, { options, signal: controller.signal })

    attached = true
    ended = await consume(lifecycle)
  } catch (error) {
    if (!interrupted) throw error
  } finally {
    controller.abort(new Error("The local Program run ended"))
    let cleanupFailure: unknown

    try {
      const program = attached ? await system.program.find(definition.identity) : null
      if (program) await forget(program)
    } catch (error) { cleanupFailure = error }

    try { await system.disconnect() }
    catch (error) { cleanupFailure ??= error }

    for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, stop)
    if (cleanupFailure) throw cleanupFailure
  }

  if (interrupted) process.exit(130)
  if (!ended) throw new Error("The System closed before the Program ended")

  blank()
  console.log(`  ${dim(ended.signal ? `ended on ${ended.signal}` : `ended with ${ended.code ?? 0}`)}`)
  blank()
  process.exit(ended.signal ? 128 : ended.code ?? 0)
}

async function consume(lifecycle: AsyncGenerator<SystemProcessRunEvent>): Promise<Ended> {
  let process: string | null = null
  let ending: Omit<Ended, "process"> | null = null

  for await (const event of lifecycle) {
    if (event.event === "started") {
      process = event.process.identity
      line("process", process)
    }
    else if (event.event === "output") write(event.stream, event.text)
    else ending = { code: event.exit.code, signal: event.exit.signal }
  }

  if (!process || !ending) throw new Error("The System ended the Program run without a complete Process lifecycle")

  return { process, ...ending }
}

function write(stream: "stdout" | "stderr", text: string) {
  (stream === "stderr" ? process.stderr : process.stdout).write(text)
}

async function forget(program: SystemProgramEntity) {
  try { await program.forget() }
  catch (error) {
    if (error instanceof Error && error.message === "The Program represented by this handle does not exist") return
    throw error
  }
}

function place(directory: string, location: string) {
  return /^https?:\/\//i.test(location) ? location : `./${relative(directory, location)}`
}

interface Ended {
  process: string
  code: number | null
  signal: string | null
}
