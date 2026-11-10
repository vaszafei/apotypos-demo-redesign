import type { StoriesData, Story } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { GroupRecord, GroupsData, MediaDaily } from '~/utils/groups'
import { storyProfiles } from './profiles.ts'

// The numbers of the group page (group-v2.html): the daily articles of the group, its stories and the topics it writes more or less than all outlets.

export const GROUP_TOPICS = 10
export const GROUP_STORIES = 4
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// The articles of the group per day: [analysed, news], added over its outlets. A day is null when no outlet of the group has that count that day.
export const groupDaily = (media: MediaDaily, group: GroupRecord) => {
  const members = new Set(group.outlets.map(o => o.slug))
  return media.dates.map((_, day) => {
    let analysed: number | null = null
    let news: number | null = null
    media.outlets.forEach((o, k) => {
      if (!members.has(o.slug)) return
      const [a, n] = media.outletDaily[k]![day] as [number | null, number | null]
      if (a !== null) analysed = (analysed ?? 0) + a
      if (n !== null) news = (news ?? 0) + n
    })
    return [analysed, news] as [number | null, number | null]
  })
}

// The facts of the title card come from the groups file, so the days end where the window of that file ends.
export const groupWindow = (daily: [number | null, number | null][], dates: string[], windowEnd: string) => {
  const start = daily.findIndex(c => (c[0] ?? 0) > 0)
  const end = Math.min(dates.indexOf(windowEnd), daily.length - 1 - [...daily].reverse().findIndex(c => (c[0] ?? 0) > 0))
  return { start, end }
}

// The stories of the group: its articles, its days, and how the group started the story (from the profiles of the page Ιστορίες).
export interface GroupStory { story: Story | undefined, n: number, days: number[] }
export const storiesOfGroup = (list: StoriesData, dd: StoryDetailData, group: GroupRecord, last: number) => {
  const members = new Set(group.outlets.map(o => o.slug))
  const profiles = storyProfiles(dd)
  const gi = profiles.groups.indexOf(group.name)
  const profileOf = new Map(profiles.list.map(p => [p.id, p]))
  const storyOf = new Map(list.stories.map(s => [s.id, s]))
  const mine: GroupStory[] = []
  const topicDays = new Map<number, number[]>()
  let withOthers = 0
  let alone = 0
  dd.stories.forEach((s) => {
    const p = profileOf.get(s.id)!
    if (!p.groupsAll.includes(gi)) return
    if (p.groupsAll.length > 1) {
      withOthers++
      if (p.firstGroups.length === 1 && p.firstGroups[0] === gi) alone++
    }
    const days = new Array<number>(last + 1).fill(0)
    let n = 0
    for (let i = 0; i < s.t.length; i += 3) {
      if (!members.has(dd.outlets[s.t[i]!]!.slug)) continue
      n += s.t[i + 2]!
      days[s.t[i + 1]!]! += s.t[i + 2]!
    }
    const story = storyOf.get(s.id)
    if (n) mine.push({ story, n, days })
    if (n && story) {
      const line = topicDays.get(story.issue) ?? new Array<number>(last + 1).fill(0)
      days.forEach((v, i) => { line[i]! += v })
      topicDays.set(story.issue, line)
    }
  })
  return { mine: mine.sort((a, b) => b.n - a.n), topicDays, withOthers, alone }
}

// The topics of the analysed articles of the group against all outlets. The catch-all topic does not count.
export const groupTopics = (g: GroupsData, group: GroupRecord) => {
  const keep = g.issues.map((issue, i) => ({ issue, i })).filter(({ issue }) => !issue.catchAll)
  const nGroup = sum(keep.map(({ i }) => group.topics[i]!))
  const nAll = sum(keep.map(({ i }) => g.topicsAll[i]!))
  const rows = keep.filter(({ i }) => group.topics[i]).map(({ issue, i }) => ({ key: i, issue, label: '', value: group.topics[i]! / nGroup, usual: g.topicsAll[i]! / nAll }))
    .sort((a, b) => b.value - a.value).slice(0, GROUP_TOPICS)
  return { rows, nGroup }
}

// How the group writes: the news share, the clickbait share and the stance of all its outlets, against all outlets.
export const groupWrites = (g: GroupsData, group: GroupRecord) => {
  const files = [...g.groups.flatMap(x => x.outlets), ...(g.ungrouped ?? [])]
  const allOf = (key: 'news' | 'analysed' | 'cbYes' | 'cbKnown') => sum(files.map(o => o[key]))
  const mineOf = (key: 'news' | 'analysed' | 'cbYes' | 'cbKnown') => sum(group.outlets.map(o => o[key]))
  const analysed = mineOf('analysed')
  const stanceMine = [0, 1, 2].map(i => sum(group.outlets.map(o => o.stance[i]!)))
  const stanceAll = [0, 1, 2].map(i => sum(files.map(o => o.stance[i]!)))
  return {
    analysed, scored: mineOf('cbKnown'), baited: mineOf('cbYes'),
    news: analysed ? { value: mineOf('news') / analysed, usual: allOf('news') / allOf('analysed') } : null,
    click: mineOf('cbKnown') ? { value: mineOf('cbYes') / mineOf('cbKnown'), usual: allOf('cbYes') / allOf('cbKnown') } : null,
    stanceMine, stanceAll, stanceN: sum(stanceMine)
  }
}
