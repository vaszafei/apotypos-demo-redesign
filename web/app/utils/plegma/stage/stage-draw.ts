import { regionBox, toScreen, toWorld } from '../plegma-camera'
import type { PlegmaPoint } from '../plegma-camera'
import { smooth } from '../plegma-hero'
import { PLEGMA_FAR_MIN, PLEGMA_FOCUS_DOTS, arcsOf, drawLevel, webOf } from '../plegma-world'
import type { PlegmaStory } from '../plegma-world'
import { TAU, clamp, orbit, withAlpha } from './stage-draw-util'
import type { StageState } from './stage-state'
import { LEAVE_RING_MS } from '../plegma-leave'
import type { Ref } from 'vue'
import type { StageCore, StageDeps } from './stage-core'
import type { StageArticles } from './stage-articles'
import type { StageTheme } from './stage-theme'
import type { StageHero } from './stage-hero'

// One frame of the stage: the dots of the world, the webs of the stories, the dashed arcs of the themes, the lines from the story in view, and the web in view (the hero, a theme, a story's articles).
export interface DrawDeps extends StageDeps { canvas: Ref<HTMLCanvasElement | undefined>, canvasFocus: Ref<HTMLCanvasElement | undefined> }

export const createStageDraw = (st: StageState, deps: DrawDeps, core: StageCore, articles: StageArticles, theme: StageTheme, hero: StageHero) => {
  const { plegma, reduced, canvas, canvasFocus } = deps
  const { placed, drift, colourOf, focusStory, focusIssue, focusOutlet, behind, coreOf, spokeSet, targetCamera, CLEAR_PAD, visible, arcOf, ease, BACK_Z, backFrame, backPoint } = core
  const { drawArticles, clearRadius, linkFrom, isBranch } = articles
  const { drawTheme } = theme
  const { drawHero } = hero
  const EMPTY = new Set<PlegmaStory>()
  // The most lines from a picked story to other stories.
  const SPOKES_MAX = 6
  // A web that comes into view (a story, a theme, an outlet) is not there at once: it grows. Its nodes leave the center and go to their places, the nearer ones first, then its lines
  // and its ring come in. It starts when the camera is half way through its flight (the web would be drawn on a moving map before), and only when the view has measured its
  // free area, so it never grows unseen. With reduced motion it is all at once.
  const INTRO_MS = 1100
  const INTRO_AT = 0.3
  // On a flight from a story to a story the web of the one it comes to starts as the camera nears it; on a travel along a line, as it arrives.
  const INTRO_AT_ARC = 0.55
  const INTRO_AT_TRAVEL = 0.8
  let introKey = ''
  let introAt = -1
  // The lines from a story to other stories come in with the card that lists those stories (Σχετικές ιστορίες, PlegmaStoryView.vue: order 3, so 3 × 110 ms after the camera lands),
  // as that card shows and settles (assets/css/plegma.css, plegma-cut-a: from 14% to 84% of its 1100 ms).
  const LINKS_AFTER = 3 * 110
  const CARD_MS = 1100
  let landedAt = -1
  let lineMix = 0
  let lineLast: number | null = null
  let lastNow = 0
  // Leaving Home for a view, the last frame of the hero is not cut: a copy of the two canvases stays where it was, as blurred as it was, and fades out while the camera flies.
  let wasHome = false
  const HERO_SNAP_MS = 800
  const keepHeroFrame = () => {
    const stage = canvas.value?.parentElement
    if (!stage || !canvas.value || !canvasFocus.value || reduced.value) return
    const copies = [canvas.value, canvasFocus.value].map((source, i) => {
      const copy = document.createElement('canvas')
      copy.width = source.width
      copy.height = source.height
      copy.getContext('2d')?.drawImage(source, 0, 0)
      copy.className = `plegma-canvas plegma-hero-snap${i === 0 ? ' is-fog' : ''}`
      stage.append(copy)
      return copy
    })
    requestAnimationFrame(() => requestAnimationFrame(() => copies.forEach(copy => copy.classList.add('is-out'))))
    window.setTimeout(() => copies.forEach(copy => copy.remove()), HERO_SNAP_MS + 100)
  }
  // Picking a story on a theme (its card or its node), the dot of the story is the story: it stays, live, and goes to the center of the map region, where the web of the story grows out of it.
  // The rest of the theme web is the last frame as a picture (with a hole where the dot was) that fades out where it is, with no zoom. `st.wasTheme` is the theme in view in the last frame;
  // `st.diveSpot` is its story dots' places and radii. The web of the story waits until the dot is there (DIVE_HOLD).
  const MOVE_MS = 1400
  const FADE_MS = 700
  const DIVE_HOLD = 0.92
  // After it has arrived the dot dissolves while the center of the story's web grows in its place.
  const MELT_MS = 500
  const diveInto = (at: { x: number, y: number, r: number }) => {
    const stage = canvas.value?.parentElement
    if (!stage || !canvas.value || !canvasFocus.value) return
    ;[canvas.value, canvasFocus.value].forEach((source, i) => {
      const copy = document.createElement('canvas')
      copy.width = source.width
      copy.height = source.height
      const g = copy.getContext('2d')
      g?.drawImage(source, 0, 0)
      if (g && i === 1) {
        g.globalCompositeOperation = 'destination-out'
        g.beginPath()
        g.arc(at.x * st.dpr, at.y * st.dpr, (at.r + 4) * st.dpr, 0, TAU)
        g.fill()
      }
      copy.className = `plegma-canvas plegma-dive-snap${i === 0 ? ' is-back' : ''}`
      stage.append(copy)
      copy.animate([{ opacity: i === 0 ? 0.7 : 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }).finished.then(() => copy.remove(), () => copy.remove())
    })
  }
  // The dot on its way (drawn over the web of the story, which is not there yet): it stays what it was on the theme, a ring of the theme's gray, and only shrinks to the size of the center of the story;
  // once it is there it dissolves while the center of the story (in the color of its theme) grows in its place.
  const drawDive = (g: CanvasRenderingContext2D, now: number, story: PlegmaStory | null) => {
    const d = st.dive!
    const k = reduced.value ? 1 : clamp((now - d.t0) / MOVE_MS, 0, 1)
    const e = k * k * k * (k * (k * 6 - 15) + 10)
    const melt = clamp((now - d.t0 - MOVE_MS) / MELT_MS, 0, 1)
    // The center of a story's web is where the story is; a dot that came from the web of a day goes to the middle of the free area, which is where the page puts its web.
    const box = plegma.region && !story ? regionBox(st.width, st.height, plegma.region) : null
    // On Κλαδιά the center is the start node, at the left of the region: the dot becomes it.
    const to = story ? articles.centerPoint(story) ?? toScreen(st.cam, st.width, st.height, placed(story)) : { x: box?.cx ?? st.width / 2, y: box?.cy ?? st.height / 2 }
    const x = d.x + (to.x - d.x) * e
    const y = d.y + (to.y - d.y) * e
    const r = d.r + ((story ? articles.centerRadius() : 9) - d.r) * e
    g.globalAlpha = 1 - melt
    g.fillStyle = st.paper
    g.beginPath()
    g.arc(x, y, r + 1.6, 0, TAU)
    g.fill()
    if (d.fill) {
      g.fillStyle = d.fill
      g.beginPath()
      g.arc(x, y, r, 0, TAU)
      g.fill()
    } else {
      g.strokeStyle = st.mute
      g.lineWidth = 2
      g.beginPath()
      g.arc(x, y, r, 0, TAU)
      g.stroke()
    }
    g.globalAlpha = 1
  }
  // The web the camera leaves stays where it is in the world: the picture of its last frame is drawn with the camera of the flight, so it shrinks as the camera pulls back and it fades while the camera is on its way.
  const drawGhost = (g: CanvasRenderingContext2D, t: number) => {
    const o = st.ghost!
    const alpha = 1 - smooth(0.3, 0.75, t)
    if (alpha <= 0.01) return
    const k = st.cam.z / o.cam.z
    g.save()
    g.setTransform(st.dpr * k, 0, 0, st.dpr * k, st.dpr * (st.width / 2 * (1 - k) + (o.cam.x - st.cam.x) * st.cam.z), st.dpr * (st.height / 2 * (1 - k) + (o.cam.y - st.cam.y) * st.cam.z))
    g.globalAlpha = alpha
    g.drawImage(o.img, 0, 0, st.width, st.height)
    g.restore()
  }
  const draw = (now: number) => {
    if (!st.ctx || !st.ctxFocus || !st.world) return
    const c = st.ctx
    const f = st.ctxFocus
    const homeNow = !focusStory() && focusIssue() === null && focusOutlet() === null && !behind()
    if (wasHome && !homeNow && plegma.active) keepHeroFrame()
    wasHome = homeNow
    const picked = focusStory()
    if (st.wasTheme && picked && plegma.active) {
      const at = st.diveSpot.get(picked.id)
      const to = at && !reduced.value && plegma.region ? targetCamera() : null
      if (at && to) {
        // The dot is where it was and the camera is at the story at once; the web of the story waits for the dot, and the cards for the dot to be nearly there.
        diveInto(at)
        st.dive = { ...at, t0: now, key: `s${picked.id}`, fill: null }
        Object.assign(st.cam, to)
        st.flight = null
        window.setTimeout(() => plegma.setLanded(true), MOVE_MS * 0.85)
      }
    }
    // The dot of a story or a theme picked on the web of a day (Home, Ιστορίες): the screen handed its place and the page it goes to (plegma-dive.ts); it is the same dive as the one from a theme, without the picture.
    const from = plegma.diveFrom
    if (from && plegma.active && plegma.region && !st.dive) {
      const here = picked ? `s${picked.id}` : focusIssue() !== null ? `t${focusIssue()}` : ''
      if (here && here === from.key) {
        st.dive = { x: from.x, y: from.y, r: from.r, t0: now, key: here, fill: from.fill }
        plegma.setDiveFrom(null)
        window.setTimeout(() => plegma.setLanded(true), MOVE_MS * 0.85)
      }
    }
    st.wasTheme = false
    if (plegma.leaving) {
      if (st.leaveAt < 0) st.leaveAt = now
      st.ringOut = reduced.value ? 1 : clamp((now - st.leaveAt) / LEAVE_RING_MS, 0, 1)
    } else { st.leaveAt = -1; st.ringOut = 0 }
    for (const g of [c, f]) { g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.width, st.height) }
    const z = st.cam.z
    const sec = reduced.value ? 0 : now / 1000
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000))
    lastNow = now
    if (plegma.highlight) st.hlLast = plegma.highlight
    st.hlMix = ease(st.hlMix, plegma.highlight ? 1 : 0, dt)
    if (plegma.outletPick.size) st.pickLast = plegma.outletPick
    st.pickMix = ease(st.pickMix, plegma.outletPick.size ? 1 : 0, dt)
    st.ringMix = reduced.value ? (plegma.ring === 'stance' ? 1 : 0) : st.ringMix + ((plegma.ring === 'stance' ? 1 : 0) - st.ringMix) * (1 - Math.exp(-dt * 4))
    for (const [key, v] of st.ringHot) {
      const next = ease(v, key === st.hoverRing ? 1 : 0, dt)
      if (next < 0.005 && key !== st.hoverRing) st.ringHot.delete(key)
      else st.ringHot.set(key, next)
    }
    if (st.hoverRing && !st.ringHot.has(st.hoverRing)) st.ringHot.set(st.hoverRing, 0)
    if (plegma.hoverStory !== null) lineLast = plegma.hoverStory
    lineMix = ease(lineMix, plegma.hoverStory !== null ? 1 : 0, dt)
    const story = focusStory()
    const other = plegma.compare !== null ? st.world.byId.get(plegma.compare) ?? null : null
    const issue = focusIssue()
    const outletOn = focusOutlet() !== null
    const onHome = !story && issue === null && !outletOn && !behind()
    if (onHome) { st.push = null; introKey = ''; introAt = -1; drawHero(now, sec, dt); return }
    // The intro of the web in view: it waits for the camera and for the view's free area, then grows (see INTRO_MS).
    const key = story ? `s${story.id}` : outletOn ? `o${focusOutlet()}` : issue !== null ? `t${issue}` : ''
    if (key !== introKey) { introKey = key; introAt = -1; landedAt = -1 }
    if (!plegma.landed) landedAt = -1
    else if (landedAt < 0) landedAt = now
    const linkIn = reduced.value ? 1 : landedAt < 0 ? 0 : smooth(0.14, 0.84, (now - landedAt - LINKS_AFTER) / CARD_MS)
    // A story's web waits for its articles (Κλαδιά needs their times), so it is drawn once.
    const articlesIn = !story || plegma.articles?.length === story.n
    if (introAt < 0 && key && plegma.region && articlesIn && (!st.flight || (now - st.flight.t0) / Math.max(st.flight.dur, 1) >= (st.flight.level ? INTRO_AT_TRAVEL : st.ghost ? INTRO_AT_ARC : INTRO_AT)) && (!st.dive || now - st.dive.t0 >= MOVE_MS * DIVE_HOLD)) introAt = now
    st.introP = !key || reduced.value ? 1 : introAt < 0 ? 0 : clamp((now - introAt) / INTRO_MS, 0, 1)
    st.nodeIn = smooth(0, 0.18, st.introP)
    st.lineIn = smooth(0.45, 0.95, st.introP)
    st.ringIn = smooth(0.6, 1, st.introP)
    // The theme that is lit: the one of the story or the theme in focus, or the one under the pointer.
    const lit = st.hover ? st.hover.issue : story ? story.issue : issue
    const litCoded = lit !== null && !st.world.issues[lit]!.catchAll
    const core = issue !== null ? coreOf(issue) : story?.coded ? spokeSet(story.issue) : EMPTY
    const homeSet = new Set(st.webs)
    const dim = onHome ? 0.38 : issue !== null || outletOn ? 0.13 : 0.2
    st.push = story ? { s: story, r: clearRadius(story) + CLEAR_PAD } : null
    const bz = onHome ? z : BACK_Z
    // The background is seen from the web: the world point at the middle of the map region stays there, and the world around it is drawn at the far zoom.
    const frame = backFrame()
    const dotBuckets: ({ colour: string, alpha: number, path: Path2D } | undefined)[] = []
    const drawn: { s: PlegmaStory, level: 1 | 2, alpha: number, focus: boolean, crisp: boolean }[] = []

    for (const s of visible(80, Math.min(z, bz))) {
      const isFocus = s === story || s === other
      const strong = isFocus || homeSet.has(s) || core.has(s) || s === st.hover
      // In a theme view the web is the theme: the map behind it is all background.
      const sameTheme = issue === null && !outletOn && litCoded && s.issue === lit && s.coded
      const alpha = strong ? 1 : onHome ? dim : sameTheme ? 0.7 : 0.55
      // In a view the story, its pair, the stories of the theme and the one under the pointer are crisp; the rest is a blurred background of dots with no lines.
      const crisp = !onHome && (isFocus || core.has(s) || s === st.hover)
      // Not in view, a story is the background: a dot of the world seen from far away, across the whole page, with no hole around the web.
      const back = !onHome && !strong
      const zz = back ? bz : z
      const base = back ? 0 : drawLevel(s, z, strong, isFocus)
      // On Home the webs of the week have their lines at the zoom that frames them all, and are drawn no smaller than at zoom 1.1 so that each one reads.
      const level = back ? 0 : onHome ? (base > 0 && homeSet.has(s) ? 2 : base) : issue !== null || outletOn ? 0 : crisp ? base : (Math.min(base, 1) as 0 | 1 | 2)
      // Zoomed far out, the smallest stories are faint specks that only cost drawing time: leave them out until the camera is nearer.
      if (level === 0 && zz < 0.3 && !strong && !sameTheme && s.n < PLEGMA_FAR_MIN) continue
      if (level === 0) {
        const r = isFocus ? 4 : clamp(0.7 + 0.35 * Math.log10(s.n + 1) * (zz < 0.22 ? 1.4 : 1.8) * Math.sqrt(Math.max(zz, 0.5)), 0.8, 5)
        const key = s.slot * 3 + (strong ? 2 : sameTheme ? 1 : 0)
        let bucket = dotBuckets[key]
        if (!bucket) { bucket = { colour: colourOf(s), alpha, path: new Path2D() }; dotBuckets[key] = bucket }
        let px: number
        let py: number
        if (back) {
          const at = backPoint(s, frame, sec)
          px = at.x
          py = at.y
        } else {
          const where = placed(s)
          const bx = (where.x - st.cam.x) * zz
          const by = (where.y - st.cam.y) * zz
          const dd = onHome && sec ? orbit(bx, by, sec) : null
          px = bx + st.width / 2 + (dd ? dd.x : 0)
          py = by + st.height / 2 + (dd ? dd.y : 0)
        }
        bucket.path.moveTo(px + r, py)
        bucket.path.arc(px, py, r, 0, TAU)
      } else drawn.push({ s, level, alpha, focus: isFocus, crisp })
    }
    for (const bucket of dotBuckets) { if (!bucket) continue; c.globalAlpha = bucket.alpha; c.fillStyle = bucket.colour; c.fill(bucket.path) }

    // The webs: each dot goes round on a small circle of its own, so a web breathes; the lines are not straight, each bows to one side.
    const rd = clamp(1.3 * Math.sqrt(z) + 0.9, 1.6, 4.4)
    c.lineWidth = 1
    for (const { s, level, alpha, focus, crisp } of drawn) {
      const c = crisp ? f : st.ctx!
      if (s === story && level > 0) { drawArticles(c, s, level as 1 | 2, sec); continue }
      const w = webOf(st.world, s, focus ? PLEGMA_FOCUS_DOTS : 0)
      const p = toScreen(st.cam, st.width, st.height, placed(s))
      const col = colourOf(s)
      // A web breathes a little in a view, and more on Home, where it also drifts.
      const amp = onHome ? 5 : 2.4
      const dd = onHome && sec ? drift(s, sec) : null
      const ox = p.x + (dd ? dd.x : 0)
      const oy = p.y + (dd ? dd.y : 0)
      const zw = onHome ? Math.max(z, 1.1) : z
      const at = w.offs.map((o, i) => {
        const a = sec * (0.25 + ((i * 7 + s.id) % 11) * 0.05) * (i % 2 ? -1 : 1) + i * 1.9 + s.id
        const k = amp * (0.6 + ((i * 5 + s.id) % 7) * 0.14)
        return [ox + o.x * zw + Math.cos(a) * k, oy + o.y * zw + Math.sin(a) * k] as const
      })
      c.fillStyle = col
      c.strokeStyle = col
      c.lineWidth = 1
      // In a view the lines are thin and nearly straight and each dot has a rim of the page's color, so a web is clean at a small size; Home keeps the look of its hero.
      const bend = onHome ? 0.7 : 0.3
      if (level === 2) {
        c.globalAlpha = alpha * (onHome ? 0.55 : 0.45)
        c.beginPath()
        w.edges.forEach(([i, j], e) => {
          const dx = at[j]![0] - at[i]![0]
          const dy = at[j]![1] - at[i]![1]
          const bow = (((e * 0.618 + s.id * 0.37) % 1) - 0.5) * bend
          c.moveTo(at[i]![0], at[i]![1])
          c.quadraticCurveTo((at[i]![0] + at[j]![0]) / 2 - dy * bow, (at[i]![1] + at[j]![1]) / 2 + dx * bow, at[j]![0], at[j]![1])
        })
        c.stroke()
      }
      const size = onHome ? rd : clamp(1.3 * Math.sqrt(zw) + 0.9, 1.6, 4.4)
      const dr = level === 2 ? size : clamp(size * 0.8, 1.2, 3)
      if (!onHome && level === 2) {
        c.globalAlpha = 1
        c.fillStyle = st.paper
        c.beginPath()
        at.forEach(([x, y], i) => { const r = (i === 0 ? dr * 1.5 : dr) + 1; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU) })
        c.fill()
        c.fillStyle = col
      }
      c.globalAlpha = alpha
      c.beginPath()
      at.forEach(([x, y], i) => { const r = i === 0 ? dr * 1.5 : dr; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU) })
      c.fill()
      if (focus) {
        c.globalAlpha = 0.5
        c.lineWidth = 1.5
        c.beginPath()
        c.arc(p.x, p.y, w.r * z * 1.25 + 6, 0, TAU)
        c.stroke()
        c.lineWidth = 1
      }
    }

    // The dot of the story picked on a theme, on its way to the center of the web; the web takes over from it once it has grown there.
    if (st.dive && ((story ? `s${story.id}` : issue !== null ? `t${issue}` : '') !== st.dive.key || now - st.dive.t0 > MOVE_MS + MELT_MS)) st.dive = null
    if (st.dive) drawDive(f, now, story)
    if (st.ghost && !st.flight) st.ghost = null
    if (st.ghost && st.flight) drawGhost(f, (now - st.flight.t0) / Math.max(st.flight.dur, 1))

    // The dashed arcs of the themes in view: the focus's theme, the theme in focus, the theme under the pointer, and the themes of the Home webs.
    const issues = new Set<number>()
    if (st.hover && !(story && st.hover.issue === story.issue)) issues.add(st.hover.issue)
    if (onHome) for (const s of st.webs) issues.add(s.issue)
    const a = onHome ? c : f
    a.lineWidth = 1.2
    a.setLineDash([2, 5])
    for (const k of issues) {
      const arcs = arcsOf(st.world, k)
      if (!arcs.length) continue
      const slot = st.world.slotOf.get(k)
      a.strokeStyle = slot ? st.cats[slot - 1] ?? st.mute : st.mute
      a.globalAlpha = onHome ? 0.5 : 0.6
      a.beginPath()
      for (const arc of arcs) arcOf(a, arc.a, arc.b, arc.sign, onHome ? sec : 0)
      a.stroke()
    }
    a.setLineDash([])
    if (issue !== null || outletOn) drawTheme(f, sec, dt)
    // The line the camera travels along (from the story it left to the story in view): lit while the camera goes, it fades as the lines of the story in view come in.
    if (st.travel && !st.flight && linkIn >= 1) st.travel = null
    if (st.travel) {
      const o = st.travel
      const k = st.flight ? 1 : 1 - linkIn
      const ps = toScreen(st.cam, st.width, st.height, o.s)
      const pc = toScreen(st.cam, st.width, st.height, o.c)
      const pe = toScreen(st.cam, st.width, st.height, o.e)
      const path = () => { f.beginPath(); f.moveTo(ps.x, ps.y); f.quadraticCurveTo(pc.x, pc.y, pe.x, pe.y) }
      f.save()
      f.globalAlpha = k
      f.strokeStyle = o.colour
      f.shadowColor = o.colour
      f.shadowBlur = 12
      f.lineWidth = 2.6
      path()
      f.stroke()
      f.shadowBlur = 0
      f.strokeStyle = st.ink
      f.globalAlpha = 0.55 * k
      f.lineWidth = 1
      f.setLineDash([2, 12])
      f.lineDashOffset = -sec * 36
      path()
      f.stroke()
      f.restore()
    }
    // A story with a theme of its own is joined, by curved lines, to the largest stories of that theme and to the stories its card lists; they leave from the edge of its web,
    // spread around it by the direction they go in, and fade toward the other story. The story a card of other stories points at has its line lit: solid, glowing, flowing.
    const pointed = lineLast !== null && lineMix > 0.01 ? st.world.byId.get(lineLast) ?? null : null
    // Κλαδιά has no lines to other stories: a row of «Σχετικές ιστορίες» lights the articles about that story (PlegmaRelatedCard.vue).
    if (story && !onHome && (story.coded || pointed) && !isBranch(story)) {
      const { edge, kx, ...here } = linkFrom(story)
      const colour = story.slot > 0 ? colourOf(story) : st.cats[0] ?? st.mute
      const listed: PlegmaStory[] = []
      for (const id of plegma.related) { const b = st.world.byId.get(id); if (b && b !== story) listed.push(b) }
      const rest: PlegmaStory[] = []
      if (story.coded) for (const b of spokeSet(story.issue)) if (b !== story && !listed.includes(b)) rest.push(b)
      // The stories its card lists, then the nearest of the largest of its theme: a few lines read, two dozen are a fan.
      rest.sort((b1, b2) => Math.hypot(b1.x - story.x, b1.y - story.y) - Math.hypot(b2.x - story.x, b2.y - story.y))
      const targets = story.coded ? [...listed, ...rest.slice(0, Math.max(0, SPOKES_MAX - listed.length))] : []
      if (pointed && pointed !== story && !targets.includes(pointed)) targets.push(pointed)
      const lines = targets.map((b) => {
        const q = toScreen(st.cam, st.width, st.height, placed(b))
        return { b, q: { x: q.x, y: q.y }, angle: Math.atan2(q.y - here.y, q.x - here.x), len: Math.hypot(q.x - here.x, q.y - here.y) }
      }).filter(l => l.len >= edge * 1.4).sort((l1, l2) => l1.angle - l2.angle)
      // Two lines that leave the same way are moved apart a little on the ring, so each one has a start of its own.
      const starts = lines.map(l => l.angle)
      for (let pass = 0; pass < 4; pass++) for (let k = 1; k < starts.length; k++) if (starts[k]! - starts[k - 1]! < 0.11) { starts[k - 1]! -= 0.02; starts[k]! += 0.02 }
      const dim = (1 - 0.65 * lineMix) * (st.dive ? smooth(0.9, 1.3, (now - st.dive.t0) / MOVE_MS) : 1) * linkIn
      const still = !st.flight && st.introP >= 1
      if (still) st.links = { from: story.id, to: new Map() }
      const keep = (b: PlegmaStory, sx: number, sy: number, cx: number, cy: number) => {
        if (still) st.links!.to.set(b.id, { s: toWorld(st.cam, st.width, st.height, { x: sx, y: sy }), c: toWorld(st.cam, st.width, st.height, { x: cx, y: cy }) })
      }
      // Each line has one shape, lit or not, so the line under the pointer stays where it is when it lights.
      const shapes = lines.map((l, k) => {
        const sx = here.x + Math.cos(starts[k]!) * edge * kx
        const sy = here.y + Math.sin(starts[k]!) * edge
        const run = Math.hypot(l.q.x - sx, l.q.y - sy) || 1
        const bend = clamp(run * (0.07 + ((l.b.id * 7) % 10) * 0.01), 8, 90) * (l.b.id % 2 ? -1 : 1)
        const cx = (sx + l.q.x) / 2 - (l.q.y - sy) / run * bend
        const cy = (sy + l.q.y) / 2 + (l.q.x - sx) / run * bend
        keep(l.b, sx, sy, cx, cy)
        return { sx, sy, cx, cy }
      })
      let litLine: { l: (typeof lines)[number], sx: number, sy: number, cx: number, cy: number } | null = null
      f.lineWidth = 1
      lines.forEach((l, k) => {
        const { sx, sy, cx, cy } = shapes[k]!
        if (l.b === pointed) { litLine = { l, sx, sy, cx, cy }; return }
        const grad = f.createLinearGradient(sx, sy, l.q.x, l.q.y)
        grad.addColorStop(0, withAlpha(colour, 0.6))
        grad.addColorStop(1, withAlpha(colour, 0.12))
        f.globalAlpha = dim
        f.strokeStyle = grad
        f.beginPath()
        f.moveTo(sx, sy)
        f.quadraticCurveTo(cx, cy, l.q.x, l.q.y)
        f.stroke()
        // Where a line leaves: a small dot outside the ring.
        f.fillStyle = colour
        f.globalAlpha = 0.75 * dim
        f.beginPath()
        f.arc(sx, sy, 1.8, 0, TAU)
        f.fill()
      })
      const lit = litLine as { l: (typeof lines)[number], sx: number, sy: number, cx: number, cy: number } | null
      if (lit) {
        const on = lit.l
        const path = () => { f.beginPath(); f.moveTo(lit.sx, lit.sy); f.quadraticCurveTo(lit.cx, lit.cy, on.q.x, on.q.y) }
        f.save()
        f.globalAlpha = lineMix * linkIn
        f.strokeStyle = colour
        f.shadowColor = colour
        f.shadowBlur = 12 * lineMix
        f.lineWidth = 1 + 1.6 * lineMix
        path()
        f.stroke()
        f.shadowBlur = 0
        f.strokeStyle = st.ink
        f.globalAlpha = 0.55 * lineMix * linkIn
        f.lineWidth = 1
        f.setLineDash([2, 12])
        f.lineDashOffset = -sec * 36
        path()
        f.stroke()
        // The other story is ringed where it is on the screen.
        f.setLineDash([])
        f.strokeStyle = colour
        f.globalAlpha = lineMix * linkIn
        f.lineWidth = 1.5
        f.beginPath()
        f.arc(on.q.x, on.q.y, 9 + 2.5 * Math.sin(sec * 5), 0, TAU)
        f.stroke()
        f.restore()
      }
    }
    c.globalAlpha = 1
    f.globalAlpha = 1
  }
  return { draw }
}
