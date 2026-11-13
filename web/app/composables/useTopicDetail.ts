import type { StoriesData } from '~/types/stories'
import type { StoryDetailData } from '~/types/story-detail'
import type { TopicsData } from '~/types/topics'
import type { GroupsData } from '~/utils/groups'

// The numbers of the cards of one topic (topic-v2.html): the stance, the outlets and groups that write it more or less than usual, and how it is written. Shared by the topic page
// (components/plegma/PlegmaThemeView.vue) and the cards of the topic picked on Μέσα › Θέματα (components/TopicCards.vue). Drawn in the browser: the data of the stories is some MB.
// null model when the index is not one of the topics. The numbers are over all the days of the data, as the topic page has them.
export const useTopicDetail = (index: Ref<number | null>) => {
  const { t } = useI18n()
  const home = useFixtureLazy<TopicsData>('home', { required: ['dates', 'issues', 'issueDaily'], isEmpty: b => b.issueDaily.length === 0 })
  const list = useFixtureLazy<StoriesData>('stories', { required: ['issues', 'stories'], isEmpty: b => b.stories.length === 0 })
  const detail = useFixtureLazy<StoryDetailData>('storyDetail', { required: ['outlets', 'stories', 'base'], isEmpty: b => b.stories.length === 0 })
  const groupsData = useFixtureLazy<GroupsData>('groups', { required: ['groups', 'topicsAll'], isEmpty: b => b.groups.length === 0 })
  const fixtures = [home, list, detail, groupsData]
  const loading = computed(() => fixtures.some(f => f.status.value === 'loading'))
  const problem = computed(() => fixtures.map(f => f.status.value).find(s => s !== 'ready'))
  const retry = () => fixtures.forEach(f => f.refresh())

  const colorOfGroup = computed(() => groupColors(groupsData.data.value?.groups ?? []))
  const part = (arr: number[], i: number, s = totalOf(arr)) => (s ? arr[i]! / s : 0)

  const model = computed(() => {
    const hd = home.data.value
    const d = list.data.value
    const dd = detail.data.value
    const gd = groupsData.data.value
    const i = index.value
    if (!hd || !d || !dd || !gd || problem.value || i === null) return null
    if (!Number.isInteger(i) || i < 0 || i >= hd.issues.length) return null
    const issue = hd.issues[i]!
    const stats = topicStats(hd, i)
    const mine = storiesOfTopic(d, i)
    const articles = topicArticles(d, dd, i)
    const outlets = outletDiffs(dd, articles)
    const { det } = articles

    const usualTopic = totalOf(gd.topicsAll) ? gd.topicsAll[i]! / totalOf(gd.topicsAll) : 0
    const groups = gd.groups.map((g) => {
      const total = totalOf(g.topics)
      return { key: g.name, label: g.name, value: total ? g.topics[i]! / total : 0, usual: usualTopic }
    }).sort((a, b) => (b.value - b.usual) - (a.value - a.usual))

    // How the topic is written: the frame, the section, the stance and the clickbait, each against all articles. The rows share one scale.
    const framed = (key: 'f' | 'c', labels: string[], prefix: string, count: number) =>
      det[key].map((_, k) => ({ key: `${key}${k}`, label: t(`story.${prefix}.${labels[k]}`), value: part(det[key], k), usual: part(dd.base[key], k) }))
        .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, count)
    const stanceN = totalOf(det.s.slice(1))
    const stanceRows = (['critical', 'neutral', 'supportive'] as const).map((code, k) => ({ key: code, label: t(`stance.${code}`), value: part(det.s.slice(1), k, stanceN), usual: part(dd.base.s.slice(1), k, totalOf(dd.base.s.slice(1))) }))
    const [scored, baited] = det.k as [number, number]
    const click = scored ? [{ key: 'clickbait', label: t('story.how.clickbait'), value: baited / scored, usual: dd.base.k[1]! / dd.base.k[0]! }] : []
    const frames = framed('f', dd.frames, 'frame', 8)
    const sections = framed('c', dd.sections, 'section', 6)

    return {
      hd, d, dd, issue, ...stats, mine, ...articles, outlets, groups, stanceN, scored, baited, frames, sections, click,
      outletScale: diffScale([...outlets.more, ...outlets.less, ...groups]),
      howScale: diffScale([...frames, ...sections, ...(stanceN ? stanceRows : []), ...click])
    }
  })

  return { home, list, detail, groupsData, loading, problem, retry, colorOfGroup, model }
}

// An outlet needs this many articles on the topic in the period before to have a trend, and the most rows each side shows.
export const TOPIC_TREND_MIN = 8
export const TOPIC_TREND_ROWS = 5

// The outlets that write a topic more or less than in the period before (the days just before it, as many as the period has): the articles of the outlet in the stories of the topic, now
// against before. null when the data has no period before. `from` and `to` are days of the stories.
export const topicOutletTrends = (dd: StoryDetailData, list: StoriesData, index: number, from: string, to: string) => {
  const i0 = dd.dates.indexOf(from)
  const i1 = dd.dates.indexOf(to)
  if (i0 < 0 || i1 < i0) return null
  const len = i1 - i0 + 1
  const p0 = i0 - len
  if (p0 < 0) return null
  const inTopic = new Set(list.stories.filter(s => s.issue === index && !s.generic).map(s => s.id))
  const now = new Map<number, number>()
  const before = new Map<number, number>()
  for (const s of dd.stories) {
    if (!inTopic.has(s.id)) continue
    for (let j = 0; j < s.t.length; j += 3) {
      const day = s.t[j + 1]!
      const side = day >= i0 && day <= i1 ? now : day >= p0 && day < i0 ? before : null
      if (side) side.set(s.t[j]!, (side.get(s.t[j]!) ?? 0) + s.t[j + 2]!)
    }
  }
  const rows = [...before].filter(([, n]) => n >= TOPIC_TREND_MIN).map(([k, n]) => {
    const o = dd.outlets[k]!
    return { slug: o.slug, name: o.name, before: n, now: now.get(k) ?? 0, change: ((now.get(k) ?? 0) - n) / n }
  })
  const up = rows.filter(r => r.change > 0).sort((a, b) => b.change - a.change || b.now - a.now).slice(0, TOPIC_TREND_ROWS)
  const down = rows.filter(r => r.change < 0).sort((a, b) => a.change - b.change || b.before - a.before).slice(0, TOPIC_TREND_ROWS)
  const totalNow = [...now.values()].reduce((s, v) => s + v, 0)
  const totalBefore = [...before.values()].reduce((s, v) => s + v, 0)
  return { up, down, widest: Math.max(...up.concat(down).map(r => Math.abs(r.change)), 0), totalNow, totalBefore, p0 }
}
