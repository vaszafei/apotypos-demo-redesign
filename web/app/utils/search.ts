// The matching and the index of the global search, from assets/shell.js (fold, latin, pageEntries, indexEntries, keysOf, match, readRecent, remember).
// It takes the text function and the storage as arguments, so a node test can run it.
export type Translate = (key: string, named?: Record<string, string | number>) => string
export type Kind = 'pages' | 'outlets' | 'groups' | 'topics' | 'stories' | 'cases' | 'people' | 'statements' | 'parties' | 'bylines' | 'speeches'

// The kinds in the order of the results. Each shows its best 3 to 6 and "Εμφάνιση όλων" for the rest.
export const KINDS: Kind[] = ['pages', 'outlets', 'groups', 'topics', 'stories', 'cases', 'people', 'statements', 'parties', 'bylines', 'speeches']
export const LIMITS: Record<Kind, number> = { pages: 5, outlets: 5, groups: 3, topics: 4, stories: 6, cases: 3, people: 5, statements: 3, parties: 3, bylines: 3, speeches: 4 }
// "Εμφάνιση όλων" draws up to 300 of a kind: a query that finds more (one letter) asks for more letters.
export const SHOW_ALL = 300

export interface Entry {
  kind: Kind
  n: string
  d?: string
  // The static page of the entry (a file with its query), as in search.json. A page of the site also has its route.
  h: string
  route?: string
  where: string
  alt?: (string | undefined)[]
  outlets?: number
  key?: string
  latinKey?: string
}
interface RawEntity { n: string, en?: string, d?: string, h: string, r?: string, s?: string, a?: string[] }
export interface SearchIndex {
  storyRows: [number, string, number, number, string?][]
  kinds: Partial<Record<Kind, RawEntity[]>>
}

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ')
// Most outlet and group names are in Latin letters, so a Greek query also matches in Latin letters ("πολιτ" finds "Politis"),
// and a Latin query matches a Greek name in Latin letters ("tsipras" finds "Τσίπρας").
const LATIN: Record<string, string> = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' }
export const latin = (s: string) => s.replace(/[α-ω]/g, c => LATIN[c] ?? c)

// The sections and pages of NAV in assets/shell.js, in full (the nav of the shell, useNav, lists only the pages that are ported). Each page is [key, route, parent tab key].
type Tab = [key: string, route: string, subs?: [string, string][]]
interface Item { key: string, tabs: Tab[], details?: [string, string][] }
export const PAGE_TREE: Item[] = [
  { key: 'home', tabs: [['home', '/']] },
  { key: 'media', tabs: [['overview', '/media'], ['ownership', '/groups'], ['topics', '/trends'], ['stories', '/stories'], ['writing', '/media/writing'], ['similarity', '/similarity']],
    details: [['/outlet', '/media'], ['/group', '/groups'], ['/topic', '/trends'], ['/story', '/stories']] },
  { key: 'people', tabs: [['overview', '/fingerprints'], ['spread', '/fingerprints/spread']], details: [['/person', '/fingerprints']] },
  { key: 'world', tabs: [
    ['speeches', '/speeches', [['speeches.all', '/speeches'], ['speeches.pi', '/un-israel-palestine']]],
    ['pi', '/narrative', [['pi.overview', '/narrative'], ['gaza', '/gaza'], ['israel', '/israel'], ['language', '/gaza-language']]],
    ['greekturkish', '/war'], ['coverage', '/coverage'], ['france', '/france-riots'], ['rouvikonas', '/cases'],
    ['elections', '/elections', [['elections.reach', '/elections'], ['elections.outlets', '/elections/outlets'], ['elections.owners', '/elections/owners'], ['elections.topics', '/elections/topics'], ['elections.bylines', '/elections/bylines']]]
  ] }
]
export const FOOTER: [string, string][] = [['methodology', '/methodology'], ['about', '/about']]

type Page = [key: string, route: string, parent: Tab | null]
const pagesOf = (item: Item): Page[] => item.tabs.flatMap((tab): Page[] => (tab[2] ? tab[2].map(([key, r]): Page => [key, r, tab]) : [[tab[0], tab[1], null]]))
const under = (route: string, base: string) => route === base || (base !== '/' && route.startsWith(`${base}/`))
const itemOf = (route: string) => PAGE_TREE.find(item => pagesOf(item).some(([, r]) => under(route, r)) || (item.details ?? []).some(([r]) => under(route, r)))
// "Item › Tab" or "Item › Tab › Sub-tab". An item with one tab is "Item".
const pageLabel = (t: Translate, item: Item, [key, , parent]: Page) => {
  if (item.tabs.length < 2) return t(`nav.${item.key}`)
  return [t(`nav.${item.key}`), parent && t(`tab.${item.key}.${parent[0]}`), t(`tab.${item.key}.${key}`)].filter(Boolean).join(' › ')
}
// The label of the place of a route. It is null for a route with no sidebar item.
export const placeOf = (t: Translate, route?: string) => {
  const item = route ? itemOf(route) : undefined
  if (!item || !route) return null
  const pages = pagesOf(item)
  const page = pages.find(([, r]) => r === route) ?? pages.find(([, r]) => under(route, r))
  return page ? pageLabel(t, item, page) : t(`nav.${item.key}`)
}

// A page or tab: its own name, and where it lives (the section, and the tab of a sub-tab).
export const pageEntries = (t: Translate, hrefOf: (route: string) => string): Entry[] => {
  const named = PAGE_TREE.flatMap(item => pagesOf(item).map((page): Entry => {
    const path = pageLabel(t, item, page).split(' › ')
    return { kind: 'pages', n: path.pop()!, where: path.join(' › '), h: hrefOf(page[1]), route: page[1] }
  }))
  return [...named, ...FOOTER.map(([key, r]): Entry => ({ kind: 'pages', n: t(`nav.${key}`), where: '', h: hrefOf(r), route: r }))]
}

// The entries of the index, in the language of the page. The place of an entry is the page that lists it.
export const indexEntries = (index: SearchIndex, locale: string, t: Translate) => {
  const name = (x: { n: string, en?: string }) => (locale === 'en' && x.en) || x.n
  const topics = index.kinds.topics ?? []
  const where = (x: RawEntity) => [placeOf(t, x.r), x.s && t(`shell.search.set.${x.s}`)].filter(Boolean).join(' · ')
  const out = {} as Record<Kind, Entry[]>
  for (const kind of KINDS.slice(1)) out[kind] = (index.kinds[kind] ?? []).map((x): Entry => ({ kind, n: name(x), d: x.d, h: x.h, where: where(x), alt: [x.n, x.en, ...(x.a ?? [])] }))
  const storyWhere = placeOf(t, '/stories') ?? ''
  out.stories.unshift(...index.storyRows.map(([id, el, issue, outlets, en]): Entry =>
    ({ kind: 'stories', n: (locale === 'en' && en) || el, d: topics[issue] ? name(topics[issue]) : undefined, h: `story-v2.html?id=${id}`, where: storyWhere, alt: [el, en], outlets })))
  return out
}

const keysOf = (e: Entry) => {
  if (!e.key) {
    e.key = fold([e.n, e.where && e.kind === 'pages' ? e.where : '', ...(e.alt ?? [])].filter(Boolean).join(' '))
    e.latinKey = latin(e.key)
  }
  return e
}
// All the hits of a query, the best first: a name that starts with the query, then a word that starts with it, then the rest.
export const match = (entries: Entry[], query: string) => {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const latinWords = words.map(latin)
  const hits: { e: Entry, rank: number }[] = []
  if (!words.length) return []
  for (const e of entries) {
    keysOf(e)
    const found = ([[words, e.key!], [latinWords, e.key!], [words, e.latinKey!]] as [string[], string][]).find(([list, k]) => list.every(w => k.includes(w)))
    if (!found) continue
    const [list, k] = found
    hits.push({ e, rank: k.startsWith(list[0]!) ? 0 : k.includes(` ${list[0]}`) ? 1 : 2 })
  }
  return hits.sort((a, b) => a.rank - b.rank).map(x => x.e)
}

// The last pages and searches of the visitor, in this browser only. The key is the one of the static pages, so both share them.
export const RECENT_KEY = 'proto-search-recent'
export interface RecentPage { h: string, n: string, r?: string }
export interface Recent { pages: RecentPage[], queries: string[] }
export const readRecent = (): Recent => {
  try {
    const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? 'null')
    return { pages: r?.pages ?? [], queries: r?.queries ?? [] }
  } catch { return { pages: [], queries: [] } }
}
export const remember = <K extends keyof Recent>(kind: K, value: Recent[K][number], same: (x: Recent[K][number]) => boolean) => {
  const recent = readRecent()
  recent[kind] = [value, ...(recent[kind] as Recent[K][number][]).filter(x => !same(x))].slice(0, 6) as Recent[K]
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch { /* storage is not available */ }
}
