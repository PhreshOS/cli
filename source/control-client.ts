import type { SystemControlClient, SystemControlRequest } from "@phreshos/core"
import { requestSystem } from "./gateway.ts"

/** Owner-local client for the authoritative running-System contract. */
export default class LocalSystemControl implements SystemControlClient {

    public execute(request: SystemControlRequest, signal?: AbortSignal) {

        return requestSystem(request, undefined, signal)
    }
}
