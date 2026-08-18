import colors from "picocolors"

/** The quiet and emphatic text used by non-interactive command reports. */
export const dim = colors.dim

export const bold = colors.bold

export const accent = colors.cyan

export const positive = colors.green

export const caution = colors.yellow

export const negative = colors.red

// A label, what it says, and where that came from. The label is quiet
// and the value is not, because the value is the thing being reported.
//
// Wide enough for the longest label any command uses, and a space kept
// even when one overruns: a label that runs into its value is worse than
// a column that does not line up.
export function line(label: string, value: string, note?: string) {

    console.log(`  ${dim(column(label))}${value}${note ? `  ${dim(note)}` : ""}`)
}

export function column(label: string) {

    return label.length < 12 ? label.padEnd(12) : `${label} `
}

export function heading(title: string, note?: string) {

    console.log("")

    section(title, note)

    console.log("")
}

export function section(title: string, note?: string) {

    console.log(`  ${bold(title)}${note ? `  ${dim("·")}  ${dim(note)}` : ""}`)
}

export function ending(message: string) {

    console.log(`  ${bold(message)}`)

    console.log("")
}
