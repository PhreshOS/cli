import type { Command } from "commander"
import type { AppearanceColors, SystemAbout } from "@phreshos/core"
import colors from "picocolors"
import { basename } from "node:path"
import { defineCommand } from "../contract/command.ts"
import { desktopOrigin } from "../system/lifecycle.ts"
import systemPaths from "../system/paths.ts"
import { bold, dim } from "../style.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { jsonOption } from "./options.ts"
import { textOutput } from "./schemas.ts"

/** What `phresh fetch` reports about one running System. */
export type Fetched = Readonly<{
    username: string | null
    system: SystemAbout
    desktop: string
    programs: Readonly<{ installed: number, startup: number }>
    processes: Readonly<{ running: number, windows: number }>
    connections: Readonly<{ desktops: number, sessions: number }>
    wallpapers: Readonly<{ light: string, dark: string }>
    colors: Readonly<{ light: AppearanceColors, dark: AppearanceColors }>
}>

/** The PhreshOS logo in half blocks, drawn from its two shapes. */
const logo = [
    "  ▄██████▄▄▄",
    "  ████████████▄",
    "   ████████████▄",
    "    ▀▀██████████",
    "    ▄▄▄▄▄▄▀█████",
    " ▄█████████ ███▀",
    "▄██████████▄█▀",
    "███████▀▀▀",
    "█████▀",
    "▀█▀▀"
]

/** The logo's gradient, from its light top to its deep bottom. */
const logoColors = [[0xfa, 0xba, 0x86], [0xf1, 0x8b, 0x5c]] as const

/** Shows the running System at a glance, in the manner of the fetch tools of other systems. */
export default function fetchCommand(program: Command, connect: ConnectSystem) {
    defineCommand<{ json?: boolean }>(program, {
        name: "fetch",
        description: "show the running System at a glance",
        requiresSystem: true,
        options: [jsonOption],
        output: textOutput("The System's version, Desktop address, Programs, Processes, connections, and Appearance"),
        examples: ["phresh fetch", "phresh fetch --json"]
    }, async ({ options }) => {
        const fetched = await fetchSystem(connect)
        if (options.json) console.log(JSON.stringify(fetched))
        else console.log(`${renderFetch(fetched, colors.isColorSupported)}\n`)
    })
}

export async function fetchSystem(connect: ConnectSystem): Promise<Fetched> {
    const desktop = await desktopOrigin(systemPaths().storage)
    return connected(connect, async system => {
        const [about, state, programs, processes, connections, sessions, appearance] = await Promise.all([
            system.about(),
            system.authentication.state(),
            system.program.list({ installed: true }),
            system.process.list(),
            system.authentication.connections(),
            system.authentication.sessions(),
            system.appearance.snapshot()
        ])
        const [startups, windows] = await Promise.all([
            Promise.all(programs.map(program => program.startup.get())),
            Promise.all(processes.map(process => process.client.running()))
        ])

        return {
            username: state.username,
            system: about,
            desktop,
            programs: { installed: programs.length, startup: startups.filter(Boolean).length },
            processes: { running: processes.length, windows: windows.filter(Boolean).length },
            connections: { desktops: connections.length, sessions: sessions.length },
            wallpapers: { light: appearance.wallpapers.light.desktop, dark: appearance.wallpapers.dark.desktop },
            colors: appearance.colors
        }
    })
}

/** The logo beside the report, then the Appearance colors of both themes. */
export function renderFetch(fetched: Fetched, color: boolean, now = Date.now()) {
    const title = fetched.username ? `${fetched.username}@${fetched.system.name}` : fetched.system.name
    const count = (value: number, one: string, many = `${one}s`) => `${value} ${value === 1 ? one : many}`
    const field = (label: string, value: string) => `${color ? paint(label.padEnd(11), logoColor(1)) : label.padEnd(11)}${value}`
    const lines = [
        // The requested rendering mode owns color, even when the terminal environment forces it.
        color ? bold(title) : title,
        color ? dim("─".repeat(title.length)) : "─".repeat(title.length),
        field("System", `${fetched.system.name} ${fetched.system.version} · ${fetched.system.release.name}`),
        field("Uptime", uptime(now - fetched.system.startedAt.getTime())),
        field("Desktop", fetched.desktop),
        field("Programs", `${fetched.programs.installed} installed · ${fetched.programs.startup} at startup`),
        field("Processes", `${fetched.processes.running} running · ${count(fetched.processes.windows, "Window")}`),
        field("Connected", `${count(fetched.connections.desktops, "Desktop")} · ${count(fetched.connections.sessions, "Session")}`),
        field("Wallpaper", wallpaper(fetched.wallpapers)),
        ...color ? ["", palette(fetched.colors.light), palette(fetched.colors.dark)] : []
    ]
    return beside(logo.map((line, index) => color ? paint(line, logoColor(index / (logo.length - 1))) : line), lines)
}

/** How long the System has run, in its two largest units, as in "2 days, 3 hours". */
function uptime(milliseconds: number) {
    const units = [["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000]] as const
    let left = Math.max(0, milliseconds)
    const parts = units.flatMap(([name, size]) => {
        const amount = Math.floor(left / size)
        left -= amount * size
        return amount ? [`${amount} ${name}${amount === 1 ? "" : "s"}`] : []
    })
    return parts.slice(0, 2).join(", ") || "less than a minute"
}

function wallpaper(value: Fetched["wallpapers"]) {
    return value.light === value.dark ? basename(value.light) : `${basename(value.light)} · ${basename(value.dark)}`
}

/** One block per Appearance color; a color terminals cannot draw is left out. */
function palette(colors: AppearanceColors) {
    return Object.values(colors).map(hex).filter(rgb => rgb !== null).map(rgb => paint("███", rgb)).join("")
}

function beside(left: readonly string[], right: readonly string[]) {
    const shown = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, "").length
    const width = Math.max(...left.map(shown)) + 4
    return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
        const line = left[index] ?? ""
        return `  ${line}${" ".repeat(width - shown(line))}${right[index] ?? ""}`.trimEnd()
    }).join("\n")
}

function logoColor(share: number) {
    const [from, to] = logoColors
    return from.map((value, index) => Math.round(value + (to[index]! - value) * share)) as [number, number, number]
}

function paint(text: string, [red, green, blue]: readonly number[]) {
    return `\x1b[38;2;${red};${green};${blue}m${text}\x1b[39m`
}

function hex(value: string) {
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
    if (!match) return null
    const digits = match[1]!.length === 3 ? [...match[1]!].map(digit => digit + digit).join("") : match[1]!
    return [0, 2, 4].map(index => parseInt(digits.slice(index, index + 2), 16))
}
