import { Project, type ProjectMode } from "@phreshos/node"
import type { SystemProcessRunEvent, SystemProgramEntity } from "@phreshos/core"
import { relative } from "node:path"
import { assertAvailable, commandFailure, DevelopmentClient, type DevelopmentEvent, waitForDevelopmentClient } from "./development-client.ts"
import { dim, heading, line } from "./style.ts"

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
  console.log("")

  const system = await (await import("@phreshos/node")).System.connect()
  const controller = new AbortController()
  const development = mode === "development" && definition.client && (definition.client.start ?? true)
    ? project.config.client?.development
    : undefined
  const command = development?.startCommand
  let client: DevelopmentClient | undefined
  let interrupted = false
  let ended: Ended | null = null
  let program: Awaited<ReturnType<typeof system.forceCreateProgram>> | null = null

  const stop = () => {
    if (interrupted) return
    interrupted = true
    controller.abort(new Error("The local Program run was interrupted"))
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, stop)

  try {
    if (command && development) {
      await assertAvailable(development.url)
      client = new DevelopmentClient(command, project.directory)
    }

    if (development) {
      for await (const event of waitForDevelopmentClient(development, client, controller.signal)) presentDevelopment(event)
    }

    if (mode === "production") await project.build()

    program = await system.forceCreateProgram(definition)

    ended = await consume(program.process.run({ options }, { signal: controller.signal }), client)
  } catch (error) {
    if (!interrupted) throw error
  } finally {
    controller.abort(new Error("The local Program run ended"))
    const cleanup = await Promise.allSettled([
      client?.stop(),
      program ? forget(program) : undefined
    ])
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, stop)
    await system.disconnect()

    const failure = cleanup.find(result => result.status === "rejected")
    if (failure?.status === "rejected") throw failure.reason
  }

  if (interrupted) process.exit(130)
  if (!ended) throw new Error("The System closed before the Program ended")

  console.log(`\n  ${dim(ended.signal ? `ended on ${ended.signal}` : `ended with ${ended.code ?? 0}`)}\n`)
  process.exit(ended.signal ? 128 : ended.code ?? 0)
}

async function consume(lifecycle: AsyncGenerator<SystemProcessRunEvent>, client?: DevelopmentClient): Promise<Ended> {
  const iterator = lifecycle[Symbol.asyncIterator]()
  let next = iterator.next()
  let developmentExit = client?.exited()
  let developmentOutput = client?.outputAvailable()
  let process: string | null = null
  let ending: Omit<Ended, "process"> | null = null

  while (true) {
    for (const event of client?.drain() ?? []) presentDevelopment(event)

    const outcome = await Promise.race([
      next.then(result => ({ source: "system" as const, result })),
      ...(developmentExit ? [developmentExit.then(result => ({ source: "client" as const, result }))] : []),
      ...(developmentOutput ? [developmentOutput.then(() => ({ source: "output" as const }))] : [])
    ])

    if (outcome.source === "output") {
      developmentOutput = client?.outputAvailable()
      continue
    }

    if (outcome.source === "client") {
      developmentExit = undefined
      if (!client?.endingWasRequested()) throw commandFailure(outcome.result)
      continue
    }

    if (outcome.result.done) break

    const event = outcome.result.value
    if (event.event === "started") {
      process = event.process.identity
      line("process", process)
    }
    else if (event.event === "output") write(event.stream, event.text)
    else ending = { code: event.exit.code, signal: event.exit.signal }

    next = iterator.next()
  }

  if (!process || !ending) throw new Error("The System ended the Program run without a complete Process lifecycle")

  return { process, ...ending }
}

function presentDevelopment(event: DevelopmentEvent) {
  if (event.event === "output") write(event.stream === "err" ? "stderr" : "stdout", event.text)
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
