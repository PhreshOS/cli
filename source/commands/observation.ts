/** Wait for one named event while preserving the target's own subscription contract. */
export async function wait(target: { waitFor(event: never, timeout?: number): Promise<unknown> }, event: string, timeout?: number) {
    return target.waitFor(event as never, timeout)
}
