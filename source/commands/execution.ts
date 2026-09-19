import { describeExecuteOperation, type ExecuteOperationKey } from "@phreshos/core"

/** Human-facing CLI path for every operation in Core's Execute catalog. */
export const executeCommandPaths = Object.freeze({
    "operation.list": ["operation", "list"],
    "operation.describe": ["operation", "describe"],
    "program.list": ["program", "list"],
    "program.find": ["program", "inspect"],
    "program.agent": ["program", "agent"],
    "program.getLaunch": ["program", "getLaunch"],
    "program.setLaunch": ["program", "setLaunch"],
    "program.logs": ["program", "logs"],
    "program.wait": ["program", "wait"],
    "process.list": ["process", "list"],
    "process.find": ["process", "inspect"],
    "process.create": ["process", "create"],
    "process.findOrCreate": ["process", "findOrCreate"],
    "process.exit": ["process", "exit"],
    "process.wait": ["process", "wait"],
    "endpoint.inspect": ["endpoint", "inspect"],
    "endpoint.start": ["endpoint", "start"],
    "endpoint.stop": ["endpoint", "stop"],
    "endpoint.waitReady": ["endpoint", "waitReady"],
    "endpoint.ask": ["endpoint", "ask"],
    "endpoint.publish": ["endpoint", "publish"],
    "endpoint.wait": ["endpoint", "wait"],
    "endpoint.waitLifecycle": ["endpoint", "waitLifecycle"],
    "window.inspect": ["window", "inspect"],
    "window.move": ["window", "move"],
    "window.resize": ["window", "resize"],
    "window.setGeometry": ["window", "setGeometry"],
    "window.minimize": ["window", "minimize"],
    "window.maximize": ["window", "maximize"],
    "window.changeTitle": ["window", "changeTitle"],
    "window.changeHeader": ["window", "changeHeader"],
    "window.changeFrame": ["window", "changeFrame"],
    "window.changeOpeningTransaction": ["window", "changeOpeningTransaction"],
    "window.raise": ["window", "raise"],
    "window.wait": ["window", "wait"]
} as const satisfies Readonly<Record<ExecuteOperationKey, readonly string[]>>)

/** Read command language from the same catalog that defines raw execution. */
export function executeDescription(domain: string, operation: string) {
    const description = describeExecuteOperation(domain, operation)
    if (!description) throw new Error(`Unknown Execute operation ${domain}.${operation}`)
    return description.description
}
