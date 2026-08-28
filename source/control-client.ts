import type { SystemControlClient, SystemControlRequest } from "@phreshos/core"
import { Gateway } from "@phreshos/node"

/** Owner-local client for the authoritative running-System contract. */
export default class LocalSystemControl implements SystemControlClient {

    public async execute(request: SystemControlRequest, signal?: AbortSignal) {
        const gateway = await Gateway.open()
        try { return await gateway.execute(request, signal) }
        finally { await gateway.close() }
    }
}
