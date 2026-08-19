import { createHash } from "node:crypto"
import { join } from "node:path"

/** Address the same owner-local intake without turning it into a network port. */
export default function intakeAddress(storage: string, platform = process.platform) {

    if (platform !== "win32") return join(storage, "intake.sock")

    // Windows pipe names share one machine-wide namespace. The storage root
    // separates users and isolated instances while case folding follows the
    // filesystem they came from. Access remains the pipe creator's default
    // duplex ACL; the name is identity, not a secret or an authorization.
    const owner = storage.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()

    const identity = createHash("sha256").update(owner).digest("hex").slice(0, 32)

    return `\\\\.\\pipe\\phreshos-${identity}-intake`
}
