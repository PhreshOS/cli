import type { SystemPaths } from "./types.ts"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"

/** The installation is separate from the persistent state it operates on. */
export default function systemPaths(platform = process.platform, userHome = homedir(), variables: NodeJS.ProcessEnv = process.env): SystemPaths {

    const storage = join(userHome, ".phreshos")

    const root = platform === "darwin"

        ? join(userHome, "Library", "Application Support", "PhreshOS", "System")

        : platform === "linux"

            ? join(absoluteOr(variables.XDG_DATA_HOME, join(userHome, ".local", "share"), "XDG_DATA_HOME"), "phreshos", "system")

            : platform === "win32"

                ? join(absoluteOr(variables.LOCALAPPDATA, join(userHome, "AppData", "Local"), "LOCALAPPDATA"), "PhreshOS", "System")

                : join(userHome, ".local", "share", "phreshos", "system")

    return {

        root,

        releases: join(root, "releases"),

        current: join(root, "current"),

        storage,

        intake: join(storage, "intake.sock"),

        log: join(storage, "service.log")
    }
}

function absoluteOr(value: string | undefined, fallback: string, name: string) {

    if (value === undefined) return fallback

    if (!isAbsolute(value)) throw new Error(`${name} must be an absolute filesystem path`)

    return value
}
