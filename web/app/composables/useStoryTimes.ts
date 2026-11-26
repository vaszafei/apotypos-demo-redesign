import type { MaybeRefOrGetter } from 'vue'

// The time and the outlet of each article of a story of the database (#215): data/story-times/<id % STORY_TIME_SHARDS>.json, written by
// docs/redesign/prototypes/scripts/make-article-times.py. A row is [t0, outlet, minutes, outlet, minutes, ...]: t0 in minutes since 1970 UTC, each
// minutes counted from it, in order of time. Read in the browser only, when a story page opens; each file once.
export const STORY_TIME_SHARDS = 50
export type StoryTimes = { outlet: number, time: number }[]

// The day of a minute (since 1970 UTC) in Athens, as the dates of the fixtures (YYYY-MM-DD): a story's day is an Athens day.
const athens = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' })
export const athensDate = (minute: number) => athens.format(new Date(minute * 60000))

const shards = new Map<number, Promise<Record<string, number[]>>>()
const shardOf = (k: number) => {
  if (!shards.has(k)) shards.set(k, $fetch<Record<string, number[]>>(`/data/story-times/${k}.json`).catch(() => { shards.delete(k); return {} }))
  return shards.get(k)!
}

export const storyTimesOf = (row: number[] | undefined): StoryTimes | null => {
  if (!row) return null
  const out: StoryTimes = []
  for (let i = 1; i < row.length; i += 2) out.push({ outlet: row[i]!, time: row[0]! + row[i + 1]! })
  return out
}

// null while the file loads, and for a story with no times (`from`: the first id that has them).
export const useStoryTimes = (id: MaybeRefOrGetter<number>, from: MaybeRefOrGetter<number | undefined>) => {
  const times = ref<StoryTimes | null>(null)
  watch(() => [toValue(id), toValue(from)] as const, async ([sid, first]) => {
    times.value = null
    if (!import.meta.client || first === undefined || sid < first) return
    const shard = await shardOf(sid % STORY_TIME_SHARDS)
    if (toValue(id) === sid) times.value = storyTimesOf(shard[String(sid)])
  }, { immediate: true })
  return times
}
