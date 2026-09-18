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
import { connected, type ConnectSystem } from "./connection.ts"
import { bounded, position, size, type CommonOptions, type ProcessCoordinates } from "./input.ts"
import { executeDescription } from "./execution.ts"

export default function windowCommands(root: Command, connect: ConnectSystem) {
    const windows = defineCommand(root, {
        name: "window",
        description: "inspect and control authoritative Client Windows",
        guidance: ["A Window belongs to the Client Endpoint of one exact Process."]
    })

    defineCommand<WindowOptions>(windows, state("inspect", windowPresentation), async ({ options }) => {
        return executeWindow(connect, options, { $operation: "inspect" })
    })

    defineCommand<WindowOptions & PositionOptions>(windows, {
        ...state("move", windowPositionPresentation),
        options: withJson(
            ...processOptions,
            option("--x <value>", "horizontal pixels or workspace-relative expression", { mandatory: true }),
            option("--y <value>", "vertical pixels or workspace-relative expression", { mandatory: true })
        ),
        examples: ["phresh window move --process main --program terminal --x 50% --y 0"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "move", position: position(options.x, options.y) }))

    defineCommand<WindowOptions & SizeOptions>(windows, {
        ...state("resize", windowSizePresentation),
        options: withJson(
            ...processOptions,
            option("--width <value>", "width in pixels or a workspace-relative expression", { mandatory: true }),
            option("--height <value>", "height in pixels or a workspace-relative expression", { mandatory: true })
        ),
        examples: ["phresh window resize --process main --program terminal --width 800 --height 600"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "resize", size: size(options.width, options.height) }))

    defineCommand<WindowOptions & PositionOptions & SizeOptions>(windows, {
        ...state("setGeometry", windowGeometryPresentation),
        aliases: ["set-geometry"],
        options: withJson(
            ...processOptions,
            option("--x <value>", "horizontal pixels or workspace-relative expression", { mandatory: true }),
            option("--y <value>", "vertical pixels or workspace-relative expression", { mandatory: true }),
            option("--width <value>", "width in pixels or a workspace-relative expression", { mandatory: true }),
            option("--height <value>", "height in pixels or a workspace-relative expression", { mandatory: true })
        ),
        examples: ["phresh window set-geometry --process main --program terminal --x 0 --y 0 --width 100% --height 100%"]
    }, async ({ options }) => executeWindow(connect, options, {
        $operation: "setGeometry",
        position: position(options.x, options.y),
        size: size(options.width, options.height)
    }))

    defineCommand<WindowOptions & Readonly<{ restore?: boolean }>>(windows, {
        ...state("minimize", windowMinimizePresentation),
        options: withJson(...processOptions, option("--restore", "restore rather than minimize the Window")),
        examples: ["phresh window minimize --process main --program terminal", "phresh window minimize --process main --program terminal --restore"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "minimize", minimized: options.restore !== true }))

    defineCommand<WindowOptions & Readonly<{ restore?: boolean }>>(windows, {
        ...state("maximize", windowMaximizePresentation),
        options: withJson(...processOptions, option("--restore", "restore rather than maximize the Window")),
        examples: ["phresh window maximize --process main --program terminal", "phresh window maximize --process main --program terminal --restore"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "maximize", maximized: options.restore !== true }))

    defineCommand<WindowOptions & Readonly<{ title: string }>>(windows, {
        ...state("changeTitle", windowTitlePresentation),
        aliases: ["change-title"],
        options: withJson(...processOptions, option("--title <title>", "new Window title", { mandatory: true })),
        examples: ["phresh window change-title --process main --program terminal --title Shell"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "changeTitle", title: options.title }))

    defineCommand<WindowOptions & Readonly<{ hide?: boolean }>>(windows, {
        ...state("changeHeader", windowHeaderPresentation),
        aliases: ["change-header"],
        options: withJson(...processOptions, option("--hide", "hide rather than show the Window header")),
        examples: ["phresh window change-header --process main --program terminal --hide", "phresh window change-header --process main --program terminal"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "changeHeader", header: options.hide !== true }))

    defineCommand<WindowOptions>(windows, {
        ...state("raise", windowRaisePresentation),
        examples: ["phresh window raise --process main --program terminal"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "raise" }))

    defineCommand<WindowOptions & WindowWaitOptions>(windows, {
        name: "wait",
        description: executeDescription("window", "wait"),
        requiresSystem: true,
        options: withJson(
            ...processOptions,
            option("--event <event>", "Window event", {
                mandatory: true,
                choices: ["move", "resize", "geometry", "minimize", "maximize", "changeTitle", "changeHeader", "front"]
            }),
            timeoutOption
        ),
        output: dataOutput(eventOutput("The observed Window event"), "One Window event", eventPresentation),
        examples: ["phresh window wait --process main --program terminal --event geometry --json"]
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
    event: "move" | "resize" | "geometry" | "minimize" | "maximize" | "changeTitle" | "changeHeader" | "front"
    timeout?: number
}>
