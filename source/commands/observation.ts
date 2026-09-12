/** Wait for one named event while preserving the target's own subscription contract. */
export async function wait(target: { wait(event: never, timeout?: number): Promise<unknown> }, event: string, timeout?: number) {
    return target.wait(event as never, timeout)
}
