import { useEventListener } from '@vueuse/core'

// Motion (assets/motion.js) on the Vue pages: the page entrance, the first view of the cards (charts grow, bars fill), the fade of what a period
// changes, and the "/" of the current tab. Only what the shell and the ported pages use is here (R8): the count-up of numbers, the thumb of a
// segmented control and the move of sorted rows come with the pages that have them. The durations and easings are the tokens in tokens.css.
// Only transform and opacity move. With reduced motion the entrance and the changes only fade, and the rest is instant.
export default defineNuxtPlugin((nuxtApp) => {
  const root = document.documentElement
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const still = () => reduce.matches
  const token = (name: string) => getComputedStyle(root).getPropertyValue(name).trim()
  const ms = (name: string) => parseFloat(token(name)) || 0

  // A card that plays its first view on its own. A card that holds other cards leaves it to them.
  const UNIT = '.dcard, .kpi-tile'
  // The page head keeps still: its controls are what the visitor just used.
  const HEAD = '.page-head, .page-header, .dash-bar'

  // Until the first content is sorted, the CSS hides the marks of every chart, so no chart paints full and then grows.
  let introDone = false
  // A prerendered page is already on screen at its first intro, so its blocks do not rise in: they would go back to nothing and fade in a second time.
  let onScreen = nuxtApp.payload.serverRendered === true
  let lastInput = -Infinity
  const begin = () => {
    introDone = false
    if (!still()) root.classList.add('m-intro')
  }
  begin()
  for (const type of ['pointerdown', 'keydown', 'change', 'input']) useEventListener(document, type, () => { lastInput = performance.now() }, { capture: true })

  const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < window.innerHeight && r.bottom > 0 }

  // 1. The page entrance: the blocks of the page rise in, one after the other. The page head stays, so a tab switch reads as a change of content.
  const enterPage = (content: Element) => {
    const blocks: Element[] = []
    for (const child of content.children) {
      if (child.matches(HEAD)) continue
      if (child.matches('.dash-grid')) blocks.push(...child.children)
      else blocks.push(child)
    }
    const frames = still() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateY(${token('--motion-distance')})` }, { opacity: 1, transform: 'none' }]
    let k = 0
    for (const el of blocks) {
      if (!visible(el)) continue
      el.animate(frames, { duration: ms('--motion-slow'), delay: Math.min(k++, 8) * ms('--motion-stagger'), easing: token('--ease-out'), fill: 'backwards' })
    }
  }

  // 2. The first view of a card: its charts grow, its bars fill. A card below the fold waits until it scrolls into view.
  const delayOf = (k: number, first: boolean) => (first ? 100 : 0) + Math.min(k, 8) * ms('--motion-stagger')
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((e, k) => { io!.unobserve(e.target); play(e.target as HTMLElement, delayOf(k, false)) })
    }, { rootMargin: '0px 0px -15% 0px' })
    : null

  // The wave of a bar chart and the order of the points: each mark knows its index.
  const indexMarks = (svg: Element) => {
    for (const cls of ['bar-col', 'pt', 'line-dot', 'slice', 'ring-arc']) svg.querySelectorAll<HTMLElement>(`.${cls}`).forEach((el, i) => el.style.setProperty('--m-i', String(i)))
  }

  function play (unit: HTMLElement, delay: number) {
    unit.style.setProperty('--m-delay', `${delay}ms`)
    unit.classList.remove('m-wait')
    unit.classList.add('m-play')
    unit.querySelectorAll('svg.chart').forEach(indexMarks)
    // After the longest entrance (a bar chart with its wave), the card is done: a later redraw, such as a resize, draws at once.
    setTimeout(() => unit.classList.replace('m-play', 'm-done'), delay + 2400)
  }

  const intro = () => {
    if (introDone) return
    introDone = true
    const content = document.getElementById('content')
    // A move from another page slides the page in (view-transition.client.ts), so the blocks do not rise as well.
    if (content && !root.dataset.vt && !onScreen) enterPage(content)
    onScreen = false
    if (!still() && content) {
      let k = 0
      for (const unit of content.querySelectorAll<HTMLElement>(UNIT)) {
        if (unit.querySelector(UNIT)) { unit.classList.add('m-done'); continue }
        if (visible(unit)) play(unit, delayOf(k++, true))
        else if (io) { unit.classList.add('m-wait'); io.observe(unit) }
      }
    }
    root.classList.remove('m-intro')
    glideTab()
  }

  // The page is drawn: the intro runs in the next frame, after the charts draw. A page that never finishes still shows its charts.
  let fallback: ReturnType<typeof setTimeout> | undefined
  nuxtApp.hook('page:start', () => { if (introDone) begin(); clearTimeout(fallback); fallback = setTimeout(intro, 3000) })
  nuxtApp.hook('page:finish', () => { requestAnimationFrame(intro) })
  fallback = setTimeout(intro, 3000)
  // A printed page shows every chart, also the ones below the fold that wait for their view.
  useEventListener(window, 'beforeprint', () => document.querySelectorAll('.m-wait').forEach(unit => unit.classList.replace('m-wait', 'm-done')))

  // 3. A change after a click, a key or a list: the cards that changed fade in from a lighter shade. The cards that did not change stay.
  const fade = (el: Element) => { el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: ms('--motion-slow'), easing: token('--ease-out') }) }
  const fadeChanged = (before: Element[], after: Element[], depth: number) => {
    after.forEach((el, i) => {
      if (el.matches(HEAD)) return
      const old = before[i]
      if (old && old.outerHTML === el.outerHTML) return
      if (old && depth < 2 && el.matches('.dash-grid, .card-col, .kpi-strip') && old.children.length === el.children.length) {
        fadeChanged([...old.children], [...el.children], depth + 1)
        return
      }
      fade(el)
    })
  }
  const isEl = (n: Node): n is Element => n.nodeType === 1
  const app = document.getElementById('__nuxt')
  if (app) {
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) if (isEl(n) && !still()) (n.matches('svg.chart') ? [n] : [...n.querySelectorAll('svg.chart')]).forEach(indexMarks)
        if (!introDone || performance.now() - lastInput > 1500 || !r.addedNodes.length) continue
        // A chart that draws again, the search list and the tooltips change on their own.
        if ((r.target as Element).closest?.('svg, .chart-holder, .fit, .global-search, .info, .segmented')) continue
        fadeChanged([...r.removedNodes].filter(isEl), [...r.addedNodes].filter(isEl), 0)
      }
    }).observe(app, { childList: true, subtree: true })
  }

  // 4. The "/" of the current tab: a click on a tab keeps where the "/" was, and the next page glides it to its own tab.
  // The tabs are a row (a phone) or the sidebar (a wide screen). In the sidebar the "/" marks the sub-tab, so it can move down and sideways.
  const TABS = '.section-tabs, .section-nav'
  const marked = (nav: Element) => nav.querySelector('a[aria-current="page"]') ?? nav.querySelector('a[aria-current]')
  const offsetIn = (nav: HTMLElement, el: Element) => el.getBoundingClientRect().left - nav.getBoundingClientRect().left - nav.clientLeft + nav.scrollLeft
  const topIn = (nav: HTMLElement, el: Element) => el.getBoundingClientRect().top - nav.getBoundingClientRect().top - nav.clientTop + nav.scrollTop
  useEventListener(document, 'click', (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('.section-tabs a[href], .section-nav a[href]')
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.getAttribute('aria-current') === 'page') return
    const nav = link.closest<HTMLElement>(TABS)!
    const current = marked(nav)
    if (!current) return
    try {
      sessionStorage.setItem('m-tab', JSON.stringify({ label: nav.getAttribute('aria-label'), href: link.getAttribute('href'), left: offsetIn(nav, current), top: topIn(nav, current), time: Date.now() }))
    } catch { /* storage is not available */ }
  }, { capture: true })
  const fontOf = (cs: CSSStyleDeclaration) => ({ fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing })
  function glideTab () {
    let saved: { label: string, href: string, left: number, top?: number, time: number } | null = null
    try { saved = JSON.parse(sessionStorage.getItem('m-tab') ?? 'null'); sessionStorage.removeItem('m-tab') } catch { return }
    if (!saved || still() || Date.now() - saved.time > 5000) return
    const nav = [...document.querySelectorAll<HTMLElement>(TABS)].find(n => n.getAttribute('aria-label') === saved!.label && n.getClientRects().length)
    const current = nav && marked(nav)
    if (!nav || !current || current.getAttribute('href') !== saved.href) return
    const mark = getComputedStyle(current, '::before').content
    if (!mark || mark === 'none' || mark === 'normal') return
    current.classList.add('is-landing')
    document.fonts.ready.then(() => {
      const from = saved!
      const cs = getComputedStyle(current)
      const left = offsetIn(nav, current)
      const top = topIn(nav, current)
      const glide = document.createElement('span')
      glide.className = 'tab-glide'
      glide.setAttribute('aria-hidden', 'true')
      glide.textContent = JSON.parse(mark)
      Object.assign(glide.style, { left: `${left}px`, top: `${top}px`, paddingTop: cs.paddingTop, paddingLeft: cs.paddingLeft, ...fontOf(cs), textTransform: cs.textTransform, color: cs.color })
      nav.append(glide)
      const move = glide.animate([{ transform: `translate(${from.left - left}px, ${(from.top ?? top) - top}px)` }, { transform: 'none' }], { duration: ms('--motion-slow') + 60, easing: token('--ease-in-out') })
      const done = () => { glide.remove(); current.classList.remove('is-landing') }
      move.onfinish = done
      move.oncancel = done
    })
  }

  // A card that a page draws again after the first view (a new period) plays its first view again: its lines are drawn in, its bars fill.
  // Call it right after the card is in the page.
  return { provide: { motion: { replay: (unit: HTMLElement | null) => { if (unit && !still()) play(unit, 0) } } } }
})
