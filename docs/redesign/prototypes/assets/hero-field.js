// The field behind the hero of Αρχική: the articles of a day as dots, and the stories as the clusters the dots make.
// At rest it is quiet: a few clusters in the free space around the text, a few loose dots, all in the ink color. The size of a cluster is the articles of its story that day.
// The pointer moves the field: the loose dots part around it. A cluster it comes near lights up: its dots take the color of the group of the outlet that ran them, and the tooltip names the story and its first outlets. Nothing is a link.
// A dot stands for several articles, so it shows the size of a story, not a count. Every 12 seconds the clusters dissolve and form again from the day before (6 days, then the latest again).
// Load after dash.js, components.js and home.js.
(function () {
  const { t, fmt, h } = window.App
  const TAU = Math.PI * 2
  const CYCLE = 12
  const STEPS = 6
  const LOOSE = 70
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pointerFine = window.matchMedia('(hover: hover) and (pointer: fine)')

  const sum = (arr) => arr.reduce((a, b) => a + b, 0)
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
  const smooth = (x) => { const y = clamp(x, 0, 1); return y * y * (3 - 2 * y) }
  const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const title = (s) => (window.App.locale === 'en' && s.en) || s.el

  // ix: the lookups of Home.index. info(d, rank): Home.dayInfo for a day. home: the fixture of the home (it has the dates).
  function create ({ ix, home, info, i0, i1 }) {
    const canvas = h('canvas', { class: 'home-hero-field', 'aria-hidden': 'true' })
    const ctx = canvas.getContext('2d')
    const days = []
    for (let d = i1; d >= Math.max(i0, i1 - (STEPS - 1)); d--) if ((ix.byDay[d] || []).length >= 8) days.push(d)

    let section = null
    let w = 0
    let ht = 0
    let zones = []
    let wide = true
    let clock = 0
    let dayAt = 0
    let dayPtr = 0
    let raf = 0
    let last = 0
    let visible = true
    let fade = 0
    let clusters = []
    let focus = null
    const dots = []
    const pointer = { x: 0, y: 0, on: false }

    const still = () => calm.matches
    const inZone = (x, y, pad = 0) => zones.some((z) => x > z.x0 - pad && x < z.x1 + pad && y > z.y0 - pad && y < z.y1 + pad)
    const scatter = (dot) => { dot.x = Math.random() * w; dot.y = Math.random() * ht; dot.vx = (Math.random() - 0.5) * 80; dot.vy = (Math.random() - 0.5) * 80 }

    // ---- the layout of a day ----
    // The clusters are placed largest first, each at the best of 120 random spots: the farthest from the ones placed, and clear of the text of the hero.
    function place (list, rand) {
      const placed = []
      for (const c of list) {
        let best = null
        for (let k = 0; k < 120; k++) {
          const x = c.r + 16 + rand() * Math.max(1, w - 2 * c.r - 32)
          const y = c.r + 16 + rand() * Math.max(1, ht - 2 * c.r - 32)
          let score = placed.length ? Math.min(...placed.map((p) => Math.hypot(p.x - x, p.y - y) - p.r - c.r)) : 200
          if (inZone(x, y, c.r)) score -= 1000
          if (!best || score > best.score) best = { x, y, score }
        }
        c.x = best.x
        c.y = best.y
        c.ph = rand() * TAU
        placed.push(c)
      }
    }
    const cache = new Map()
    const outletsOf = (d, rank) => { const key = `${d}:${rank}`; if (!cache.has(key)) cache.set(key, info(d, rank)); return cache.get(key) }

    function layout (d) {
      const rand = rng(d * 977 + 13)
      const list = (ix.byDay[d] || []).slice(0, wide ? 9 : 4)
      const max = list[0] ? list[0].n : 1
      clusters = list.map((o, rank) => {
        const count = 6 + Math.round(26 * Math.sqrt(o.n / max))
        return { s: o.s, n: o.n, d, rank, count, r: 12 + 3.2 * Math.sqrt(count), members: [], lit: 0, got: outletsOf(d, rank) }
      })
      place(clusters, rand)
      const used = sum(clusters.map((c) => c.count))
      while (dots.length < used + LOOSE) { const dot = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, g: 0, wait: 0, seed: rand() }; scatter(dot); dots.push(dot) }
      let k = 0
      for (const c of clusters) {
        // The dots of a story go to its outlets in proportion to their articles, so the colors of a lit cluster are the real mix.
        const outlets = c.got ? c.got.outlets : []
        const total = Math.max(1, sum(outlets.map((o) => o.n)))
        let acc = 0
        let oi = 0
        for (let j = 0; j < c.count; j++) {
          const dot = dots[k++]
          dot.off = false
          dot.cl = c
          dot.or = c.r * Math.sqrt(rand())
          dot.oa = rand() * TAU
          dot.ow = (0.08 + 0.35 * (1 - dot.or / c.r)) * (dot.seed > 0.5 ? 1 : -1)
          dot.gmax = 1
          while (oi < outlets.length - 1 && (j + 0.5) / c.count > (acc + outlets[oi].n) / total) acc += outlets[oi++].n
          dot.group = outlets[oi] ? outlets[oi].group : null
          c.members.push(dot)
        }
      }
      for (let j = 0; k < dots.length; k++, j++) {
        const dot = dots[k]
        dot.off = j >= LOOSE
        dot.cl = null
        dot.group = null
        dot.hx = rand() * w
        dot.hy = rand() * ht
        for (let tries = 0; tries < 8 && inZone(dot.hx, dot.hy, 6); tries++) { dot.hx = rand() * w; dot.hy = rand() * ht }
        dot.gmax = 0.3
      }
    }

    function target (dot) {
      const c = dot.cl
      if (c) {
        const cx = c.x + Math.sin(clock * 0.2 + c.ph) * 5
        const cy = c.y + Math.cos(clock * 0.17 + c.ph) * 4
        const tight = 1 - 0.22 * c.lit
        dot.tx = cx + Math.cos(dot.oa + dot.ow * clock) * dot.or * tight
        dot.ty = cy + Math.sin(dot.oa + dot.ow * clock) * dot.or * 0.85 * tight
      } else {
        dot.tx = dot.hx + Math.sin(clock * 0.15 + dot.seed * 40) * 36
        dot.ty = dot.hy + Math.cos(clock * 0.12 + dot.seed * 25) * 28
      }
    }

    // ---- the physics ----
    // A dot is pulled to its target by a spring and, while it waits, wanders. The pull rises over a second, so a dot leaves the crowd and settles.
    // The pointer pushes: a loose dot a lot, a dot of a cluster only a little, so a cluster keeps its shape and the pointer can reach it.
    function step (dt) {
      for (const dot of dots) {
        if (dot.off) continue
        if (dot.wait > 0) { dot.wait -= dt; dot.g = 0 } else dot.g = Math.min(dot.gmax, dot.g + dt * 1.6)
        target(dot)
        const gg = smooth(dot.g)
        let ax = gg * (14 * (dot.tx - dot.x) - 7.1 * dot.vx) + (1 - gg) * ((Math.random() - 0.5) * 700 - 1.2 * dot.vx)
        let ay = gg * (14 * (dot.ty - dot.y) - 7.1 * dot.vy) + (1 - gg) * ((Math.random() - 0.5) * 700 - 1.2 * dot.vy)
        let near = 0
        if (pointer.on) {
          const dx = dot.x - pointer.x
          const dy = dot.y - pointer.y
          const d = Math.hypot(dx, dy)
          near = (1 - clamp(d / 190, 0, 1)) ** 2
          if (d < 130 && d > 0.01) {
            const push = (1 - d / 130) ** 2 * (dot.cl ? 360 : 620)
            ax += (dx / d) * push
            ay += (dy / d) * push
          }
        }
        dot.p = (dot.p || 0) + (near - (dot.p || 0)) * Math.min(1, dt * 9)
        dot.vx += ax * dt
        dot.vy += ay * dt
        dot.x += dot.vx * dt
        dot.y += dot.vy * dt
      }
      for (const c of clusters) c.lit += ((c === focus ? 1 : 0) - c.lit) * Math.min(1, dt * 8)
    }
    function snap () {
      for (const dot of dots) { if (dot.off) continue; target(dot); dot.x = dot.tx; dot.y = dot.ty; dot.vx = dot.vy = 0; dot.g = dot.gmax; dot.wait = 0 }
      for (const c of clusters) c.lit = c === focus ? 1 : 0
    }

    // ---- the drawing ----
    const ink = () => Dash.color('--ink')
    const accent = () => Dash.color('--accent')
    function bubbles (list, grow) {
      ctx.beginPath()
      for (const dot of list) {
        const r = 1.3 + dot.seed * 0.9 + grow
        ctx.moveTo(dot.x + r, dot.y)
        ctx.arc(dot.x, dot.y, r, 0, TAU)
      }
    }
    function render () {
      ctx.setTransform(canvas.width / Math.max(w, 1), 0, 0, canvas.height / Math.max(ht, 1), 0, 0)
      ctx.clearRect(0, 0, w, ht)
      const on = Math.max(0, ...clusters.map((c) => c.lit))
      const base = (wide ? 1 : 0.6) * fade
      // The loose dots wake up as the pointer comes near: each one has its own alpha.
      ctx.fillStyle = ink()
      for (const dot of dots) {
        if (dot.off || dot.cl) continue
        const r = 1.3 + dot.seed * 0.9
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, r + dot.p * 0.8, 0, TAU)
        ctx.globalAlpha = (0.2 + 0.4 * dot.p) * base * (1 - 0.5 * on)
        ctx.fill()
      }
      for (const c of clusters) {
        const dim = 1 - 0.6 * on * (1 - c.lit)
        ctx.fillStyle = ink()
        bubbles(c.members, 0)
        ctx.globalAlpha = 0.5 * base * dim * (1 - c.lit)
        ctx.fill()
        if (c.lit < 0.02) continue
        const byGroup = new Map()
        for (const dot of c.members) { if (!byGroup.has(dot.group)) byGroup.set(dot.group, []); byGroup.get(dot.group).push(dot) }
        for (const [group, list] of byGroup) {
          ctx.fillStyle = Dash.groupColor(group)
          bubbles(list, 0.5)
          ctx.globalAlpha = 0.95 * c.lit
          ctx.fill()
        }
        ctx.strokeStyle = accent()
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r + 12, 0, TAU)
        ctx.globalAlpha = 0.25 * c.lit
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // ---- the loop ----
    function frame (now) {
      raf = 0
      if (!canvas.isConnected) { teardown(); return }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt
      fade = Math.min(1, fade + dt / 0.9)
      if (days.length > 1 && clock - dayAt > CYCLE) nextDay()
      step(dt)
      render()
      go()
    }
    function go () { if (!raf && visible && !document.hidden && !still() && canvas.isConnected) { last = performance.now(); raf = requestAnimationFrame(frame) } }
    function halt () { if (raf) cancelAnimationFrame(raf); raf = 0 }
    function setDay (first) {
      focus = null
      UI.hideTooltip()
      layout(days[dayPtr])
      for (const dot of dots) {
        if (first) { scatter(dot); dot.wait = 0.1 + Math.random() * 0.7 } else { dot.wait = Math.random() * 1.1; dot.vx += (Math.random() - 0.5) * 120; dot.vy += (Math.random() - 0.5) * 120 }
        dot.g = 0
      }
    }
    function nextDay () { dayPtr = (dayPtr + 1) % days.length; dayAt = clock; setDay(false) }

    // ---- the size of the field and the text of the hero it stays clear of ----
    function measure () {
      const box = section.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = box.width
      ht = box.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(ht * dpr)
      wide = w >= 760
      zones = [...section.querySelectorAll('.home-mast, .home-hero-search, .home-hero-try, .home-hero-stats, .home-hero-more')].map((el) => {
        const r = el.getBoundingClientRect()
        return { x0: r.left - box.left - 28, x1: r.right - box.left + 28, y0: r.top - box.top - 22, y1: r.bottom - box.top + 22 }
      })
    }

    // ---- the pointer ----
    function unfocus () { if (focus) { focus = null; UI.hideTooltip(); if (still()) { snap(); render() } } }
    function onMove (e) {
      if (e.pointerType === 'touch' || !pointerFine.matches) return
      const box = section.getBoundingClientRect()
      pointer.x = e.clientX - box.left
      pointer.y = e.clientY - box.top
      pointer.on = !still()
      if (!wide || e.target.closest('a, button, input, textarea, [role="dialog"], .search-panel')) return unfocus()
      let best = null
      for (const c of clusters) {
        const dist = Math.hypot(c.x - pointer.x, c.y - pointer.y)
        if (dist < c.r + 14 && (!best || dist < best.dist)) best = { dist, c }
      }
      if (!best) return unfocus()
      if (focus !== best.c) { focus = best.c; if (still()) { snap(); render() } }
      const c = focus
      const outlets = c.got ? c.got.outlets : []
      UI.showTooltip({
        title: title(c.s),
        rows: outlets.slice(0, 3).map((o) => ({ label: o.name, value: fmt.int(o.n), color: Dash.groupColor(o.group) })),
        note: `${fmt.date(home.dates[c.d], { weekday: 'short', day: 'numeric', month: 'short' })} · ${t('home.field.tip', { n: fmt.int(c.n), o: outlets.length })}`
      }, box.left + c.x, anchorY(box, c))
    }
    // The tooltip sits over the cluster, centered on it, and under it when the window has no room above. It does not follow the pointer, so it never covers the dots it describes.
    function anchorY (box, c) {
      const top = box.top + c.y - c.r - 14
      return top - 170 < 8 ? box.top + c.y + c.r + 14 - 18 : top
    }
    function onLeave () { pointer.on = false; unfocus() }

    // ---- start and stop ----
    let io
    let ro
    function teardown () {
      halt()
      io?.disconnect()
      ro?.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
      calm.removeEventListener('change', onCalm)
      UI.hideTooltip()
    }
    function onVisible () { if (document.hidden) halt(); else go() }
    function onCalm () { if (still()) { halt(); snap(); fade = 1; render() } else { setDay(true); go() } }
    function attach () {
      section = canvas.parentElement
      if (!section || !days.length) return
      measure()
      setDay(true)
      if (still()) { snap(); fade = 1; render() } else go()
      io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) go(); else halt() })
      io.observe(section)
      ro = new ResizeObserver(() => {
        if (!canvas.isConnected) return teardown()
        measure()
        layout(days[dayPtr])
        for (const dot of dots) { dot.x = clamp(dot.x, 0, w); dot.y = clamp(dot.y, 0, ht) }
        if (still()) { snap(); render() }
      })
      ro.observe(section)
      document.addEventListener('visibilitychange', onVisible)
      calm.addEventListener('change', onCalm)
      section.addEventListener('pointermove', onMove)
      section.addEventListener('pointerleave', onLeave)
    }
    requestAnimationFrame(() => { if (canvas.isConnected) attach() })
    return canvas
  }

  window.HeroField = { create }
})()
