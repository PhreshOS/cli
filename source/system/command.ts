import type { Command } from "commander"
import type { SystemStatus } from "./lifecycle.ts"
import SystemLifecycle from "./lifecycle.ts"
import prompts, { ReportedFailure } from "../prompts.ts"
import { accent, caution, dim, negative, positive } from "../style.ts"
import { defineCommand } from "../contract/command.ts"
import { textOutput } from "../commands/schemas.ts"

/** Attach the System lifecycle without mixing it with Program commands. */
export default function systemCommands(program: Command, provided?: SystemLifecycle) {

    let lifecycle = provided

    const current = (): SystemLifecycle => lifecycle ?? (lifecycle = new SystemLifecycle())

    const system = defineCommand(program, {
        name: "system",
        description: "install and manage the PhreshOS System",
        guidance: [
            "Choose one native System lifecycle operation.",
            "Running-System Programs, Processes, Endpoints, and Windows are top-level capabilities, not System subcommands."
        ]
    })

    defineCommand(system, lifecycleContract("install", "install or update the System and start its service"), async function () {

            const interaction = prompts()

            interaction.begin("Install System", "official stable release")

            const status = await interaction.progress("Installing PhreshOS", "PhreshOS installed", () => current().install())

            interaction.detail("desktop", accent(status.desktop))

            interaction.finish(`PhreshOS ${accent(status.installed?.version ?? "")} installed`)
        })

    defineCommand(system, lifecycleContract("uninstall", "remove the System installation and service"), async function () {

            const interaction = prompts()

            interaction.begin("Uninstall System")

            await interaction.progress("Removing PhreshOS", "PhreshOS removed", () => current().uninstall())

            interaction.message("Persistent System data was kept.")

            interaction.finish("System uninstalled")
        })

    defineCommand(system, lifecycleContract("status", "show the System version and operating state"), async function () {

            const status = await installed(current())

            const interaction = prompts()

            interaction.begin("System Status")

            report(interaction, status)

            interaction.finish(status.ready ? positive("System ready") : caution("System not ready"))
        })

    defineCommand(system, lifecycleContract("version", "show the installed System version"), async function () {

            const status = await installed(current())

            const interaction = prompts()

            interaction.begin("System Version")

            interaction.finish(`PhreshOS ${accent(status.installed.version)}`)
        })

    action(system, "start", "start the background service", current, lifecycle => lifecycle.start())

    action(system, "stop", "stop the background service", current, lifecycle => lifecycle.stop())

    action(system, "enable", "enable automatic startup", current, lifecycle => lifecycle.enable())

    action(system, "disable", "disable automatic startup", current, lifecycle => lifecycle.disable())

    return system
}

function action(system: Command, name: string, description: string, current: () => SystemLifecycle, work: (lifecycle: SystemLifecycle) => Promise<SystemStatus>) {

    defineCommand(system, lifecycleContract(name, description), async function () {

            const lifecycle = current()

            await installed(lifecycle)

            const interaction = prompts()

            interaction.begin(`System ${title(name)}`)

            const status = await interaction.progress(`${title(name)}ing PhreshOS`, `PhreshOS ${past(name)}`, () => work(lifecycle))

            if (name === "start") interaction.detail("desktop", accent(status.desktop))

            interaction.finish(`System ${past(name)}`)
        })
}

function lifecycleContract(name: string, description: string) {
    return {
        name,
        description,
        output: textOutput(description)
    }
}

function report(interaction: ReturnType<typeof prompts>, status: SystemStatus) {

    interaction.detail("version", accent(status.installed?.version ?? "unknown"))

    interaction.detail("desktop", accent(status.desktop))

    interaction.detail("service", service(status))

    interaction.detail("startup", status.automaticStartup ? status.enabled ? positive("enabled") : dim("disabled") : dim("unavailable"))
}

async function installed(lifecycle: SystemLifecycle): Promise<SystemStatus & { installed: NonNullable<SystemStatus["installed"]> }> {

    const status = await lifecycle.status()

    if (status.installed) return { ...status, installed: status.installed }

    const interaction = prompts()

    interaction.begin("PhreshOS System")

    interaction.warning("PhreshOS System is not installed")

    interaction.finish(`${dim("Install it with")} ${accent("phresh system install")}`)

    throw new ReportedFailure()
}

function service(status: SystemStatus) {

    if (status.ready) return positive("ready")

    if (status.running) return caution("starting")

    if (status.registered) return caution("stopped")

    return negative("not registered")
}

function title(value: string) {

    return `${value[0]?.toUpperCase()}${value.slice(1)}`
}

function past(value: string) {

    if (value === "stop") return "stopped"

    if (value === "enable") return "enabled"

    if (value === "disable") return "disabled"

    return "started"
}
