/** Writes one validated Program lifecycle-command output event verbatim. */
export default function writeProgramCommandOutput(event: Record<string, unknown>) {

    if ((event.stream !== "stdout" && event.stream !== "stderr") || typeof event.text !== "string") {

        throw new Error("The System returned an invalid Program command output chunk")
    }

    const output = event.stream === "stderr" ? process.stderr : process.stdout

    output.write(event.text)
}
