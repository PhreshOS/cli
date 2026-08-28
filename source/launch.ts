import { Gateway, Project, type GatewayEvent, type ProjectMode } from "@phreshos/node"
import { relative } from "node:path"
import { dim, heading, line } from "./style.ts"

/** Run the current project attached to the System and present its event stream. */
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

  const gateway = await Gateway.open()
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
    const events = mode === "development"
      ? gateway.dev(project, { options, signal: controller.signal })
      : gateway.start(project, { options, signal: controller.signal })

    for await (const event of events) ended = present(event) ?? ended
  } catch (error) {
    if (!interrupted) throw error
  } finally {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, stop)
    await gateway.close()
  }

  if (interrupted) process.exit(130)
  if (!ended) throw new Error("The System closed before the Program ended")

  console.log(`\n  ${dim(ended.signal ? `ended on ${ended.signal}` : `ended with ${ended.code ?? 0}`)}\n`)
  process.exit(ended.signal ? 128 : ended.code ?? 0)
}

function present(event: GatewayEvent): Ended | null {
  if (event.event === "started") console.log(`  ${dim("running as")} ${String(event.process)}\n`)
  else if (event.event === "waiting") line("waiting for", String(event.url))
  else if (event.event === "output") (event.stream === "err" ? process.stderr : process.stdout).write(String(event.text))
  else if (event.event === "exited") return {
    code: typeof event.code === "number" ? event.code : null,
    signal: typeof event.signal === "string" ? event.signal : null
  }
  return null
}

function place(directory: string, location: string) {
  return /^https?:\/\//i.test(location) ? location : `./${relative(directory, location)}`
}

interface Ended {
  code: number | null
  signal: string | null
}
