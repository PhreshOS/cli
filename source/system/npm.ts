import { win32 } from "node:path"

/** Invoke npm without asking a platform command shell to interpret its shim. */
export default function npmInvocation(args: string[], platform = process.platform, executable = process.execPath) {

    if (platform !== "win32") return { command: "npm", args }

    const npm = win32.join(win32.dirname(executable), "node_modules", "npm", "bin", "npm-cli.js")

    return { command: executable, args: [npm, ...args] }
}
