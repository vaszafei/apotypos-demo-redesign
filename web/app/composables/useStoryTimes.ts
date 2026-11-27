import type { MaybeRefOrGetter } from 'vue'

// The time and the outlet of each article of a story of the database (#215): data/story-times/<id % STORY_TIME_SHARDS>.json, written by
// docs/redesign/prototypes/scripts/make-article-times.py. A row is [t0, outlet, minutes, outlet, minutes, ...]: t0 in minutes since 1970 UTC, each
// minutes counted from it, in order of time. Read in the browser only, when a story page opens; each file once.
// data/story-titles/<same shard>.json has the title of each article, in the same order ("" when it has none).
// data/story-related/<same shard>.json has the stories about the same thing, by the vectors of the articles (make-story-related.py): for each, the cosine
// of the two stories (x 1000) and the places, in this order, of the articles about it.
export const STORY_TIME_SHARDS = 50
// data/story-core/<same shard>.json: how near each article is to the story's vector (cosine x 1000, make-story-related.py), as `core` (0 to 1).
export type StoryTimes = { outlet: number, time: number, title?: string, core?: number }[]
export type StoryLinks = { id: number, cosine: number, picks: number[] }[]
// data/story-copies/<same shard>.json: the articles that are copies of an earlier article of another outlet, with that article ([copy, source], places in this order).
export type StoryCopies = [number, number][]

// The day of a minute (since 1970 UTC) in Athens, as the dates of the fixtures (YYYY-MM-DD): a story's day is an Athens day.
const athens = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' })
export const athensDate = (minute: number) => athens.format(new Date(minute * 60000))
// The clock time of a minute in Athens (HH:MM).
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const athensClock = (minute: number) => clock.format(new Date(minute * 60000))

const shards = new Map<string, Promise<Record<string, unknown[]>>>()
const shardOf = <T>(folder: string, k: number) => {
  const key = `${folder}/${k}`
  if (!shards.has(key)) shards.set(key, $fetch<Record<string, unknown[]>>(`/data/${key}.json`).catch(() => { shards.delete(key); return {} }))
  return shards.get(key)! as Promise<Record<string, T[]>>
}

export const storyTimesOf = (row: number[] | undefined, titles?: string[], cores?: number[]): StoryTimes | null => {
  if (!row) return null
  const out: StoryTimes = []
  for (let i = 1; i < row.length; i += 2) {
    const title = titles?.[(i - 1) / 2]
    const core = cores?.[(i - 1) / 2]
    out.push({ outlet: row[i]!, time: row[0]! + row[i + 1]!, ...(title ? { title } : {}), ...(core !== undefined ? { core: core / 1000 } : {}) })
  }
  return out
}

// `times` and `links` are null for a story with no times (`from`: the first id that has them); `pending` is true while its files load.
export const useStoryTimes = (id: MaybeRefOrGetter<number>, from: MaybeRefOrGetter<number | undefined>) => {
  const times = ref<StoryTimes | null>(null)
  const links = ref<StoryLinks | null>(null)
  const copies = ref<StoryCopies | null>(null)
  const pending = ref(false)
  watch(() => [toValue(id), toValue(from)] as const, async ([sid, first]) => {
    times.value = null
    links.value = null
    copies.value = null
    pending.value = false
    if (!import.meta.client || first === undefined || sid < first) return
    pending.value = true
    const k = sid % STORY_TIME_SHARDS
    const [shard, titled, linked, copied, cored] = await Promise.all([shardOf<number>('story-times', k), shardOf<string>('story-titles', k), shardOf<[number, number, number[]]>('story-related', k), shardOf<number>('story-copies', k), shardOf<number>('story-core', k)])
    if (toValue(id) !== sid) return
    times.value = storyTimesOf(shard[String(sid)], titled[String(sid)], cored[String(sid)])
    links.value = times.value ? (linked[String(sid)] ?? []).map(([other, cosine, picks]) => ({ id: other, cosine: cosine / 1000, picks })) : null
    const flat = copied[String(sid)] ?? []
    copies.value = times.value ? Array.from({ length: flat.length / 2 }, (_, i) => [flat[i * 2]!, flat[i * 2 + 1]!] as [number, number]) : null
    pending.value = false
  }, { immediate: true })
  return { times, links, copies, pending }
}
