// Αναλύσεις › ΟΗΕ › Ισραήλ–Παλαιστίνη (un-israel-v2.html): the Israel–Palestine part of the 192 speeches. A speech has only its main topics (shares), so the cards count the speeches with the topic among them.
import type { UnSpeech } from './un-hall.ts'
import { UN_ISRAEL_TOPIC } from './un-hall.ts'
import { unTopicMinutes } from './un-topics.ts'

// The attacks of a speech on a target. A target such as "United States and Israel" counts for Israel.
export const unAttacksOn = (r: UnSpeech, name: string) => r.targets.reduce((a, [k, n]) => a + (k.includes(name) ? n : 0), 0)

export interface UnIsraelRow extends UnSpeech { share: number, minutes: number, israel: number, hamas: number }

export const unIsraelPage = (speeches: UnSpeech[]) => {
  const mins = unTopicMinutes(speeches)
  const total = mins.topics.find(a => a.topic === UN_ISRAEL_TOPIC)
  const rank = mins.topics.findIndex(a => a.topic === UN_ISRAEL_TOPIC) + 1
  const rows: UnIsraelRow[] = speeches.map((r) => {
    const share = r.shares.find(([k]) => k === UN_ISRAEL_TOPIC)?.[1] ?? 0
    return { ...r, share, minutes: (share * r.seconds) / 60, israel: unAttacksOn(r, 'Israel'), hamas: unAttacksOn(r, 'Hamas') }
  })
  const onTopic = rows.filter(r => r.share > 0).sort((a, b) => b.minutes - a.minutes)
  const israel = rows.filter(r => r.israel).sort((a, b) => b.israel - a.israel)
  const hamas = rows.filter(r => r.hamas)
  const sum = (list: UnIsraelRow[], k: 'israel' | 'hamas') => list.reduce((a, r) => a + r[k], 0)
  return { minutes: total?.minutes ?? 0, speeches: total?.speeches ?? 0, rank, topics: mins.topics.length, onTopic, israel, hamas, israelAttacks: sum(israel, 'israel'), hamasAttacks: sum(hamas, 'hamas') }
}
