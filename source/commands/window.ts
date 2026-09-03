import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { option, processOptions, timeoutOption, withJson } from "./options.ts"
import { eventOutput, jsonOutput, windowOutput } from "./schemas.ts"
import { connected, requireProcess, type ConnectSystem } from "./connection.ts"
import { bounded, position, size, type CommonOptions, type ProcessCoordinates } from "./input.ts"
import { wait } from "./observation.ts"
import { windowOf, windowView } from "./projection.ts"

export default function windowCommands(root: Command, connect: ConnectSystem) {
    const windows = defineCommand(root, {
        name: "window",
        description: "inspect and control authoritative Client Windows",
        guidance: ["A Window belongs to the Client Endpoint of one exact Process."]
    })

    defineCommand<WindowOptions>(windows, state("inspect", "read the complete current Window state"), async ({ options }) => {
        return await withWindow(connect, options, windowView)
    })

    defineCommand<WindowOptions & PositionOptions>(windows, {
        ...state("move", "change Window position"),
        options: withJson(
            ...processOptions,
            option("--x <value>", "horizontal pixels or workspace-relative expression", { mandatory: true }),
            option("--y <value>", "vertical pixels or workspace-relative expression", { mandatory: true })
        ),
        examples: ["phresh window move --process main --program terminal --x 50% --y 0"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        await windowOf(process).move(position(options.x, options.y))
        return await windowView(process)
    }))

    defineCommand<WindowOptions & SizeOptions>(windows, {
        ...state("resize", "change Window size"),
        options: withJson(
            ...processOptions,
            option("--width <value>", "width in pixels or a workspace-relative expression", { mandatory: true }),
            option("--height <value>", "height in pixels or a workspace-relative expression", { mandatory: true })
        ),
        examples: ["phresh window resize --process main --program terminal --width 800 --height 600"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        await windowOf(process).resize(size(options.width, options.height))
        return await windowView(process)
    }))

    defineCommand<WindowOptions & PositionOptions & SizeOptions>(windows, {
        ...state("setGeometry", "change Window position and size atomically"),
        aliases: ["set-geometry"],
        options: withJson(
            ...processOptions,
            option("--x <value>", "horizontal pixels or workspace-relative expression", { mandatory: true }),
            option("--y <value>", "vertical pixels or workspace-relative expression", { mandatory: true }),
            option("--width <value>", "width in pixels or a workspace-relative expression", { mandatory: true }),
            option("--height <value>", "height in pixels or a workspace-relative expression", { mandatory: true })
        ),
        examples: ["phresh window set-geometry --process main --program terminal --x 0 --y 0 --width 100% --height 100%"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        await windowOf(process).setGeometry({
            position: position(options.x, options.y),
            size: size(options.width, options.height)
        })
        return await windowView(process)
    }))

    defineCommand<WindowOptions & Readonly<{ restore?: boolean }>>(windows, {
        ...state("minimize", "set Window visibility without changing its order"),
        options: withJson(...processOptions, option("--restore", "restore rather than minimize the Window")),
        examples: ["phresh window minimize --process main --program terminal", "phresh window minimize --process main --program terminal --restore"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        await windowOf(process).minimize(options.restore !== true)
        return await windowView(process)
    }))

    defineCommand<WindowOptions & Readonly<{ title: string }>>(windows, {
        ...state("changeTitle", "change the human-readable Window title"),
        aliases: ["change-title"],
        options: withJson(...processOptions, option("--title <title>", "new Window title", { mandatory: true })),
        examples: ["phresh window change-title --process main --program terminal --title Shell"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        await windowOf(process).changeTitle(options.title)
        return await windowView(process)
    }))

    defineCommand<WindowOptions>(windows, {
        ...state("raise", "raise the Window within its own layer"),
        examples: ["phresh window raise --process main --program terminal"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        await windowOf(process).raise()
        return await windowView(process)
    }))

    defineCommand<WindowOptions & WindowWaitOptions>(windows, {
        name: "wait",
        description: "wait for one authoritative Window change",
        requiresSystem: true,
        options: withJson(
            ...processOptions,
            option("--event <event>", "Window event", {
                mandatory: true,
                choices: ["move", "resize", "geometry", "minimize", "changeTitle", "front"]
            }),
            timeoutOption
        ),
        output: jsonOutput(eventOutput("The observed Window event"), "One Window event"),
        examples: ["phresh window wait --process main --program terminal --event geometry --json"]
    }, async ({ options }) => withWindow(connect, options, async process => {
        return {
            scope: `window:${process.identity}`,
            event: options.event,
            payload: await wait(windowOf(process), options.event, options.timeout === undefined
                ? undefined
                : bounded(options.timeout, "--timeout", 1))
        }
    }))
}

function state(name: string, description: string) {
    return {
        name,
        description,
        requiresSystem: true,
        options: withJson(...processOptions),
        output: jsonOutput(windowOutput, "The current Window state")
    }
}

async function withWindow<Result>(
    connect: ConnectSystem,
    options: WindowOptions,
    action: (process: Awaited<ReturnType<typeof requireProcess>>) => Promise<Result>
) {
    return await connected(connect, async system => {
        return await action(await requireProcess(system, options.process, options.program))
    })
}

type WindowOptions = CommonOptions & ProcessCoordinates
type PositionOptions = Readonly<{ x: string, y: string }>
type SizeOptions = Readonly<{ width: string, height: string }>
type WindowWaitOptions = Readonly<{
    event: "move" | "resize" | "geometry" | "minimize" | "changeTitle" | "front"
    timeout?: number
}>
