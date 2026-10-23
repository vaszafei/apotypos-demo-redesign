// Motion (#56): the page entrance, the fade of what a period or a filter changes, the thumb of a segmented control, the "/" of the current tab,
// the first view of the charts and the numbers, and the move of sorted tiles. The durations and easings are the tokens in tokens.css.
// Only transform and opacity move. With reduced motion the entrance and the changes only fade, and the rest is instant.
// Load after components.js and before shell.js.
(function () {
  const root = document.documentElement
  const app = document.getElementById('app')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const still = () => reduce.matches
  const token = (name) => getComputedStyle(root).getPropertyValue(name).trim()
  const ms = (name) => parseFloat(token(name)) || 0

  // A card that plays its first view on its own. A card that holds other cards (the tiles of Μέσα) leaves it to them.
  const UNIT = '.card, .dcard, .kpi-tile, .mme-tile'
  // The page head keeps still: its controls are what the visitor just used.
  const HEAD = '.page-head, .page-header, .dash-bar'
  const COUNTED = '.kpi-value, .dstat-value'

  // Until the first content is sorted, the CSS hides the marks of every chart, so no chart paints full and then grows.
  if (!still()) root.classList.add('m-intro')
  let introDone = false
  let lastInput = -Infinity
  for (const type of ['pointerdown', 'keydown', 'change', 'input']) document.addEventListener(type, () => { lastInput = performance.now() }, true)

  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < window.innerHeight && r.bottom > 0 }

  // 1. The page entrance: the blocks of the page rise in, one after the other. The page head stays, so a tab switch reads as a change of content.
  function enterPage (content) {
    const blocks = []
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

  // 2. The first view of a card: its charts grow, its bars fill, its numbers count up. A card below the fold waits until it scrolls into view.
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((e, k) => { io.unobserve(e.target); play(e.target, delayOf(e.target, k, false)) })
    }, { rootMargin: '0px 0px -15% 0px' })
    : null

  // A tile waits for the tiles before it in its row (and its row, on the first view), so the grid fills as a diagonal wave.
  function delayOf (unit, k, first) {
    if (unit.matches('.mme-tile') && unit.parentElement) {
      const tiles = [...unit.parentElement.children]
      const col = tiles.filter((x) => x.offsetTop === unit.offsetTop && x.offsetLeft < unit.offsetLeft).length
      const row = first ? new Set(tiles.filter((x) => x.offsetTop < unit.offsetTop && visible(x)).map((x) => x.offsetTop)).size : 0
      return 120 + (row + col) * 60
    }
    return (first ? 100 : 0) + Math.min(k, 8) * ms('--motion-stagger')
  }

  function play (unit, delay) {
    unit.style.setProperty('--m-delay', `${delay}ms`)
    unit.classList.remove('m-wait')
    unit.classList.add('m-play')
    unit.querySelectorAll('svg.chart').forEach(indexMarks)
    unit.querySelectorAll(COUNTED).forEach((el) => countUp(el, unit, delay))
    // After the longest entrance (a bar chart with its wave), the card is done: a later redraw, such as a resize, draws at once.
    setTimeout(() => unit.classList.replace('m-play', 'm-done'), delay + 2400)
  }

  // The wave of a bar chart and the order of the points: each mark knows its index.
  function indexMarks (svg) {
    for (const cls of ['bar', 'pt', 'line-dot', 'slice', 'ring-arc']) svg.querySelectorAll(`.${cls}`).forEach((el, i) => el.style.setProperty('--m-i', i))
  }

  // Count up: the number stays in the page for screen readers and tests. A copy over it, hidden from them, counts from 0.
  function parseNumber (text) {
    const m = text.trim().match(/^([^\d−-]*)([−-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(.*)$/)
    if (!m) return null
    const [, pre, sign, whole, dec = '', post] = m
    return { pre, sign, post, decimals: dec.length, group: whole.includes('.'), value: Number(whole.replace(/\./g, '') + (dec ? `.${dec}` : '')) }
  }
  function formatNumber (n, v) {
    let [whole, dec] = v.toFixed(n.decimals).split('.')
    if (n.group) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${n.pre}${n.sign}${whole}${dec ? `,${dec}` : ''}${n.post}`
  }
  // The font of a copy that sits over the real text. The font shorthand of getComputedStyle can be empty, so copy each part.
  const fontOf = (cs) => ({ fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing })
  function countUp (el, unit, delay) {
    if (el.children.length) return
    const n = parseNumber(el.textContent)
    if (!n || !n.value) return
    if (getComputedStyle(unit).position === 'static') unit.style.position = 'relative'
    const cs = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    const host = unit.getBoundingClientRect()
    const ghost = document.createElement('span')
    ghost.className = 'count-ghost'
    ghost.setAttribute('aria-hidden', 'true')
    const right = ['right', 'end'].includes(cs.textAlign)
    Object.assign(ghost.style, {
      top: `${box.top - host.top - unit.clientTop + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth)}px`,
      ...fontOf(cs), fontFeatureSettings: cs.fontFeatureSettings, fontVariantNumeric: cs.fontVariantNumeric, color: cs.color
    })
    if (right) ghost.style.right = `${host.right - box.right - unit.clientLeft + parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth)}px`
    else ghost.style.left = `${box.left - host.left - unit.clientLeft + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)}px`
    ghost.textContent = formatNumber(n, 0)
    el.classList.add('is-counting')
    unit.append(ghost)
    const duration = 900
    let start = null
    const step = (now) => {
      if (start === null) start = now + delay
      const p = Math.min(1, Math.max(0, (now - start) / duration))
      ghost.textContent = p < 1 ? formatNumber(n, n.value * (1 - (1 - p) ** 3)) : el.textContent
      if (p < 1 && ghost.isConnected) requestAnimationFrame(step)
      else { ghost.remove(); el.classList.remove('is-counting') }
    }
    requestAnimationFrame(step)
  }

  function intro () {
    if (introDone) return
    introDone = true
    const content = document.getElementById('content')
    if (content) enterPage(content)
    if (!still() && content) {
      const units = [...content.querySelectorAll(UNIT)]
      let k = 0
      for (const unit of units) {
        if (unit.querySelector(UNIT)) { unit.classList.add('m-done'); continue }
        if (visible(unit)) play(unit, delayOf(unit, k++, true))
        else if (io) { unit.classList.add('m-wait'); io.observe(unit) }
      }
    }
    root.classList.remove('m-intro')
    glideTab()
  }

  // The first content of the page: the shell draws it in one task. The intro runs in the next frame, after the charts draw.
  const first = new MutationObserver(() => {
    if (!document.getElementById('content')?.childElementCount) return
    first.disconnect()
    requestAnimationFrame(intro)
  })
  if (app) first.observe(app, { childList: true, subtree: true })
  // A page that never fills #content still shows its charts.
  setTimeout(intro, 3000)
  // A printed page shows every chart, also the ones below the fold that wait for their view.
  window.addEventListener('beforeprint', () => document.querySelectorAll('.m-wait').forEach((unit) => unit.classList.replace('m-wait', 'm-done')))

  // 3. A change after a click, a key or a list: the cards that changed fade in from a lighter shade. The cards that did not change stay.
  const isEl = (n) => n.nodeType === 1
  function fade (el) {
    el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: ms('--motion-slow'), easing: token('--ease-out') })
  }
  function fadeChanged (before, after, depth) {
    after.forEach((el, i) => {
      if (el.matches(HEAD) || el.querySelector('[data-flip-key]')) return
      const old = before[i]
      if (old && old.outerHTML === el.outerHTML) return
      if (old && depth < 2 && el.matches('.dash-grid, .card-col, .kpi-strip') && old.children.length === el.children.length) {
        fadeChanged([...old.children], [...el.children], depth + 1)
        return
      }
      fade(el)
    })
  }
  const changes = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) if (isEl(n) && !still()) (n.matches('svg.chart') ? [n] : n.querySelectorAll('svg.chart')).forEach(indexMarks)
      if (!introDone || performance.now() - lastInput > 1500 || !r.addedNodes.length) continue
      // A chart that draws again, the search list and the tooltips change on their own.
      if (r.target.closest('svg, .chart-holder, .fit, .global-search, .info, .segmented')) continue
      fadeChanged([...r.removedNodes].filter(isEl), [...r.addedNodes].filter(isEl), 0)
    }
  })
  if (app) changes.observe(app, { childList: true, subtree: true })

  // 4. The thumb of a segmented control: the pill of the old choice slides to the new one, also when the page draws the control again.
  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('.segmented button')
    if (!button || still()) return
    const group = button.closest('.segmented')
    const old = group.querySelector('button[aria-pressed="true"]')
    if (!old || old === button) return
    const label = group.getAttribute('aria-label')
    const peers = () => [...document.querySelectorAll('.segmented')].filter((g) => g.getAttribute('aria-label') === label)
    const index = peers().indexOf(group)
    const from = old.getBoundingClientRect()
    requestAnimationFrame(() => {
      const now = group.isConnected ? group : peers()[index]
      const target = now?.querySelector('button[aria-pressed="true"]')
      if (target) slideThumb(now, from, target)
    })
  }, true)
  function slideThumb (group, from, button) {
    const to = button.getBoundingClientRect()
    const box = group.getBoundingClientRect()
    if (!to.width || (Math.abs(from.left - to.left) < 1 && Math.abs(from.top - to.top) < 1)) return
    const cs = getComputedStyle(button)
    const thumb = document.createElement('span')
    thumb.className = 'seg-thumb'
    thumb.setAttribute('aria-hidden', 'true')
    Object.assign(thumb.style, {
      left: `${to.left - box.left - group.clientLeft}px`, top: `${to.top - box.top - group.clientTop}px`, width: `${to.width}px`, height: `${to.height}px`,
      borderRadius: cs.borderRadius, background: cs.backgroundColor
    })
    group.append(thumb)
    button.classList.add('is-landing')
    const move = thumb.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
      { transform: 'none' }
    ], { duration: ms('--motion-base') + 60, easing: token('--ease-out') })
    const done = () => { thumb.remove(); button.classList.remove('is-landing') }
    move.onfinish = done
    move.oncancel = done
  }

  // 5. The "/" of the current tab: a click on a tab keeps where the "/" was, and the next page glides it to its own tab.
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('.section-tabs a[href]')
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.hasAttribute('aria-current')) return
    const nav = link.closest('.section-tabs')
    const current = nav.querySelector('a[aria-current]')
    if (!current) return
    try {
      sessionStorage.setItem('m-tab', JSON.stringify({ label: nav.getAttribute('aria-label'), href: link.getAttribute('href'), left: offsetIn(nav, current), time: Date.now() }))
    } catch { /* storage is not available */ }
  }, true)
  const offsetIn = (nav, el) => el.getBoundingClientRect().left - nav.getBoundingClientRect().left - nav.clientLeft + nav.scrollLeft
  function glideTab () {
    let saved = null
    try { saved = JSON.parse(sessionStorage.getItem('m-tab')); sessionStorage.removeItem('m-tab') } catch { return }
    if (!saved || still() || Date.now() - saved.time > 5000) return
    const nav = [...document.querySelectorAll('.section-tabs')].find((n) => n.getAttribute('aria-label') === saved.label)
    const current = nav?.querySelector('a[aria-current]')
    if (!current || current.getAttribute('href') !== saved.href) return
    const mark = getComputedStyle(current, '::before').content
    if (!mark || mark === 'none' || mark === 'normal') return
    current.classList.add('is-landing')
    document.fonts.ready.then(() => {
      const cs = getComputedStyle(current)
      const left = offsetIn(nav, current)
      const glide = document.createElement('span')
      glide.className = 'tab-glide'
      glide.setAttribute('aria-hidden', 'true')
      glide.textContent = JSON.parse(mark)
      Object.assign(glide.style, {
        left: `${left}px`, top: `${current.getBoundingClientRect().top - nav.getBoundingClientRect().top - nav.clientTop + nav.scrollTop}px`,
        paddingTop: cs.paddingTop, ...fontOf(cs), textTransform: cs.textTransform, color: cs.color
      })
      nav.append(glide)
      const move = glide.animate([{ transform: `translateX(${saved.left - left}px)` }, { transform: 'none' }], { duration: ms('--motion-slow') + 60, easing: token('--ease-in-out') })
      const done = () => { glide.remove(); current.classList.remove('is-landing') }
      move.onfinish = done
      move.oncancel = done
    })
  }

  // 6. Sorted tiles move to their new place (FLIP). An element with data-flip-key keeps its key when the page draws it again.
  let flipFrom = null
  function keepPlaces () {
    if (still()) return
    const els = document.querySelectorAll('[data-flip-key]')
    if (!els.length) return
    flipFrom = new Map([...els].map((el) => [el.dataset.flipKey, el.getBoundingClientRect()]))
    requestAnimationFrame(flip)
  }
  document.addEventListener('click', keepPlaces, true)
  document.addEventListener('change', keepPlaces, true)
  function flip () {
    const from = flipFrom
    flipFrom = null
    if (!from) return
    const inView = (r) => r.bottom > 0 && r.top < window.innerHeight
    for (const el of document.querySelectorAll('[data-flip-key]')) {
      const old = from.get(el.dataset.flipKey)
      const now = el.getBoundingClientRect()
      if (!old) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms('--motion-slow'), easing: token('--ease-out') }); continue }
      const dx = old.left - now.left
      const dy = old.top - now.top
      if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || !(inView(old) || inView(now))) continue
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: ms('--motion-slow') + 140, easing: token('--ease-in-out') })
    }
  }
})()
