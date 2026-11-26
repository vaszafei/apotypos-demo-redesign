// Cut the daily fixtures of public/data/ to the days the database covers (stories.dbCovered[0] on): the app shows only the days whose
// articles have times. docs/redesign/prototypes/data/ keeps every day, so make-db-fixtures.py still has its base. Run by sync-prototype.mjs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const KEYS = ['home', 'media', 'stories', 'storyDetail', 'search', 'groups']

const later = (a, b) => (a > b ? a : b)

export const trimWindow = (fx) => {
  const { home, media, stories, storyDetail: detail, search, groups } = fx
  const from = stories.dbCovered?.[0]
  if (!from) return null
  for (const [name, f] of [['home', home], ['media', media], ['stories', stories], ['storyDetail', detail]]) {
    if (f.dates.join() !== stories.dates.join()) throw new Error(`${name} and stories do not have the same dates`)
  }
  const cut = stories.dates.indexOf(from)
  if (cut < 0) throw new Error(`stories.dates has no ${from}`)
  if (cut === 0) return { from, cut, stories: stories.stories.length }
  const dates = stories.dates.slice(cut)
  const marks = (f) => {
    f.dates = dates
    f.window = [from, f.window[1]]
    if (f.volumeFrom) f.volumeFrom = later(f.volumeFrom, from)
  }

  const kept = new Set()
  stories.stories = stories.stories.filter((s) => {
    const days = []
    for (let i = 0; i < s.days.length; i += 2) if (s.days[i] >= cut) days.push(s.days[i] - cut, s.days[i + 1])
    if (!days.length) return false
    s.days = days
    kept.add(s.id)
    return true
  })
  marks(stories)

  detail.stories = detail.stories.filter((s) => kept.has(s.id))
  for (const s of detail.stories) {
    const t = []
    for (let i = 0; i < s.t.length; i += 3) if (s.t[i + 1] >= cut) t.push(s.t[i], s.t[i + 1] - cut, s.t[i + 2])
    s.t = t
  }
  marks(detail)

  media.outletDaily = media.outletDaily.map((row) => row.slice(cut))
  media.issueDaily = media.issueDaily.map((row) => row.slice(cut))
  media.stories = media.stories
    .map((s) => ({ ...s, daily: s.daily.slice(cut) }))
    .filter((s) => s.daily.some((v) => v))
  media.storyDays = stories.stories.map((s) => s.days)
  marks(media)

  const articles = new Map(media.outlets.map((o, k) => [o.name, media.outletDaily[k].reduce((a, c) => a + (c?.[0] ?? 0), 0)]))
  for (const o of detail.outlets) o.total = articles.get(o.name) ?? 0

  for (const o of home.outlets) o.daily = o.daily.slice(cut)
  home.issueDaily = home.issueDaily.map((row) => row.slice(cut))
  marks(home)

  if (search) search.storyRows = search.storyRows.filter(([id]) => kept.has(id))

  // The articles of each outlet and group are counted again in the window; the rest of groups (analysed, stance, topics) is Aug–Sep, and the app hides it.
  if (groups) {
    const bySlug = new Map(media.outlets.map((o) => [o.slug, articles.get(o.name) ?? 0]))
    const recount = (o) => { o.collected = bySlug.get(o.slug) ?? 0 }
    for (const g of groups.groups) {
      g.outlets.forEach(recount)
      g.outlets.sort((a, b) => b.collected - a.collected)
      g.collected = g.outlets.reduce((a, o) => a + o.collected, 0)
    }
    groups.ungrouped.forEach(recount)
    groups.ungrouped.sort((a, b) => b.collected - a.collected)
    groups.totalCollected = groups.groups.reduce((a, g) => a + g.collected, 0) + groups.ungrouped.reduce((a, o) => a + o.collected, 0)
    groups.window = [from, stories.window[1]]
  }
  return { from, cut, stories: stories.stories.length }
}

// public/data/ after buildFixtures: each key as <key>.json, and the static pages read the same data as <key>.js.
export const trimDataDir = (dir) => {
  const fx = Object.fromEntries(KEYS.filter((k) => existsSync(`${dir}${k}.json`)).map((k) => [k, JSON.parse(readFileSync(`${dir}${k}.json`, 'utf8'))]))
  const done = trimWindow(fx)
  if (!done || done.cut === 0) return done
  for (const [key, value] of Object.entries(fx)) {
    const text = JSON.stringify(value)
    writeFileSync(`${dir}${key}.json`, text)
    writeFileSync(`${dir}${key}.js`, `window.FIXTURES=window.FIXTURES||{};window.FIXTURES[${JSON.stringify(key)}]=${text};\n`)
  }
  return done
}
