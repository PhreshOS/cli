import { delimiter, join } from "node:path"

/** Give author commands the same project-local binary resolution as scripts. */
export default function commandEnvironment(directory: string) {

    const key = Object.keys(process.env).find(name => name.toLowerCase() === "path") ?? "PATH"

    const inherited = process.env[key]

    return {

        ...process.env,

        [key]: [join(directory, "node_modules", ".bin"), inherited].filter(Boolean).join(delimiter)
    }
}
