import { cancel, confirm, intro, isCancel, log, outro, select, spinner, text } from "@clack/prompts"
import colors from "picocolors"
import { caution, column, ending, line, section } from "./style.ts"

/** Signals an ordinary interactive cancellation rather than an operation failure. */
export class PromptCancelled extends Error {}

/** An unsuccessful command whose complete explanation has already been shown. */
export class ReportedFailure extends Error {}

/**
 * One interaction language shared by commands that can ask questions.
 *
 * Clack owns terminal behavior. This adapter owns only the product's wording
 * and the rule that automation never opens or waits for a prompt.
 */
export default function prompts() {

    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)

    function begin(title: string, context?: string) {

        if (interactive) intro(`${colors.bold(title)}${context ? ` ${colors.dim(`· ${context}`)}` : ""}`)

        else section(title, context)
    }

    function finish(message: string) {

        if (interactive) outro(colors.bold(message))

        else ending(message)
    }

    function detail(label: string, value: string, source?: string) {

        if (interactive) log.message(`${colors.dim(column(label))}${value}${source ? `  ${colors.dim(source)}` : ""}`, { spacing: 0 })

        else line(label, value, source)
    }

    function message(value = "") {

        if (interactive) log.message(value, { spacing: 0 })

        else console.log(value ? `  ${value}` : "")
    }

    function warning(value: string) {

        if (interactive) log.warning(value, { spacing: 0 })

        else line("warning", caution(value))
    }

    async function progress<T>(message: string, completed: string, work: () => Promise<T>) {

        if (!interactive) return await work()

        const indicator = spinner()

        indicator.start(message)

        try {

            const result = await work()

            indicator.clear()

            log.success(completed, { spacing: 0 })

            return result
        }

        catch (error) {

            indicator.error(`${message} failed`)

            throw error
        }
    }

    async function ask(explanation: string, question: string, fallback?: string) {

        if (!interactive) throw new Error(`${question} Supply the corresponding option when no terminal is attached`)

        log.message(colors.dim(explanation), { spacing: 0 })

        const value = await text({

            message: question,

            placeholder: fallback,

            defaultValue: fallback
        })

        if (isCancel(value)) stop()

        return value.trim()
    }

    async function yes(explanation: string, question: string, fallback: boolean) {

        if (!interactive) throw new Error(`${question} Supply the corresponding option when no terminal is attached`)

        log.message(colors.dim(explanation), { spacing: 0 })

        const value = await confirm({ message: question, initialValue: fallback })

        if (isCancel(value)) stop()

        return value
    }

    async function choose(explanation: string, question: string, values: readonly string[], fallback: string) {

        if (!interactive) throw new Error(`${question} Supply the corresponding option when no terminal is attached`)

        log.message(colors.dim(explanation), { spacing: 0 })

        const value = await select({

            message: question,

            options: values.map(value => ({ value, label: value })),

            initialValue: fallback
        })

        if (isCancel(value)) stop()

        return value
    }

    function stop(): never {

        cancel("No changes made")

        throw new PromptCancelled()
    }

    return {

        interactive,

        begin,

        finish,

        detail,

        message,

        warning,

        progress,

        ask,

        yes,

        choose
    }
}
