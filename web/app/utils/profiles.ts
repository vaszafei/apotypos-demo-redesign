import type { StoryDetailData } from '~/types/story-detail'

// The profile of every story (Spread.profiles of assets/spread.js): the groups that wrote it, and how it started.
// type: together (2 or more groups on the first day with a group), follow (one group first, the others later), single (one group on all days), none (no outlet with a group).
export interface StoryProfile { id: number, articles: number, reach: number, peak: number, peakGroups: number[], firstGroups: number[], groupsAll: number[], type: 'none' | 'single' | 'together' | 'follow' }

export const storyProfiles = (dd: StoryDetailData) => {
  const groups = [...new Set(dd.outlets.map(o => o.group).filter((g): g is string => !!g))]
  const index = new Map(groups.map((g, i) => [g, i]))
  const list: StoryProfile[] = dd.stories.map((s) => {
    const byDay = new Map<number, Set<number>>()
    let articles = 0
    for (let i = 0; i < s.t.length; i += 3) {
      articles += s.t[i + 2]!
      const g = dd.outlets[s.t[i]!]!.group
      if (!g) continue
      const day = s.t[i + 1]!
      byDay.set(day, (byDay.get(day) ?? new Set()).add(index.get(g)!))
    }
    const days = [...byDay.keys()].sort((a, b) => a - b)
    let peak = -1
    let reach = 0
    for (const day of days) {
      const size = byDay.get(day)!.size
      if (size >= reach) { reach = size; peak = day }
    }
    const all = new Set<number>()
    byDay.forEach(set => set.forEach(g => all.add(g)))
    const firstGroups = days.length ? [...byDay.get(days[0]!)!] : []
    const type = all.size === 0 ? 'none' : all.size === 1 ? 'single' : firstGroups.length >= 2 ? 'together' : 'follow'
    return { id: s.id, articles, reach, peak, peakGroups: peak < 0 ? [] : [...byDay.get(peak)!], firstGroups, groupsAll: [...all], type }
  })
  return { groups, list }
}
