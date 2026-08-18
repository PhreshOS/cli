import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import SystemInstallation from "../dist/system/installation.js"
import { downloadSystemRelease, resolveSystemRelease } from "../dist/system/release.js"

const temporary = await mkdtemp(join(tmpdir(), "phresh-system-release-"))

const paths = {

    root: join(temporary, "system"),

    releases: join(temporary, "system", "releases"),

    current: join(temporary, "system", "current"),

    storage: join(temporary, "state"),

    intake: join(temporary, "state", "intake.sock"),

    log: join(temporary, "state", "service.log")
}

try {

    const release = await resolveSystemRelease()

    const downloaded = await downloadSystemRelease(release)

    const installation = new SystemInstallation(paths)

    const prepared = await installation.prepare(downloaded)

    console.log(`Verified PhreshOS System ${release.version} (${downloaded.digest})`)

    await installation.abandon(prepared)
}

finally {

    await rm(temporary, { recursive: true, force: true })
}
