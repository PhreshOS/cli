import type { SystemService } from "../types.ts"
import { homedir } from "node:os"
import LinuxSystemService from "./linux.ts"
import MacOSSystemService from "./macos.ts"
import WindowsSystemService from "./windows.ts"

/** Select the per-user service implementation available in this environment. */
export default function systemService(platform = process.platform, userHome = homedir()): SystemService {

    if (platform === "darwin") return new MacOSSystemService(userHome)

    if (platform === "linux") return new LinuxSystemService(userHome)

    if (platform === "win32") return new WindowsSystemService(userHome)

    throw new Error(`PhreshOS System services are not supported on ${platform}`)
}
