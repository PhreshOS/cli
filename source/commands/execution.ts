import { describeExecuteOperation, type ExecuteOperationKey } from "@phreshos/core"

/** Human-facing CLI path for every operation in Core's Execute catalog. */
export const executeCommandPaths = Object.freeze({
    "operation.list": ["operation", "list"],
    "operation.describe": ["operation", "describe"],
    "program.list": ["program", "list"],
    "program.find": ["program", "inspect"],
    "program.agent": ["program", "agent"],
    "program.definition": ["program", "definition"],
    "program.getStartup": ["program", "getStartup"],
    "program.enableStartup": ["program", "enableStartup"],
    "program.disableStartup": ["program", "disableStartup"],
    "program.pinned": ["program", "pinned"],
    "program.pin": ["program", "pin"],
    "program.unpin": ["program", "unpin"],
    "program.getPermission": ["program", "getPermission"],
    "program.listPermissions": ["program", "listPermissions"],
    "program.allowsPermission": ["program", "allowsPermission"],
    "program.allowPermission": ["program", "allowPermission"],
    "program.denyPermission": ["program", "denyPermission"],
    "program.requestPermission": ["program", "requestPermission"],
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
    "service.list": ["service", "list"],
    "service.search": ["service", "search"],
    "service.inspect": ["service", "inspect"],
    "service.waitReady": ["service", "waitReady"],
    "service.ask": ["service", "ask"],
    "service.publish": ["service", "publish"],
    "service.wait": ["service", "wait"],
    "service.waitLifecycle": ["service", "waitLifecycle"],
    "service.waitDiscovery": ["service", "waitDiscovery"],
    "window.inspect": ["window", "inspect"],
    "window.move": ["window", "move"],
    "window.resize": ["window", "resize"],
    "window.setGeometry": ["window", "setGeometry"],
    "window.minimize": ["window", "minimize"],
    "window.maximize": ["window", "maximize"],
    "window.setTitle": ["window", "setTitle"],
    "window.setHeader": ["window", "setHeader"],
    "window.setFrame": ["window", "setFrame"],
    "window.setTransaction": ["window", "setTransaction"],
    "window.raise": ["window", "raise"],
    "window.wait": ["window", "wait"]
} as const satisfies Readonly<Record<ExecuteOperationKey, readonly string[]>>)

/** Read command language from the same catalog that defines raw execution. */
export function executeDescription(domain: string, operation: string) {
    const description = describeExecuteOperation(domain, operation)
    if (!description) throw new Error(`Unknown Execute operation ${domain}.${operation}`)
    return description.description
}
