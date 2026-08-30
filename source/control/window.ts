import { Option, type Command } from "commander"
import { commandContract } from "../command-contract.ts"
import { outputOptions, processOptions } from "./options.ts"
import {
    bounded,
    connected,
    integer,
    output,
    position,
    requireProcess,
    size,
    wait,
    windowOf,
    windowView,
    type CommonOptions,
    type ConnectSystem,
    type ProcessCoordinates
} from "./shared.ts"

export default function windowCommands(root: Command, connect: ConnectSystem) {
    const windows = commandContract(root.command("window")
        .description("inspect and control authoritative Client Windows"))

    outputOptions(processOptions(windows.command("inspect")
        .description("read the complete current Window state")))
        .action(async (options: WindowOptions) => withWindow(connect, options, async process => {
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("move")
        .description("change Window position")
        .requiredOption("--x <value>", "horizontal pixels or workspace-relative expression")
        .requiredOption("--y <value>", "vertical pixels or workspace-relative expression")))
        .action(async (options: WindowOptions & PositionOptions) => withWindow(connect, options, async process => {
            await windowOf(process).move(position(options.x, options.y))
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("resize")
        .description("change Window size")
        .requiredOption("--width <value>", "width in pixels or a workspace-relative expression")
        .requiredOption("--height <value>", "height in pixels or a workspace-relative expression")))
        .action(async (options: WindowOptions & SizeOptions) => withWindow(connect, options, async process => {
            await windowOf(process).resize(size(options.width, options.height))
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("setGeometry")
        .alias("set-geometry")
        .description("change Window position and size atomically")
        .requiredOption("--x <value>", "horizontal pixels or workspace-relative expression")
        .requiredOption("--y <value>", "vertical pixels or workspace-relative expression")
        .requiredOption("--width <value>", "width in pixels or a workspace-relative expression")
        .requiredOption("--height <value>", "height in pixels or a workspace-relative expression")))
        .action(async (options: WindowOptions & PositionOptions & SizeOptions) => withWindow(connect, options, async process => {
            await windowOf(process).setGeometry({
                position: position(options.x, options.y),
                size: size(options.width, options.height)
            })
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("minimize")
        .description("set Window visibility without changing its order")
        .option("--restore", "restore rather than minimize the Window")))
        .action(async (options: WindowOptions & Readonly<{ restore?: boolean }>) => withWindow(connect, options, async process => {
            await windowOf(process).minimize(options.restore !== true)
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("changeTitle")
        .alias("change-title")
        .description("change the human-readable Window title")
        .requiredOption("--title <title>", "new Window title")))
        .action(async (options: WindowOptions & Readonly<{ title: string }>) => withWindow(connect, options, async process => {
            await windowOf(process).changeTitle(options.title)
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("raise")
        .description("raise the Window within its own layer")))
        .action(async (options: WindowOptions) => withWindow(connect, options, async process => {
            await windowOf(process).raise()
            output(await windowView(process), options.compact)
        }))

    outputOptions(processOptions(windows.command("wait")
        .description("wait for one authoritative Window change")
        .addOption(new Option("--event <event>", "Window event")
            .choices(["move", "resize", "geometry", "minimize", "changeTitle", "front"])
            .makeOptionMandatory())
        .option("--timeout <milliseconds>", "maximum wait in milliseconds", integer)))
        .action(async (options: WindowOptions & WindowWaitOptions) => withWindow(connect, options, async process => {
            output({
                scope: `window:${process.identity}`,
                event: options.event,
                payload: await wait(windowOf(process), options.event, options.timeout === undefined
                    ? undefined
                    : bounded(options.timeout, "--timeout", 1))
            }, options.compact)
        }))
}

async function withWindow(
    connect: ConnectSystem,
    options: WindowOptions,
    action: (process: Awaited<ReturnType<typeof requireProcess>>) => Promise<void>
) {
    await connected(connect, async system => {
        await action(await requireProcess(system, options.process, options.program))
    })
}

type WindowOptions = CommonOptions & ProcessCoordinates
type PositionOptions = Readonly<{ x: string, y: string }>
type SizeOptions = Readonly<{ width: string, height: string }>
type WindowWaitOptions = Readonly<{
    event: "move" | "resize" | "geometry" | "minimize" | "changeTitle" | "front"
    timeout?: number
}>
