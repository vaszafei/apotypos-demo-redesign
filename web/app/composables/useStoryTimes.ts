import type { MaybeRefOrGetter } from 'vue'

// The time and the outlet of each article of a story of the database (#215): data/story-times/<id % STORY_TIME_SHARDS>.json, written by
// docs/redesign/prototypes/scripts/make-article-times.py. A row is [t0, outlet, minutes, outlet, minutes, ...]: t0 in minutes since 1970 UTC, each
// minutes counted from it, in order of time. Read in the browser only, when a story page opens; each file once.
export const STORY_TIME_SHARDS = 50
export type StoryTimes = { outlet: number, time: number }[]

// The day of a minute (since 1970 UTC) in Athens, as the dates of the fixtures (YYYY-MM-DD): a story's day is an Athens day.
const athens = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' })
export const athensDate = (minute: number) => athens.format(new Date(minute * 60000))
// The clock time of a minute in Athens (HH:MM).
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const athensClock = (minute: number) => clock.format(new Date(minute * 60000))

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

// `times` is null for a story with no times (`from`: the first id that has them); `pending` is true while its file loads.
export const useStoryTimes = (id: MaybeRefOrGetter<number>, from: MaybeRefOrGetter<number | undefined>) => {
  const times = ref<StoryTimes | null>(null)
  const pending = ref(false)
  watch(() => [toValue(id), toValue(from)] as const, async ([sid, first]) => {
    times.value = null
    pending.value = false
    if (!import.meta.client || first === undefined || sid < first) return
    pending.value = true
    const shard = await shardOf(sid % STORY_TIME_SHARDS)
    if (toValue(id) !== sid) return
    times.value = storyTimesOf(shard[String(sid)])
    pending.value = false
  }, { immediate: true })
  return { times, pending }
}
