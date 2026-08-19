import type { SystemService, SystemServiceDefinition } from "../types.ts"
import { execute, type ProcessResult } from "../process.ts"
import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const scheduler = "schtasks.exe"

const powershell = "powershell.exe"

const defaultTask = "PhreshOS System"

/** A per-user Windows Task Scheduler service requiring no administrator rights. */
export default class WindowsSystemService implements SystemService {

    public constructor(

        private readonly userHome: string,

        private readonly run: (command: string, args: string[]) => Promise<ProcessResult> = execute,

        private readonly task = defaultTask
    ) {}

    public async inspect() {

        const result = await this.run(powershell, powershellArguments(inspectScript(this.task)))

        if (result.code === 3) return absent()

        if (result.code !== 0) throw failure(powershell, result)

        const match = /^([0-4]),([01])$/.exec(result.stdout.trim())

        if (!match) throw new Error("The PhreshOS System scheduled task returned an invalid state")

        return {

            registered: true,

            automaticStartup: true,

            enabled: match[2] === "1",

            running: match[1] === "4"
        }
    }

    public async register(definition: SystemServiceDefinition) {

        await this.stop()

        await mkdir(dirname(definition.output), { recursive: true })

        const sid = await this.userSid()

        const temporary = join(this.userHome, `.phreshos-system-${randomUUID()}.xml`)

        try {

            await writeFile(temporary, utf16(task(this.task, sid, definition)))

            await this.require(scheduler, ["/Create", "/TN", this.task, "/XML", temporary, "/F"])
        }

        finally {

            await rm(temporary, { force: true })
        }
    }

    public async unregister() {

        const state = await this.inspect()

        if (!state.registered) return

        if (state.running) await this.stop()

        await this.require(scheduler, ["/Delete", "/TN", this.task, "/F"])
    }

    public async start() {

        const state = await this.inspect()

        if (!state.registered) throw new Error("The PhreshOS System service is not registered")

        if (state.running) return

        // Task Scheduler refuses an explicit run while a task is disabled.
        // Enablement names future logons, not current execution, so borrow it
        // only for the launch and restore the persisted choice immediately.
        if (!state.enabled) await this.change("/Enable")

        try {

            await this.require(scheduler, ["/Run", "/TN", this.task])
        }

        finally {

            if (!state.enabled) await this.change("/Disable")
        }
    }

    public async stop() {

        const state = await this.inspect()

        if (!state.registered || !state.running) return

        await this.require(scheduler, ["/End", "/TN", this.task])

        const until = Date.now() + 5_000

        while (Date.now() < until && (await this.inspect()).running) await new Promise(settle => setTimeout(settle, 50))

        if ((await this.inspect()).running) throw new Error("The PhreshOS System scheduled task did not stop")
    }

    public async enable() {

        await this.requireRegistered()

        await this.change("/Enable")
    }

    public async disable() {

        await this.requireRegistered()

        await this.change("/Disable")
    }

    private async userSid() {

        const result = await this.run(powershell, powershellArguments("[Console]::Out.Write([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)"))

        if (result.code !== 0) throw failure(powershell, result)

        const sid = result.stdout.trim()

        if (!/^S-[0-9]+(?:-[0-9]+)+$/.test(sid)) throw new Error("The current Windows user could not be identified")

        return sid
    }

    private async requireRegistered() {

        if (!(await this.inspect()).registered) throw new Error("The PhreshOS System service is not registered")
    }

    private async change(action: "/Enable" | "/Disable") {

        await this.require(scheduler, ["/Change", "/TN", this.task, action])
    }

    private async require(command: string, args: string[]) {

        const result = await this.run(command, args)

        if (result.code !== 0) throw failure(command, result)
    }
}

function absent() {

    return { registered: false, automaticStartup: true, enabled: false, running: false }
}

function inspectScript(name: string) {

    const selected = quotePowerShell(name)

    return `$task = Get-ScheduledTask -TaskName ${selected} -TaskPath '\\' -ErrorAction SilentlyContinue; if ($null -eq $task) { exit 3 }; [Console]::Out.Write(("{0},{1}" -f [int]$task.State, [int]$task.Settings.Enabled))`
}

function task(name: string, sid: string, definition: SystemServiceDefinition) {

    const run = [

        "$ErrorActionPreference = 'Stop'",

        `$executable = ${quotePowerShell(definition.executable)}`,

        `$entry = ${quotePowerShell(definition.entry)}`,

        `$output = ${quotePowerShell(definition.output)}`,

        "& $executable $entry *>> $output",

        "exit $LASTEXITCODE"
    ].join("; ")

    const argumentsValue = `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${Buffer.from(run, "utf16le").toString("base64")}`

    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>PhreshOS System</Description>
    <URI>\\${xml(name)}</URI>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${xml(sid)}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="User">
      <UserId>${xml(sid)}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="User">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>${xml(argumentsValue)}</Arguments>
      <WorkingDirectory>${xml(definition.directory)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`
}

function powershellArguments(script: string) {

    return ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]
}

function quotePowerShell(value: string) {

    return `'${value.replaceAll("'", "''")}'`
}

function xml(value: string) {

    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}

function utf16(value: string) {

    return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(value, "utf16le")])
}

function failure(command: string, result: ProcessResult) {

    return new Error(result.stderr.trim() || result.stdout.trim() || `${command} exited with code ${result.code}`)
}
