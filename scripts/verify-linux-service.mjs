import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import LinuxSystemService from "../dist/system/service/linux.js"

if (process.platform !== "linux") throw new Error("The Linux service verifier must run on Linux")

const temporary = await mkdtemp(join(tmpdir(), "phresh-linux-service-"))

const entry = join(temporary, "service.mjs")

const output = join(temporary, "state with spaces", "service.log")

const success = async (_command, args) => ({

    code: 0,

    stdout: args.includes("show-environment") ? `HOME=${temporary}\n` : "",

    stderr: ""
})

try {

    await writeFile(entry, "setInterval(() => undefined, 1000)\n")

    const service = new LinuxSystemService(temporary, success)

    await service.register({ executable: process.execPath, entry, arguments: [], directory: temporary, output })

    const unit = join(temporary, ".config", "systemd", "user", "phreshos.service")

    execFileSync("systemd-analyze", ["verify", unit], { stdio: "inherit" })

    console.log("Verified the Linux systemd service definition")
}

finally {

    await rm(temporary, { recursive: true, force: true })
}
