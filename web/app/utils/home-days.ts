// The days of «Η επικαιρότητα» (the calendar of Home.Calendar in assets/home.js): the articles of all outlets for each day, the change against the day before, the months of the dates.

// The articles of every outlet summed for each day; null when no outlet has a count for that day (the data has ended).
export const dayTotals = (outlets: { daily: (number | null)[] }[], days: number): (number | null)[] =>
  Array.from({ length: days }, (_, i) => {
    let seen = false
    let total = 0
    for (const o of outlets) {
      const v = o.daily[i]
      if (v === null || v === undefined) continue
      seen = true
      total += v
    }
    return seen ? total : null
  })

// The change of day i against the day before, as a percentage; null for the first day, a day with no count, or a day before with none.
export const dayChange = (totals: (number | null)[], i: number): number | null => {
  const now = totals[i]
  const before = totals[i - 1]
  if (i === 0 || now === null || now === undefined || before === null || before === undefined || !(before > 0)) return null
  return ((now - before) / before) * 100
}

// The months (YYYY-MM) the dates run through, in order.
export const monthsOf = (dates: string[]): string[] => [...new Set(dates.map(d => d.slice(0, 7)))]

// The last day that has a count, which the calendar starts on.
export const lastCounted = (totals: (number | null)[]): number => Math.max(0, totals.findLastIndex(v => v !== null))
