import { articlesPerNode, nodeCount } from '../plegma-articles'
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

// The stage is behind the page, so the pointer is read on the window; a card, a link or a control under it is not the map.
export const CAPTURES = 'a, button, input, select, textarea, [role="dialog"], .dcard, .plegma-card, .plegma-day, .plegma-title, .plegma-dock, .kpi-tile, .page-head, .section-nav, .trail-bar, .header-bar, .sidebar, .page-footer, .tooltip, .outlet-link-hit'

export const createStagePointer = (st: StageState, deps: PointerDeps, core: StageCore, articles: StageArticles, theme: StageTheme, hero: StageHero) => {
  const { plegma, reduced, locale, pointerFine, phone, canvas, tooltip, t, kick } = deps
  const { visible, placed, drift, focusStory, focusOutlet, webFocus, behind, name, coreOf, spokeSet, BACK_Z, backFrame, backPoint } = core
  const { articleAt, ringAt, sectorOf, byOutlet, nodeArticle, isBranch, lagText } = articles
  const { themeNodeAt, themeWebOf, themeRingAt } = theme
  const { explore } = hero
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
  // The stories that are not a dot of the background: the web in view, its pair, the stories of its theme and the webs of the week are drawn at the camera, not at the far zoom of the background.
  const nearCamera = (s: PlegmaStory) => {
    const story = focusStory()
    if (s === story || s.id === plegma.compare) return true
    if (st.webs.includes(s)) return true
    const issue = core.focusIssue()
    return issue !== null ? coreOf(issue).has(s) : !!story?.coded && spokeSet(story.issue).has(s)
  }
  // Behind a view the map is dots at the far zoom (stage-core.ts backPoint, which the frame draws them at): the pointer finds one where it is drawn, and only to tell what it is.
  const pickBack = (x: number, y: number, reach: number) => {
    const frame = backFrame()
    const sec = reduced.value ? 0 : performance.now() / 1000
    let best: PlegmaStory | null = null
    let bestDistance = reach
    for (const s of visible(80, Math.min(st.cam.z, BACK_Z))) {
      if (s.n < PLEGMA_WEB_MIN || nearCamera(s)) continue
      const at = backPoint(s, frame, sec)
      const d = Math.hypot(at.x - x, at.y - y)
      if (d < bestDistance) { bestDistance = d; best = s }
    }
    return best
  }
  // What the stage has put in the tooltip, so that it is the stage that takes it away (the tooltip is shared with the charts of the cards): every way out of a hover ends in `leave`.
  let tipOn = false
  const show = (tip: Parameters<typeof tooltip.show>[0], e: PointerEvent) => { tipOn = true; tooltip.show(tip, e) }
  const hide = () => { if (!tipOn) return; tipOn = false; tooltip.hide() }
  const local = (e: PointerEvent) => {
    const box = canvas.value!.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }
  // A line from the story in view to another story (as the frame last drew it at rest, st.links): the pointer near it lights it as the row of the card does, and a click opens that story.
  const LINK_REACH = 6
  let hoverLink: number | null = null
  const linkAt = (story: PlegmaStory, x: number, y: number) => {
    if (!st.world || st.links?.from !== story.id) return null
    let best: number | null = null
    let bestDistance = LINK_REACH
    for (const [id, l] of st.links.to) {
      const b = st.world.byId.get(id)
      if (!b) continue
      const a = toScreen(st.cam, st.width, st.height, l.s)
      const c = toScreen(st.cam, st.width, st.height, l.c)
      const e = toScreen(st.cam, st.width, st.height, placed(b))
      let px = a.x
      let py = a.y
      for (let i = 1; i <= 32; i++) {
        const t = i / 32
        const u = 1 - t
        const qx = u * u * a.x + 2 * u * t * c.x + t * t * e.x
        const qy = u * u * a.y + 2 * u * t * c.y + t * t * e.y
        const dx = qx - px
        const dy = qy - py
        const k = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy || 1)))
        const d = Math.hypot(px + dx * k - x, py + dy * k - y)
        if (d < bestDistance) { bestDistance = d; best = id }
        px = qx
        py = qy
      }
    }
    return best
  }
  const dropLink = () => {
    if (hoverLink === null) return
    if (plegma.hoverStory === hoverLink) plegma.setHoverStory(null)
    hoverLink = null
    document.documentElement.style.cursor = ''
  }
  const leave = () => {
    st.lantern.on = false
    dropLink()
    if (!tipOn && !st.hover && st.hoverArticle < 0 && st.hoverNode < 0 && !st.hoverRing) return
    st.hover = null
    st.hoverArticle = -1
    st.hoverNode = -1
    st.hoverRing = ''
    if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
    hide()
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
      if (i >= 0 && isBranch(story)) {
        // On Κλαδιά a node is one article with its time: its outlet, group, day and hour, and how long after the first it came (the start node is the first).
        const article = list[i]!
        if (st.hoverArticle !== i && reduced.value) kick()
        st.hover = null
        st.hoverArticle = i
        if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
        show({
          title: article.title ?? article.outlet,
          rows: [
            ...(article.title ? [{ label: article.outlet, value: '' }] : []),
            { label: article.group ?? t('story.nogroup'), value: `${fmtDate(athensDate(article.time!))}, ${athensClock(article.time!)}`, color: `var(--cat-${article.slot})` },
            i === 0 ? { label: t('story.branches.first'), value: '' } : { label: t('story.branches.after'), value: lagText(article.time! - list[0]!.time!) }
          ],
          field: true
        }, e)
        return
      }
      if (i >= 0) {
        const article = list[nodeArticle(i, list.length)]!
        const per = articlesPerNode(story.n)
        if (st.hoverArticle !== i && reduced.value) kick()
        st.hover = null
        st.hoverArticle = i
        if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
        // The center is the story itself, not an article: its name and its articles.
        if (i === 0) {
          st.hover = null
          if (st.hoverArticle >= 0) { st.hoverArticle = -1; if (reduced.value) kick() }
          show({ title: core.name(story), rows: [{ label: t('entity.fact.articles'), value: fmtInt(story.n) }], field: true }, e)
          return
        }
        // A node that stands for an article of the sample of headlines (or for several, one of which is in it) has the title of that article, with its outlet and day under it.
        const nodes = nodeCount(story.n)
        const from = Math.floor((i * story.n) / nodes)
        const to = Math.max(from + 1, Math.floor(((i + 1) * story.n) / nodes))
        let titled: typeof article | undefined
        for (let k = from; k < to && !titled; k++) if (list[k]!.title) titled = list[k]
        const group = article.group ?? t('story.nogroup')
        const date = fmtDate(st.world.dates[(titled ?? article).day]!)
        show(titled
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
          show({
            title: byOutlet() ? first?.outlet ?? '' : first?.group ?? t('story.nogroup'),
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(mine.length)} · ${fmtPct(mine.length / list.length)}`, color: `var(--cat-${first?.slot ?? 0})` }],
            field: true
          }, e)
        } else {
          const counts = plegma.stance!
          const total = counts.reduce((x, y) => x + y, 0)
          show({
            title: t(`stance.${['critical', 'neutral', 'supportive'][arc.k]}`),
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(counts[arc.k]!)} · ${fmtPct(counts[arc.k]! / total)}`, color: `var(--stance-${['critical', 'neutral', 'supportive'][arc.k]})` }],
            field: true
          }, e)
        }
        return
      }
      if (st.hoverRing) { st.hoverRing = ''; hide(); if (reduced.value) kick() }
      if (st.ringLit) { st.ringLit = false; plegma.setHighlight(null) }
    }
    const linked = story && plegma.landed && !plegma.leaving ? linkAt(story, p.x, p.y) : null
    if (linked !== null) {
      const b = st.world.byId.get(linked)!
      st.hover = null
      if (hoverLink !== linked) { dropLink(); hoverLink = linked; plegma.setHoverStory(linked); document.documentElement.style.cursor = 'pointer' }
      show({ title: name(b), rows: [{ label: t('home.field.articles'), value: fmtInt(b.n) }], field: true }, e)
      return
    }
    dropLink()
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
        show(s.href
          ? { title: s.name, rows: [{ label: t('home.field.articles'), value: fmtInt(s.n) }], field: true }
          : mineOutlet
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
          show({
            title: mine.name,
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(mine.n)} · ${fmtPct(mine.n / groups.reduce((x, y) => x + y.n, 0))}`, color: `var(--cat-${mine.slot})` }],
            field: true
          }, e)
        } else {
          const counts = plegma.stance!
          const total = counts.reduce((x, y) => x + y, 0)
          show({
            title: t(`stance.${['critical', 'neutral', 'supportive'][arc.k]}`),
            rows: [{ label: t('home.field.articles'), value: `${fmtInt(counts[arc.k]!)} · ${fmtPct(counts[arc.k]! / total)}`, color: `var(--stance-${['critical', 'neutral', 'supportive'][arc.k]})` }],
            field: true
          }, e)
        }
        return
      }
      if (st.hoverRing) { st.hoverRing = ''; hide(); if (reduced.value) kick() }
    }
    const best = inHero ? pickAt(p.x, p.y, 14) : pickBack(p.x, p.y, 14)
    if (!best) return leave()
    // Ground that is still black has nothing to tell yet.
    if (inHero && !st.heroCleared && (st.heroRev.get(best.id) ?? 0) < 0.9) { st.hover = null; hide(); return }
    // In the hero the story pointed at is lit; behind a view it is a dot of the background, and the tooltip is all it has.
    if (inHero) { if (st.hover !== best && reduced.value) kick(); st.hover = best } else st.hover = null
    const issueName = (st.world.issues[best.issue]!)
    show({
      title: name(best),
      rows: [
        { label: t('home.field.topic'), value: (locale.value === 'en' && issueName.en) || issueName.el, color: best.slot > 0 ? `var(--cat-${best.slot})` : undefined },
        { label: t('home.field.articles'), value: fmtInt(best.n) }
      ],
      field: true
    }, e)
  }
  const onClick = (e: MouseEvent) => {
    if (!plegma.active || !st.world || e.button !== 0 || e.defaultPrevented || plegma.leaving) return
    if ((e.target as Element | null)?.closest?.(CAPTURES)) return
    const box = canvas.value!.getBoundingClientRect()
    const p = { x: e.clientX - box.left, y: e.clientY - box.top }
    // In the hero a click explores: it opens no story (any pointer, a phone too).
    if (plegma.focus === null && !behind()) { explore(p.x, p.y); return }
    if (!pointerFine.value || phone.value || st.hoverArticle >= 0 || st.hoverRing) return
    // A line from the story in view opens the story it goes to.
    if (hoverLink !== null) {
      // The line stays lit (the route change clears it), so the camera travels along the line that was clicked.
      const id = hoverLink
      hide()
      hoverLink = null
      document.documentElement.style.cursor = ''
      navigateTo(storyHref(id))
      return
    }
    // A story of the web of a theme opens that story; an outlet of the web of a group opens that outlet.
    const web = webFocus() ? themeWebOf() : null
    if (web && st.hoverNode > 0 && st.hoverNode < web.n) {
      const picked = web.stories[web.story[st.hoverNode]!]!
      hide()
      st.hoverNode = -1
      navigateTo(picked.href ?? storyHref(picked.id))
      return
    }
  }
  return { onMove, onClick, leave }
}
