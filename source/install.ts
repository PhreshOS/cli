import derive from "./derive.ts"
import { readConfig } from "./project.ts"
import { dim, heading } from "./style.ts"
import speak from "./program-intake.ts"
import build from "./build-command.ts"

/**
 * Lay this program out on this machine's system.
 *
 * What is sent is the description the config derives — the same one
 * `phresh start` runs from — and the system copies what it names into
 * place. A program's parts are already on this disk at the locations it
 * names, so there is nothing an archive would carry that the description
 * does not already point at.
 *
 * **Installing takes no package, and neither does the system.** A
 * package is a way of *carrying* a program to another machine, which is
 * a different act from laying one out — and installing programs at all
 * is work for a program rather than for the core, so what a person
 * installs *from* is not this command's business either. `phresh pack`
 * makes a package when you have somewhere to send it, and stops there.
 *
 * When the author config declares `buildCommand`, it runs here before the
 * production Program is derived and sent. The command remains authoring
 * metadata and never becomes part of the installed Program.
 *
 * Installing is not running. A program laid out here stays until
 * something removes it, and `phresh start` and `phresh dev` are for the
 * other way a program is used — attached to the terminal that began it,
 * and gone when that ends.
 */
export default async function install(directory = process.cwd()) {

    const config = await readConfig(directory)

    await build(config, directory)

    const program = derive(config, directory, "production")

    await speak({ word: "install", program }, function (event) {

        if (event.event !== "installed") return

        const said = event.program as { identity?: string, name?: string, version?: string | null }

        heading(`${said.name ?? String(said.identity)}${said.version ? ` ${said.version}` : ""}`, event.replaced ? "reinstalled" : "installed")

        // What it kept. Every process ended before the installed paths
        // changed, while storage stayed in its canonical place.
        if (event.replaced) console.log(`  ${dim("its storage was kept, and its previous processes were ended")}\n`)
    })
}
