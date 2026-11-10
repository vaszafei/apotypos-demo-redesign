// The data of Ιδιοκτησία (groups-v2.html) and the small rules the page keeps: colors of the groups, short names, the gap of the crawler.
export interface GroupOutlet { name: string, slug: string, collected: number, analysed: number, news: number, stance: [number, number, number] }
export interface GroupRecord { slug: string, name: string, owner: string, lean: string | null, collected: number, analysed: number, topics: number[], outlets: GroupOutlet[] }
export interface GroupsData {
  window: [string, string]
  record: { source: string, exportedAt: string }
  totalCollected: number
  topicsAll: number[]
  groups: GroupRecord[]
  ungrouped: GroupOutlet[]
}
export interface MediaDaily {
  dates: string[]
  outlets: { name: string, slug: string, group: string | null, owner: string | null }[]
  outletDaily: number[][][]
}

// An outlet of the network and the table: the collected articles are its value.
export interface NetOutlet { name: string, slug: string, value: number, analysed: number, news: number, stance: [number, number, number] }
// A group of the network: key null is the outlets with no group in the ownership record.
export interface NetGroup { key: string | null, label: string, owner: string | null, color: string, slug?: string, lean?: string | null, outlets: NetOutlet[], value: number }

// A day with fewer articles than this is a gap of the crawler, not a quiet day.
export const GAP = 50
export const NO_GROUP = 'var(--cat-0)'

// The fixed group to slot map (Dash.groupColors): a group has the same color on every page. Antenna Group is only in the live data, so it has a 9th slot.
const GROUP_SLOT = new Map([['Alter Ego Media', 1], ['DPG Digital Media', 2], ['Συμφέροντα Μπάκου-Καϋμενάκη', 3], ['Politis Group', 4],
  ['Συμφέροντα Μελισσανίδη', 5], ['Όμιλος ΣΚΑΪ', 6], ['Συμφέροντα Σαββίδη', 7], ['Όμιλος Βαρδινογιάννη', 8], ['Antenna Group', 9]])
export const groupColors = (groups: { name: string }[]) => new Map(groups.map((g, i) => [g.name, `var(--cat-${GROUP_SLOT.get(g.name) ?? (i % 8) + 1})`]))

// The name of a group without the word that most of them start with, for the legends and the labels of the charts.
export const shortName = (name: string) => name.replace(/^Συμφέροντα\s+/, '')
// The shortest name that is still the group, for the legend of the line chart: one line.
export const compactName = (label: string, none: boolean, noneLabel: string) => (none ? noneLabel : shortName(label).replace(/^Όμιλος\s+/, '').replace(/\s+(Digital Media|Media|Group)$/, '').replace(/-.*$/, ''))

export const stanceTotals = (outlets: { stance: [number, number, number] }[]): [number, number, number] =>
  outlets.reduce<[number, number, number]>((a, o) => [a[0] + o.stance[0], a[1] + o.stance[1], a[2] + o.stance[2]], [0, 0, 0])

// The color of a mix of a token color with white (Dash.tint), written for CSS so it follows the theme.
export const tintOf = (color: string, k: number) => `color-mix(in srgb, ${color} ${Math.round((1 - k) * 100)}%, white)`
