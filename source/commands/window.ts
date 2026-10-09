import { parseExecuteRequest } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { option, processOptions, timeoutOption, withJson } from "./options.ts"
import type { OutputPresentation } from "../contract/output.ts"
import {
    dataOutput,
    eventOutput,
    eventPresentation,
    windowGeometryPresentation,
    windowHeaderPresentation,
    windowMinimizePresentation,
    windowMaximizePresentation,
    windowOutput,
    windowPositionPresentation,
    windowPresentation,
    windowRaisePresentation,
    windowSizePresentation,
    windowTitlePresentation
} from "./schemas.ts"
import { connected, type ConnectSystem } from "./system-connection.ts"
import { bounded, position, size, type CommonOptions, type ProcessCoordinates } from "./input.ts"
import { executeDescription } from "./execution.ts"

export default function windowCommands(root: Command, connect: ConnectSystem) {
    const windows = defineCommand(root, {
        name: "window",
        description: "read, move, resize, and arrange the Windows on the Desktop",
        guidance: [
            "A Window is the Client of one run (Process): name the run with --process, and --program when --process is a name.",
            "Windows live on a plane larger than the screen. 0, 0 is the middle of the view the Desktop shows, not its top-left corner. A position is the Window's top-left corner.",
            "A number is pixels; a share such as -1/2, 1/2, 50%, or 1/1 is a part of the view, so the Window fits any screen. The view's edges are -1/2 and 1/2. Shares and pixels combine: 1/2 - 300.",
            "Centered: x = -width/2, y = -height/2. Left half: --x -1/2 --y -1/2 --width 1/2 --height 1/1. Full view: maximize.",
            "A change applies at once on every Desktop; read the Window again to see it."
        ]
    })

    defineCommand<WindowOptions>(windows, state("inspect", windowPresentation), async ({ options }) => {
        return executeWindow(connect, options, { $operation: "inspect" })
    })

    defineCommand<WindowOptions & PositionOptions>(windows, {
        ...state("move", windowPositionPresentation),
        options: withJson(
            ...processOptions,
            option("--x <value>", "where the Window's left edge is, counted from the middle of the view (0 is the middle, not the screen's edge): pixels such as -450, or a share of the view such as -1/2 (the view's left edge) or 1/2 - 300", { mandatory: true }),
            option("--y <value>", "where the Window's top edge is, counted from the middle of the view, as --x: -1/2 is the view's top edge", { mandatory: true })
        ),
        examples: ["phresh window move --process main --program terminal --x -450 --y -320   # puts a 900 x 640 Window in the middle of the view (0, 0 is the middle)"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "move", position: position(options.x, options.y) }))

    defineCommand<WindowOptions & SizeOptions>(windows, {
        ...state("resize", windowSizePresentation),
        options: withJson(
            ...processOptions,
            option("--width <value>", "the width: pixels such as 900, or a share of the view such as 1/2, 50%, or 1/1 (the whole view)", { mandatory: true }),
            option("--height <value>", "the height, as --width", { mandatory: true })
        ),
        examples: ["phresh window resize --process main --program terminal --width 800 --height 600   # 800 x 600 pixels; its top-left corner stays"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "resize", size: size(options.width, options.height) }))

    defineCommand<WindowOptions & PositionOptions & SizeOptions>(windows, {
        ...state("setGeometry", windowGeometryPresentation),
        aliases: ["set-geometry"],
        options: withJson(
            ...processOptions,
            option("--x <value>", "where the Window's left edge is, counted from the middle of the view (0 is the middle, not the screen's edge): pixels such as -450, or a share of the view such as -1/2 (the view's left edge) or 1/2 - 300", { mandatory: true }),
            option("--y <value>", "where the Window's top edge is, counted from the middle of the view, as --x: -1/2 is the view's top edge", { mandatory: true }),
            option("--width <value>", "the width: pixels such as 900, or a share of the view such as 1/2, 50%, or 1/1 (the whole view)", { mandatory: true }),
            option("--height <value>", "the height, as --width", { mandatory: true })
        ),
        examples: ["phresh window set-geometry --process main --program terminal --x -1/2 --y -1/2 --width 1/2 --height 1/1   # the left half of the view: -1/2 is the view's left and top edge"]
    }, async ({ options }) => executeWindow(connect, options, {
        $operation: "setGeometry",
        ...position(options.x, options.y),
        ...size(options.width, options.height)
    }))

    defineCommand<WindowOptions & Readonly<{ restore?: boolean }>>(windows, {
        ...state("minimize", windowMinimizePresentation),
        options: withJson(...processOptions, option("--restore", "restore the Window instead; left out, minimize it")),
        examples: ["phresh window minimize --process main --program terminal   # minimizes it", "phresh window minimize --process main --program terminal --restore   # restores it"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "minimize", minimized: options.restore !== true }))

    defineCommand<WindowOptions & Readonly<{ restore?: boolean }>>(windows, {
        ...state("maximize", windowMaximizePresentation),
        options: withJson(...processOptions, option("--restore", "restore the Window to its size and place instead; left out, maximize it")),
        examples: ["phresh window maximize --process main --program terminal   # fills the view", "phresh window maximize --process main --program terminal --restore   # back to its size and place"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "maximize", maximized: options.restore !== true }))

    defineCommand<WindowOptions & Readonly<{ title: string }>>(windows, {
        ...state("setTitle", windowTitlePresentation),
        aliases: ["set-title"],
        options: withJson(...processOptions, option("--title <title>", "the new title", { mandatory: true })),
        examples: ["phresh window set-title --process main --program terminal --title Shell   # its title becomes Shell"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "setTitle", title: options.title }))

    defineCommand<WindowOptions & Readonly<{ hide?: boolean }>>(windows, {
        ...state("setHeader", windowHeaderPresentation),
        aliases: ["set-header"],
        options: withJson(...processOptions, option("--hide", "hide the title bar; left out, show it")),
        examples: ["phresh window set-header --process main --program terminal --hide   # hides the Desktop's title bar; the Program draws its own", "phresh window set-header --process main --program terminal   # shows it again"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "setHeader", header: options.hide !== true }))

    defineCommand<WindowOptions>(windows, {
        ...state("raise", windowRaisePresentation),
        examples: ["phresh window raise --process main --program terminal   # brings it in front of the other Windows"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "raise" }))

    defineCommand<WindowOptions & WindowWaitOptions>(windows, {
        name: "wait",
        description: executeDescription("window", "wait"),
        requiresSystem: true,
        options: withJson(
            ...processOptions,
            option("--event <event>", "Window event", {
                mandatory: true,
                choices: ["move", "resize", "minimize", "maximize", "changeTitle", "changeHeader", "front"]
            }),
            timeoutOption
        ),
        output: dataOutput(eventOutput("The observed Window event"), "One Window event", eventPresentation),
        examples: ["phresh window wait --process main --program terminal --event move --json   # waits until it moves"]
    }, async ({ options }) => executeWindow(connect, options, {
        $operation: "wait",
        event: options.event,
        ...(options.timeout === undefined ? {} : { timeout: bounded(options.timeout, "--timeout", 1) })
    }))
}

function state(name: string, presentation: OutputPresentation) {
    return {
        name,
        description: executeDescription("window", name),
        requiresSystem: true,
        options: withJson(...processOptions),
        output: dataOutput(windowOutput, "The current Window state", presentation)
    }
}

async function executeWindow(
    connect: ConnectSystem,
    options: WindowOptions,
    operation: Readonly<Record<string, unknown> & { $operation: string }>
) {
    const request = parseExecuteRequest({
        $domain: "window",
        ...operation,
        process: options.process,
        ...(options.program ? { program: options.program } : {})
    })
    return connected(connect, system => system.execute(request))
}

type WindowOptions = CommonOptions & ProcessCoordinates
type PositionOptions = Readonly<{ x: string, y: string }>
type SizeOptions = Readonly<{ width: string, height: string }>
type WindowWaitOptions = Readonly<{
    event: "move" | "resize" | "minimize" | "maximize" | "changeTitle" | "changeHeader" | "front"
    timeout?: number
}>
