import { gatewayAddress, resolveHome } from "@phreshos/gateway"

/** Resolve the Gateway address while preserving the CLI's public helper. */
export function gatewayPath(home = resolveHome(), platform = process.platform) {
    return gatewayAddress(home, platform)
}
