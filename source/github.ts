/** Headers for requests to GitHub's API, never for release asset hosts. */
export function githubApiHeaders(): Record<string, string> {

    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

    return {
        Accept: "application/vnd.github+json",
        "User-Agent": "@phreshos/cli",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
}
