import { homedir } from "node:os"
import { existsSync, realpathSync } from "node:fs"
import { isAbsolute, join, normalize } from "node:path"

/** Resolve the absolute PhreshOS home selected for this CLI invocation. */
export default function phreshosHome(environment: NodeJS.ProcessEnv = process.env, userHome = homedir()) {

    const selected = environment.PHRESHOS_HOME

    if (selected === undefined) return canonical(join(userHome, ".phreshos"))
    if (!isAbsolute(selected)) throw new Error("PHRESHOS_HOME must be an absolute filesystem path")

    return canonical(selected)
}

function canonical(path: string) {

    const normalized = normalize(path)

    return existsSync(normalized) ? realpathSync(normalized) : normalized
}
