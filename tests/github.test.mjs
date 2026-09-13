import { afterEach, expect, test, vi } from "vitest"
import { githubApiHeaders } from "../dist/github.js"

afterEach(() => vi.unstubAllEnvs())

test("GitHub API authentication is optional", () => {
    vi.stubEnv("GH_TOKEN", undefined)
    vi.stubEnv("GITHUB_TOKEN", undefined)
    expect(githubApiHeaders()).not.toHaveProperty("Authorization")
})

test("GitHub API requests use the explicit token before the Actions token", () => {
    vi.stubEnv("GH_TOKEN", "explicit-token")
    vi.stubEnv("GITHUB_TOKEN", "actions-token")
    expect(githubApiHeaders().Authorization).toBe("Bearer explicit-token")
    vi.stubEnv("GH_TOKEN", undefined)
    expect(githubApiHeaders().Authorization).toBe("Bearer actions-token")
})
