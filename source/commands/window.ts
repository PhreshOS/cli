import { parseExecuteRequest, parseWindowFrame, parseWindowTransaction, type AppearanceMaterial, type WindowFrame, type WindowTransaction } from "@phreshos/core"
import type { Command } from "commander"
import { defineCommand } from "../contract/command.ts"
import { option, processOptions, timeoutOption, withJson } from "./options.ts"
import type { OutputPresentation } from "../contract/output.ts"
import {
    dataOutput,
    eventOutput,
    eventPresentation,
    windowGeometryPresentation,
    windowFramePresentation,
    windowHeaderPresentation,
    windowMinimizePresentation,
    windowMaximizePresentation,
    windowOutput,
    windowPositionPresentation,
    windowTransactionPresentation,
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
        ...position(options.x, options.y),
        ...size(options.width, options.height)
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
        ...state("setTitle", windowTitlePresentation),
        aliases: ["set-title"],
        options: withJson(...processOptions, option("--title <title>", "new Window title", { mandatory: true })),
        examples: ["phresh window set-title --process main --program terminal --title Shell"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "setTitle", title: options.title }))

    defineCommand<WindowOptions & Readonly<{ hide?: boolean }>>(windows, {
        ...state("setHeader", windowHeaderPresentation),
        aliases: ["set-header"],
        options: withJson(...processOptions, option("--hide", "hide rather than show the Window header")),
        examples: ["phresh window set-header --process main --program terminal --hide", "phresh window set-header --process main --program terminal"]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "setHeader", header: options.hide !== true }))

    defineCommand<WindowOptions & FrameOptions>(windows, {
        ...state("setFrame", windowFramePresentation),
        aliases: ["set-frame"],
        options: withJson(
            ...processOptions,
            option("--default", "use the default Window frame"),
            option("--absent", "remove the Window frame"),
            option("--radius <radius>", "frame radius in pixels or full"),
            option("--color <color>", "Appearance color role or CSS color"),
            option("--without-material", "render the frame without Material"),
            option("--grain <value>", "frame Material grain", { parse: input => numeric(input, "--grain") }),
            option("--grain-amount <value>", "frame Material grain intensity", { parse: input => numeric(input, "--grain-amount") }),
            option("--backdrop <value>", "frame Material backdrop blur", { parse: input => numeric(input, "--backdrop") }),
            option("--opacity <value>", "frame Material opacity", { parse: input => numeric(input, "--opacity") }),
            option("--distortion <value>", "frame Material distortion", { parse: input => numeric(input, "--distortion") }),
            option("--saturation <value>", "frame Material saturation", { parse: input => numeric(input, "--saturation") })
        ),
        examples: [
            "phresh window set-frame --process overlay --absent",
            "phresh window set-frame --process overlay --radius full --color primary"
        ]
    }, async ({ options }) => executeWindow(connect, options, { $operation: "setFrame", frame: frame(options) }))

    defineCommand<WindowOptions & TransactionOptions>(windows, {
        ...state("setTransaction", windowTransactionPresentation),
        aliases: ["set-transaction"],
        options: withJson(
            ...processOptions,
            option("--default", "use the default Appearance transaction"),
            option("--disabled", "disable the default Window transaction"),
            option("--duration <milliseconds>", "transaction duration", { parse: input => numeric(input, "--duration") }),
            option("--easing <easing>", "standard easing name or four comma-separated cubic Bézier values")
        ),
        examples: [
            "phresh window set-transaction --process overlay --default",
            "phresh window set-transaction --process overlay --duration 240 --easing ease-out"
        ]
    }, async ({ options }) => executeWindow(connect, options, {
        $operation: "setTransaction",
        transaction: transaction(options)
    }))

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
                choices: ["move", "resize", "minimize", "maximize", "changeTitle", "changeHeader", "changeFrame", "changeTransaction", "front"]
            }),
            timeoutOption
        ),
        output: dataOutput(eventOutput("The observed Window event"), "One Window event", eventPresentation),
        examples: ["phresh window wait --process main --program terminal --event move --json"]
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
type FrameOptions = Readonly<{
    default?: boolean
    absent?: boolean
    radius?: string
    color?: string
    withoutMaterial?: boolean
    grain?: number
    grainAmount?: number
    backdrop?: number
    opacity?: number
    distortion?: number
    saturation?: number
}>
type TransactionOptions = Readonly<{
    default?: boolean
    disabled?: boolean
    duration?: number
    easing?: string
}>
type WindowWaitOptions = Readonly<{
    event: "move" | "resize" | "minimize" | "maximize" | "changeTitle" | "changeHeader" | "changeFrame" | "changeTransaction" | "front"
    timeout?: number
}>

function frame(options: FrameOptions): WindowFrame {
    const materialValues = material(options)
    const customized = options.radius !== undefined || options.color !== undefined || materialValues !== undefined
    const modes = Number(options.default === true) + Number(options.absent === true) + Number(customized)

    if (modes !== 1) throw new Error("Choose exactly one of --default, --absent, or frame customization options")
    if (options.default) return true
    if (options.absent) return false

    return parseWindowFrame({
        ...(options.radius === undefined ? {} : { radius: options.radius === "full" ? "full" : numeric(options.radius, "--radius") }),
        ...(options.color === undefined ? {} : { color: options.color }),
        ...(materialValues === undefined ? {} : { material: materialValues })
    })
}

function material(options: FrameOptions): false | Partial<AppearanceMaterial> | undefined {
    const values = {
        grain: options.grain,
        grainAmount: options.grainAmount,
        backdrop: options.backdrop,
        opacity: options.opacity,
        distortion: options.distortion,
        saturation: options.saturation
    }
    const customized = Object.values(values).some(value => value !== undefined)
    const modes = Number(options.withoutMaterial === true) + Number(customized)

    if (modes > 1) throw new Error("Choose only one Material mode")
    if (options.withoutMaterial) return false
    if (!customized) return undefined

    return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}

function transaction(options: TransactionOptions): WindowTransaction {
    const customized = options.duration !== undefined || options.easing !== undefined
    const modes = Number(options.default === true) + Number(options.disabled === true) + Number(customized)

    if (modes !== 1) throw new Error("Choose exactly one of --default, --disabled, or --duration")
    if (options.default) return true
    if (options.disabled) return false
    if (options.duration === undefined) throw new Error("--easing requires --duration")
    if (options.easing === undefined) return parseWindowTransaction(options.duration)

    const pieces = options.easing.split(",").map(value => value.trim())
    const easing = pieces.length === 4 ? pieces.map(value => numeric(value, "--easing")) : options.easing
    return parseWindowTransaction({ duration: options.duration, easing })
}

function numeric(value: string, name: string) {
    const result = Number(value)
    if (!Number.isFinite(result)) throw new Error(`${name} must be a finite number`)
    return result
}
