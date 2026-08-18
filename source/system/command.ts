import type { Command } from "commander"
import type { SystemStatus } from "./lifecycle.ts"
import SystemLifecycle from "./lifecycle.ts"
import prompts from "../prompts.ts"

/** Attach the System lifecycle without mixing it with Program commands. */
export default function systemCommands(program: Command, provided?: SystemLifecycle) {

    let lifecycle = provided

    const current = (): SystemLifecycle => lifecycle ?? (lifecycle = new SystemLifecycle())

    const system = program.command("system").description("install and manage the PhreshOS System")

    system.command("install")

        .description("install or update the System and start its service")

        .action(async function () {

            const interaction = prompts()

            interaction.begin("Install System", "official stable release")

            const status = await interaction.progress("Installing PhreshOS", "PhreshOS installed", () => current().install())

            report(interaction, status)

            interaction.finish("System installed")
        })

    system.command("uninstall")

        .description("remove the System installation and service")

        .action(async function () {

            const interaction = prompts()

            interaction.begin("Uninstall System")

            await interaction.progress("Removing PhreshOS", "PhreshOS removed", () => current().uninstall())

            interaction.message("Persistent System data was kept.")

            interaction.finish("System uninstalled")
        })

    system.command("status")

        .description("show installation, service, and readiness state")

        .action(async function () {

            const interaction = prompts()

            interaction.begin("System Status")

            report(interaction, await current().status())
        })

    action(system, "start", "start the background service", () => current().start())

    action(system, "stop", "stop the background service", () => current().stop())

    action(system, "enable", "enable automatic startup", () => current().enable())

    action(system, "disable", "disable automatic startup", () => current().disable())

    return system
}

function action(system: Command, name: string, description: string, work: () => Promise<SystemStatus>) {

    system.command(name)

        .description(description)

        .action(async function () {

            const interaction = prompts()

            interaction.begin(`System ${title(name)}`)

            const status = await interaction.progress(`${title(name)}ing PhreshOS`, `PhreshOS ${past(name)}`, work)

            report(interaction, status)

            interaction.finish(`System ${past(name)}`)
        })
}

function report(interaction: ReturnType<typeof prompts>, status: SystemStatus) {

    interaction.detail("installation", status.installed ? `installed · ${status.installed.version}` : "not installed")

    interaction.detail("service", status.registered ? "registered" : "not registered")

    interaction.detail("startup", status.enabled ? "enabled" : "disabled")

    interaction.detail("process", status.running ? `running${status.pid ? ` · ${status.pid}` : ""}` : "stopped")

    interaction.detail("intake", status.ready ? `ready · ${status.intake}` : "not ready")

    interaction.detail("files", status.root)

    interaction.detail("log", status.log)
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
