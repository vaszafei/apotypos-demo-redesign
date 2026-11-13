import { articleOfNode, articlesPerNode, nodeCount } from '../plegma-articles'
import { toScreen } from '../plegma-camera'
import { PLEGMA_WEB_MIN } from '../plegma-world'
import type { PlegmaStory } from '../plegma-world'
import type { StageState } from './stage-state'
import type { Ref } from 'vue'
import type { StageCore, StageDeps } from './stage-core'
import type { StageArticles } from './stage-articles'
import type { StageTheme } from './stage-theme'
import type { StageHero } from './stage-hero'

// The pointer: the stage is behind the page, so it is read on the window; what it finds on the map (a story, an article, an arc of the ring) and what a click does.
export interface PointerDeps extends StageDeps {
  pointerFine: Ref<boolean>
  phone: Ref<boolean>
  canvas: Ref<HTMLCanvasElement | undefined>
  tooltip: ReturnType<typeof useTooltipStore>
  t: (key: string, named?: Record<string, unknown>) => string
  kick: () => void
}

export const createStagePointer = (st: StageState, deps: PointerDeps, core: StageCore, articles: StageArticles, theme: StageTheme, hero: StageHero) => {
  const { plegma, reduced, locale, pointerFine, phone, canvas, tooltip, t, kick } = deps
  const { visible, placed, drift, focusStory, focusOutlet, webFocus, behind, name } = core
  const { articleAt, ringAt, sectorOf, byOutlet } = articles
  const { themeNodeAt, themeWebOf, themeRingAt } = theme
  const { explore } = hero
  // The stage is behind the page, so the pointer is read on the window; a card, a link or a control under it is not the map.
  const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .plegma-card, .plegma-day, .plegma-title, .plegma-dock, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip'
  const pickAt = (x: number, y: number, reach: number) => {
    if (!st.world) return null
    let best: PlegmaStory | null = null
    let bestDistance = reach
    for (const s of visible(reach / st.cam.z + 20)) {
      if (s.n < PLEGMA_WEB_MIN && s !== focusStory()) continue
      const p = { ...toScreen(st.cam, st.width, st.height, placed(s)) }
      // On Home the stories drift (draw), so the pointer finds them where they are drawn.
      if (!plegma.focus && !reduced.value) { const o = drift(s, performance.now() / 1000); p.x += o.x; p.y += o.y }
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < bestDistance) { bestDistance = d; best = s }
    }
    return best
  }
  const local = (e: PointerEvent) => {
    const box = canvas.value!.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }
  const leave = () => {
    st.lantern.on = false
    if (!st.hover && st.hoverArticle < 0 && st.hoverNode < 0 && !st.hoverRing) return
    st.hover = null
    st.hoverArticle = -1
    st.hoverNode = -1
    st.hoverRing = ''
    if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
    tooltip.hide()
    if (reduced.value) kick()
  }
  const onMove = (e: PointerEvent) => {
    if (!plegma.active || !st.world || e.pointerType === 'touch' || !pointerFine.value || phone.value) return
    if ((e.target as Element | null)?.closest?.(CAPTURES)) return leave()
    const p = local(e)
    // In the hero the pointer is a lantern: a small patch of the ground under it clears.
    const inHero = plegma.focus === null && !behind()
    st.lantern.on = inHero && !reduced.value
    if (st.lantern.on) { st.lantern.x = p.x; st.lantern.y = p.y }
    // On the picked story the pointer finds an article first: its outlet and its day.
    const story = focusStory()
    const list = plegma.articles
    if (story && list && list.length === story.n && plegma.landed) {
      const i = articleAt(story, p.x, p.y)
      if (i >= 0) {
        const article = list[articleOfNode(i, list.length)]!
        const per = articlesPerNode(story.n)
        if (st.hoverArticle !== i && reduced.value) kick()
        st.hover = null
        st.hoverArticle = i
        if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
        // A node that stands for an article of the sample of headlines (or for several, one of which is in it) has the title of that article, with its outlet and day under it.
        const nodes = nodeCount(story.n)
        const from = Math.floor((i * story.n) / nodes)
        const to = Math.max(from + 1, Math.floor(((i + 1) * story.n) / nodes))
        let titled: typeof article | undefined
        for (let k = from; k < to && !titled; k++) if (list[k]!.title) titled = list[k]
        const group = article.group ?? t('story.nogroup')
        const date = fmtDate(st.world.dates[(titled ?? article).day]!)
        tooltip.show(titled
          ? {
              title: titled.title!,
              rows: [
                { label: titled.outlet, value: date, color: `var(--cat-${titled.slot})` },
                { label: titled.group ?? t('story.nogroup'), value: '' },
                ...(per > 1 ? [{ label: t('story.nodes.per'), value: fmtInt(per) }] : [])
              ],
              field: true
            }
          : {
              title: article.outlet,
              rows: [
                { label: group, value: date, color: `var(--cat-${article.slot})` },
                ...(per > 1 ? [{ label: t('story.nodes.per'), value: fmtInt(per) }] : [])
              ],
              field: true
            }, e)
        return
      }
      if (st.hoverArticle >= 0) { st.hoverArticle = -1; if (reduced.value) kick() }
      const arc = ringAt(story, p.x, p.y)
      if (arc) {
        const key = `${arc.kind}${arc.k}`
        if (st.hoverRing !== key && reduced.value) kick()
        const changed = st.hoverRing !== key
        st.hover = null
        st.hoverRing = key
        if (arc.kind === 'g') {
          const mine = list.filter(x => sectorOf(x) === arc.k)
          const first = mine[0]
          if (changed && first) { plegma.setHighlight(byOutlet() ? { group: first.group, outlet: first.outlet } : { group: first.group }); st.ringLit = true }
          tooltip.show({
            title: byOutlet() ? first?.outlet ?? '' : first?.group ?? t('story.nogroup'),
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(mine.length)} · ${fmtPct(mine.length / list.length)}`, color: `var(--cat-${first?.slot ?? 0})` }],
            field: true
          }, e)
        } else {
          const counts = plegma.stance!
          const total = counts.reduce((x, y) => x + y, 0)
          tooltip.show({
            title: t(`stance.${['critical', 'neutral', 'supportive'][arc.k]}`),
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(counts[arc.k]!)} · ${fmtPct(counts[arc.k]! / total)}`, color: `var(--stance-${['critical', 'neutral', 'supportive'][arc.k]})` }],
            field: true
          }, e)
        }
        return
      }
      if (st.hoverRing) { st.hoverRing = ''; tooltip.hide(); if (reduced.value) kick() }
      if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
    }
    // On the web of a theme the pointer finds a story or an outlet of a story; on the web of an outlet, a story or a day of it.
    if (webFocus()) {
      const i = themeNodeAt(p.x, p.y)
      const web = themeWebOf()
      if (i > 0 && web) {
        if (st.hoverNode !== i && reduced.value) kick()
        st.hover = null
        st.hoverNode = i
        const s = web.stories[web.story[i]!]!
        const o = web.outlet[i]! >= 0 ? s.outlets[web.outlet[i]!]! : null
        const mineOutlet = focusOutlet() !== null
        tooltip.show(mineOutlet
          ? o
            ? { title: s.name, rows: [{ label: o.name, value: fmtInt(o.n), color: `var(--cat-${s.slot ?? 0})` }], field: true }
            : { title: s.name, rows: [{ label: t('home.field.topic'), value: s.theme ?? '', color: `var(--cat-${s.slot ?? 0})` }, { label: t('home.field.articles'), value: fmtInt(s.n) }], field: true }
          : o
            ? { title: o.name, rows: [{ label: o.group ?? t('story.nogroup'), value: '', color: `var(--cat-${o.slot})` }, { label: s.name, value: fmtInt(o.n) }], field: true }
            : { title: s.name, rows: [{ label: t('home.field.articles'), value: fmtInt(s.n) }, { label: t('entity.fact.outlets'), value: fmtInt(s.media) }], field: true }, e)
        return
      }
      if (st.hoverNode >= 0) { st.hoverNode = -1; if (reduced.value) kick() }
      const arc = themeRingAt(p.x, p.y)
      if (arc) {
        const key = `${arc.kind}${arc.k}`
        if (st.hoverRing !== key && reduced.value) kick()
        st.hover = null
        st.hoverRing = key
        if (arc.kind === 'g') {
          const groups = plegma.themeGroups!
          const mine = groups[arc.k]!
          tooltip.show({
            title: mine.name,
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(mine.n)} · ${fmtPct(mine.n / groups.reduce((x, y) => x + y.n, 0))}`, color: `var(--cat-${mine.slot})` }],
            field: true
          }, e)
        } else {
          const counts = plegma.stance!
          const total = counts.reduce((x, y) => x + y, 0)
          tooltip.show({
            title: t(`stance.${['critical', 'neutral', 'supportive'][arc.k]}`),
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(counts[arc.k]!)} · ${fmtPct(counts[arc.k]! / total)}`, color: `var(--stance-${['critical', 'neutral', 'supportive'][arc.k]})` }],
            field: true
          }, e)
        }
        return
      }
      if (st.hoverRing) { st.hoverRing = ''; tooltip.hide(); if (reduced.value) kick() }
    }
    const best = pickAt(p.x, p.y, 14)
    if (!best) return leave()
    // Ground that is still black has nothing to tell yet.
    if (inHero && !st.heroCleared && (st.heroRev.get(best.id) ?? 0) < 0.9) { st.hover = null; tooltip.hide(); return }
    if (st.hover !== best && reduced.value) kick()
    st.hover = best
    const issueName = (st.world.issues[best.issue]!)
    tooltip.show({
      title: name(best),
      rows: [
        { label: t('home.field.topic'), value: (locale.value === 'en' && issueName.en) || issueName.el, color: best.slot > 0 ? `var(--cat-${best.slot})` : undefined },
        { label: t('home.field.articles'), value: fmtInt(best.n) }
      ],
      field: true
    }, e)
  }
  const onClick = (e: MouseEvent) => {
    if (!plegma.active || !st.world || e.button !== 0 || e.defaultPrevented) return
    if ((e.target as Element | null)?.closest?.(CAPTURES)) return
    const box = canvas.value!.getBoundingClientRect()
    const p = { x: e.clientX - box.left, y: e.clientY - box.top }
    // In the hero a click explores: it opens no story (any pointer, a phone too).
    if (plegma.focus === null && !behind()) { explore(p.x, p.y); return }
    if (!pointerFine.value || phone.value || st.hoverArticle >= 0 || st.hoverRing) return
    // A story of the web of a theme opens that story.
    const web = webFocus() ? themeWebOf() : null
    if (web && st.hoverNode > 0 && st.hoverNode < web.n) {
      const id = web.stories[web.story[st.hoverNode]!]!.id
      tooltip.hide()
      st.hoverNode = -1
      navigateTo(storyHref(id))
      return
    }
    const best = pickAt(p.x, p.y, 18)
    if (best) { tooltip.hide(); st.hover = null; navigateTo(storyHref(best.id)) }
  }
  return { onMove, onClick, leave }
}
