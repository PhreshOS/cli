export interface SystemPaths {

    root: string

    releases: string

    current: string

    storage: string

    intake: string

    log: string
}

export interface SystemRelease {

    version: string

    archive: string

    checksum: string
}

export interface DownloadedSystem extends SystemRelease {

    bytes: Buffer

    digest: string
}

export interface InstalledSystem {

    version: string

    digest: string

    directory: string

    installedAt: string
}

export interface SystemServiceDefinition {

    executable: string

    entry: string

    directory: string

    output: string
}

export interface SystemServiceState {

    registered: boolean

    enabled: boolean

    running: boolean

    pid?: number
}

export interface SystemService {

    inspect(): Promise<SystemServiceState>

    register(definition: SystemServiceDefinition): Promise<void>

    unregister(): Promise<void>

    start(): Promise<void>

    stop(): Promise<void>

    enable(): Promise<void>

    disable(): Promise<void>
}
