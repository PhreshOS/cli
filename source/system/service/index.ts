import type { SystemService } from "../types.ts"
import { homedir } from "node:os"
import LinuxSystemService from "./linux.ts"
import MacOSSystemService from "./macos.ts"

/** Select the native per-user service manager without changing its semantics. */
export default function systemService(platform = process.platform, userHome = homedir()): SystemService {

    if (platform === "darwin") return new MacOSSystemService(userHome)

    if (platform === "linux") return new LinuxSystemService(userHome)

    throw new Error(`PhreshOS System services are not supported on ${platform}`)
}
