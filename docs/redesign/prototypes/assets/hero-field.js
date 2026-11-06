// The field behind the hero of Αρχική: a network. The dots are articles, a story is the dots joined by thin lines into one web, a thema is the stories that share it, joined by dashed arcs.
// A web is one story of the day; its size is the articles of the story that day. Its color is its thema, the color the donut of the topics gives the largest themata of that day (the rest, and the soft themata, stay in the ink color).
// The webs roam: each drifts on its own slow path, turns from the edges and from the text of the hero, and keeps clear of the others. The loose dots are the other articles, with no line; they take the themata in the shares of the day.
// The pointer parts the loose dots. A web it reaches slows down and lights up, with the webs and the arcs of its thema; the tooltip names the story and its thema. Nothing is a link, and outlets are not shown.
// A dot stands for several articles, so it shows size, not a count. Every 12 seconds the webs dissolve and form again from the day before: the lines return as the dots settle. The days are the latest ones that have themata (the coded data may end before the volume does).
// Load after dash.js, components.js and home.js.
(function () {
  const { t, fmt, h } = window.App
  const TAU = Math.PI * 2
  const CYCLE = 12
  const STEPS = 6
  const LOOSE = 70
  const SLOTS = 6
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pointerFine = window.matchMedia('(hover: hover) and (pointer: fine)')

  const sum = (arr) => arr.reduce((a, b) => a + b, 0)
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
  const smooth = (x) => { const y = clamp(x, 0, 1); return y * y * (3 - 2 * y) }
  const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const name = (x) => (x && (x[window.App.locale] || x.el)) || ''

  // ix: the lookups of Home.index. home: the fixture of the home (the dates, the themata and their articles per day).
  function create ({ ix, home, i0, i1 }) {
    const canvas = h('canvas', { class: 'home-hero-field', 'aria-hidden': 'true' })
    const ctx = canvas.getContext('2d')

    // ---- the days and their themata ----
    const hasThemata = (d) => home.issueDaily.some((a) => a[d] > 0)
    const rich = (d) => (ix.byDay[d] || []).length >= 8
    const days = []
    for (let d = i1; d >= i0 && days.length < STEPS; d--) if (rich(d) && hasThemata(d)) days.push(d)
    // No day of the period has themata: the latest days, all in the ink color.
    if (!days.length) for (let d = i1; d >= i0 && days.length < STEPS; d--) if (rich(d)) days.push(d)

    // The color slots of a day: the largest news themata (not the soft ones) in the order of the donut, so a thema has here the color it has there.
    const themata = new Map()
    function themataOf (d) {
      if (!themata.has(d)) {
        const rows = home.issues.map((x, k) => ({ x, k, n: home.issueDaily[k][d] || 0 })).filter((r) => !r.x.soft && r.n > 0).sort((a, b) => b.n - a.n)
        const slotOf = new Map(rows.slice(0, SLOTS).map((r, i) => [r.k, i]))
        const total = sum(rows.map((r) => r.n))
        themata.set(d, { slotOf, shares: rows.slice(0, SLOTS).map((r, i) => ({ slot: i, p: r.n / total })), total })
      }
      return themata.get(d)
    }

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
    let links = []
    let focus = null
    const dots = []
    const pointer = { x: 0, y: 0, on: false }

    const still = () => calm.matches
    const inZone = (x, y, pad = 0) => zones.some((z) => x > z.x0 - pad && x < z.x1 + pad && y > z.y0 - pad && y < z.y1 + pad)
    const scatter = (dot) => { dot.x = Math.random() * w; dot.y = Math.random() * ht; dot.vx = (Math.random() - 0.5) * 80; dot.vy = (Math.random() - 0.5) * 80 }

    // ---- the layout of a day ----
    // The clusters start at the best of 120 random spots each: the farthest from the ones placed, and clear of the text of the hero. Then they roam.
    function place (list, rand) {
      const placed = []
      for (const c of list) {
        let best = null
        for (let k = 0; k < 120; k++) {
          const x = c.r + 16 + rand() * Math.max(1, w - 2 * c.r - 32)
          const y = c.r + 16 + rand() * Math.max(1, ht - 2 * c.r - 32)
          let score = placed.length ? Math.min(...placed.map((p) => Math.hypot(p.x - x, p.y - y) - p.r - c.r)) : 200
          if (wide && inZone(x, y, c.r)) score -= 1000
          if (!best || score > best.score) best = { x, y, score }
        }
        c.x = best.x
        c.y = best.y
        placed.push(c)
      }
    }

    // The shape of a story: its dots spread over a disc (each at the best of 14 spots, the farthest from the dots placed), the one nearest the center first (the hub).
    // Each dot is joined to its nearest placed dot, and some to the second nearest, so the lines make one web with a few loops.
    function web (count, r, rand) {
      const offs = []
      for (let j = 0; j < count; j++) {
        let best = null
        for (let k = 0; k < 14; k++) {
          const a = rand() * TAU
          const rr = r * Math.sqrt(rand())
          const x = Math.cos(a) * rr
          const y = Math.sin(a) * rr * 0.85
          const gap = offs.length ? Math.min(...offs.map((q) => Math.hypot(q.x - x, q.y - y))) : 99
          if (!best || gap > best.gap) best = { x, y, gap }
        }
        offs.push(best)
      }
      offs.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
      const edges = []
      for (let i = 1; i < offs.length; i++) {
        const near = offs.slice(0, i).map((q, j) => ({ j, d: Math.hypot(q.x - offs[i].x, q.y - offs[i].y) })).sort((a, b) => a.d - b.d)
        edges.push([i, near[0].j, near[0].d])
        if (near[1] && near[1].d < near[0].d * 1.7 && rand() < 0.45) edges.push([i, near[1].j, near[1].d])
      }
      return { offs, edges }
    }

    function layout (d) {
      const rand = rng(d * 977 + 13)
      const day = themataOf(d)
      const list = (ix.byDay[d] || []).slice(0, wide ? 9 : 4)
      const max = list[0] ? list[0].n : 1
      clusters = list.map((o) => {
        const count = 6 + Math.round(26 * Math.sqrt(o.n / max))
        const known = home.issues[o.s.issue] && !home.issues[o.s.issue].catchAll
        const slot = day.slotOf.has(o.s.issue) ? day.slotOf.get(o.s.issue) : -1
        const r = 16 + 4.2 * Math.sqrt(count)
        return { s: o.s, n: o.n, d, count, r, members: [], lit: 0, rel: 0, coh: 0, slot, issue: known ? o.s.issue : -1, ...web(count, r, rand),
          vx: 0, vy: 0, th: rand() * TAU, sp: 9 + rand() * 6, ph: rand() * TAU, rot: rand() * TAU, rv: (rand() - 0.5) * 0.1 }
      })
      place(clusters, rand)
      const used = sum(clusters.map((c) => c.count))
      while (dots.length < used + LOOSE) { const dot = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, g: 0, wait: 0, seed: rand() }; scatter(dot); dots.push(dot) }
      let k = 0
      for (const c of clusters) {
        for (let j = 0; j < c.count; j++) {
          const dot = dots[k++]
          dot.off = false
          dot.cl = c
          dot.slot = c.slot
          dot.ox = c.offs[j].x
          dot.oy = c.offs[j].y
          dot.hub = j === 0
          dot.gmax = 1
          c.members.push(dot)
        }
      }
      // The stories of one thema are joined in a chain, the largest first.
      links = []
      const byIssue = new Map()
      for (const c of clusters) if (c.issue >= 0) { if (!byIssue.has(c.issue)) byIssue.set(c.issue, []); byIssue.get(c.issue).push(c) }
      for (const group of byIssue.values()) for (let i = 1; i < group.length; i++) links.push([group[i - 1], group[i]])
      for (let j = 0; k < dots.length; k++, j++) {
        const dot = dots[k]
        dot.off = j >= LOOSE
        dot.cl = null
        // The other articles take the themata in the shares of the day.
        let pick = rand()
        dot.slot = -1
        for (const s of day.shares) { if (pick < s.p) { dot.slot = s.slot; break } pick -= s.p }
        dot.hx = rand() * w
        dot.hy = rand() * ht
        dot.hvx = (rand() - 0.5) * 14
        dot.hvy = (rand() - 0.5) * 14
        dot.gmax = 0.3
      }
    }

    function target (dot) {
      const c = dot.cl
      if (c) {
        // The web turns slowly as a whole; each dot trembles a little.
        const a = c.rot + c.rv * clock
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        dot.tx = c.x + cos * dot.ox - sin * dot.oy + Math.sin(clock * 0.7 + dot.seed * 30) * 1.8
        dot.ty = c.y + sin * dot.ox + cos * dot.oy + Math.cos(clock * 0.6 + dot.seed * 21) * 1.8
      } else {
        dot.tx = dot.hx + Math.sin(clock * 0.15 + dot.seed * 40) * 30
        dot.ty = dot.hy + Math.cos(clock * 0.12 + dot.seed * 25) * 24
      }
    }

    // ---- the roaming of the clusters ----
    // A cluster keeps a heading that turns slowly. The edges, the text of the hero and the other clusters push it away, and it turns to leave. A cluster under the pointer almost stops, so it can be reached.
    function roam (dt) {
      for (const c of clusters) {
        c.th += (Math.sin(clock * 0.31 + c.ph) + Math.sin(clock * 0.17 + c.ph * 2.1)) * 0.5 * dt
        let px = 0
        let py = 0
        const m = c.r + 18
        if (c.x < m) px += (m - c.x) * 2
        if (c.x > w - m) px -= (c.x - (w - m)) * 2
        if (c.y < m) py += (m - c.y) * 2
        if (c.y > ht - m) py -= (c.y - (ht - m)) * 2
        if (wide) {
          const pad = c.r + 10
          for (const z of zones) {
            const l = c.x - (z.x0 - pad)
            const r = z.x1 + pad - c.x
            const tp = c.y - (z.y0 - pad)
            const b = z.y1 + pad - c.y
            if (l <= 0 || r <= 0 || tp <= 0 || b <= 0) continue
            const near = Math.min(l, r, tp, b)
            if (near === l) px -= (near + 8) * 3
            else if (near === r) px += (near + 8) * 3
            else if (near === tp) py -= (near + 8) * 3
            else py += (near + 8) * 3
          }
        }
        for (const o of clusters) {
          if (o === c) continue
          const dx = c.x - o.x
          const dy = c.y - o.y
          const d = Math.hypot(dx, dy) || 1
          const gap = c.r + o.r + 44
          if (d < gap) { px += (dx / d) * (gap - d) * 1.2; py += (dy / d) * (gap - d) * 1.2 }
        }
        if (px || py) c.th = Math.atan2(Math.sin(c.th) + py * 0.04, Math.cos(c.th) + px * 0.04)
        const slow = 1 - 0.92 * c.lit
        const vx = Math.cos(c.th) * c.sp * slow + px * 0.6
        const vy = Math.sin(c.th) * c.sp * slow + py * 0.6
        c.vx += (vx - c.vx) * Math.min(1, dt * 2)
        c.vy += (vy - c.vy) * Math.min(1, dt * 2)
        c.x += c.vx * dt
        c.y += c.vy * dt
      }
    }

    // ---- the physics ----
    // A dot is pulled to its target by a spring and, while it waits, wanders. The pull rises over a second, so a dot leaves the crowd and settles.
    // The pointer pushes: a loose dot a lot, a dot of a cluster only a little, so a cluster keeps its shape.
    function step (dt) {
      roam(dt)
      for (const dot of dots) {
        if (dot.off) continue
        if (!dot.cl) {
          dot.hx += dot.hvx * dt
          dot.hy += dot.hvy * dt
          if (dot.hx < 0 || dot.hx > w) { dot.hvx *= -1; dot.hx = clamp(dot.hx, 0, w) }
          if (dot.hy < 0 || dot.hy > ht) { dot.hvy *= -1; dot.hy = clamp(dot.hy, 0, ht) }
        }
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
      glow(dt)
    }
    // The focused cluster is lit; the others of its thema are half lit.
    function glow (dt) {
      for (const c of clusters) {
        const lit = c === focus ? 1 : 0
        const rel = focus && c !== focus && c.issue >= 0 && c.issue === focus.issue ? 0.55 : 0
        c.lit += (lit - c.lit) * Math.min(1, dt * 8)
        c.rel += (rel - c.rel) * Math.min(1, dt * 8)
      }
    }
    function snap () {
      for (const dot of dots) { if (dot.off) continue; target(dot); dot.x = dot.tx; dot.y = dot.ty; dot.vx = dot.vy = 0; dot.g = dot.gmax; dot.wait = 0 }
      glow(10)
    }

    // ---- the drawing ----
    const ink = () => Dash.color('--ink')
    const accent = () => Dash.color('--accent')
    const colorOf = (slot) => (slot >= 0 ? Dash.SLOTS[slot] : ink())
    function render () {
      ctx.setTransform(canvas.width / Math.max(w, 1), 0, 0, canvas.height / Math.max(ht, 1), 0, 0)
      ctx.clearRect(0, 0, w, ht)
      const on = Math.max(0, ...clusters.map((c) => c.lit))
      const base = (wide ? 1 : 0.6) * fade
      // The loose dots wake up as the pointer comes near: each one has its own alpha.
      for (const dot of dots) {
        if (dot.off || dot.cl) continue
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, 1.3 + dot.seed * 0.9 + (dot.p || 0) * 0.8, 0, TAU)
        ctx.fillStyle = colorOf(dot.slot)
        ctx.globalAlpha = (0.22 + 0.4 * (dot.p || 0)) * base * (1 - 0.5 * on)
        ctx.fill()
      }
      // How settled a web is: the dots near their places. Its lines and arcs are as strong as that, so a web that forms or dissolves does not stretch lines across the hero.
      for (const c of clusters) c.coh = clamp(1 - sum(c.members.map((dot) => Math.hypot(dot.x - dot.tx, dot.y - dot.ty))) / Math.max(1, c.members.length) / (c.r * 1.0), 0, 1) ** 2
      const dimOf = (c) => 1 - 0.6 * on * (1 - Math.max(c.lit, c.rel))
      // The themata: a dashed arc between two stories that share one, bowed away from the middle of the hero so it keeps off the text.
      ctx.lineWidth = 1
      ctx.setLineDash([2, 5])
      for (const [a, b] of links) {
        const hot = focus && focus.issue === a.issue ? 1 : 0
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        let nx = -dy / len
        let ny = dx / len
        if ((a.x + b.x - w) * nx + (a.y + b.y - ht) * ny < 0) { nx = -nx; ny = -ny }
        ctx.strokeStyle = colorOf(a.slot)
        ctx.globalAlpha = (0.2 + 0.5 * hot) * base * Math.min(a.coh, b.coh) * (on && !hot ? 0.4 : 1)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo((a.x + b.x) / 2 + nx * len * 0.2, (a.y + b.y) / 2 + ny * len * 0.2, b.x, b.y)
        ctx.stroke()
      }
      ctx.setLineDash([])
      for (const c of clusters) {
        const glowing = Math.max(c.lit, c.rel)
        const dim = dimOf(c)
        const color = colorOf(c.slot)
        // The story: the lines of its web, which fade in as its dots settle.
        ctx.strokeStyle = color
        ctx.lineWidth = 0.9 + 0.5 * c.lit
        ctx.beginPath()
        for (const [i, j, rest] of c.edges) {
          const a = c.members[i]
          const b = c.members[j]
          if (Math.hypot(a.x - b.x, a.y - b.y) > rest * 2.5 + 6) continue
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
        }
        ctx.globalAlpha = (0.3 + 0.45 * glowing) * base * dim * c.coh
        ctx.stroke()
        ctx.fillStyle = color
        ctx.beginPath()
        for (const dot of c.members) {
          const r = 1.5 + dot.seed * 0.9 + (dot.hub ? 1.2 : 0) + 0.5 * glowing
          ctx.moveTo(dot.x + r, dot.y)
          ctx.arc(dot.x, dot.y, r, 0, TAU)
        }
        ctx.globalAlpha = (0.6 + 0.35 * glowing) * base * dim
        ctx.fill()
        if (glowing < 0.02) continue
        ctx.strokeStyle = c.slot >= 0 ? color : accent()
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r + 12, 0, TAU)
        ctx.globalAlpha = 0.3 * glowing
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
      showTip(box, focus)
    }
    function showTip (box, c) {
      const topic = c.issue >= 0 ? home.issues[c.issue] : null
      UI.showTooltip({
        title: name(c.s),
        rows: [topic ? { label: t('home.field.topic'), value: name(topic), color: c.slot >= 0 ? colorOf(c.slot) : null } : null, { label: t('home.field.articles'), value: fmt.int(c.n) }].filter(Boolean),
        note: fmt.date(home.dates[c.d], { weekday: 'long', day: 'numeric', month: 'long' })
      }, box.left + c.x, box.top + c.y - c.r - 14)
      // The shared tooltip sits above the point and flips under it when there is no room, which would cover the cluster: then it goes under the cluster.
      const tip = document.querySelector('.tooltip')
      if (tip && tip.getBoundingClientRect().top > box.top + c.y - c.r) tip.style.top = `${Math.min(window.innerHeight - tip.offsetHeight - 8, box.top + c.y + c.r + 14)}px`
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
