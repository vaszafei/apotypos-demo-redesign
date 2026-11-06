// The field behind the hero of Αρχική: a network. The dots are articles, a story is the dots joined by thin lines into one web, a thema is the stories that share it, joined by dashed arcs.
// A web is one story of the day; its size is the articles of the story that day. Its color is its thema, the color the donut of the topics gives the largest themata of that day (the rest, and the soft themata, stay in the ink color).
// Nothing snaps. The webs drift slowly, each on its own path, turn from the edges and from the text of the hero, and keep clear of each other; each dot also wanders a few pixels on slow noise, so a web breathes.
// A web keeps its place and its shape from day to day. When the day changes, the dots of a web fade in or out one by one over a few seconds, its color and its arcs blend into the new ones, and the web is now another story.
// The loose dots are the other articles, with no line; they drift too, and take the themata in the shares of the day, a few at a time.
// The pointer parts the loose dots. A web it reaches slows down and lights up, with the webs and arcs of its thema; the tooltip names the story and its thema. Nothing is a link, and outlets are not shown.
// A click on a web zooms in on it: the other webs fade, the hero text gives way to a caption, and the dots grow large enough to play with. A click outside the web, or Esc, zooms out.
// A dot stands for several articles, so it shows size, not a count. The days are the latest ones that have themata (the coded data may end before the volume does).
// Load after dash.js, components.js and home.js.
(function () {
  const { t, fmt, h } = window.App
  const TAU = Math.PI * 2
  const CYCLE = 20
  const STEPS = 6
  const LOOSE = 70
  const COLORS = 6
  const PER = 32
  const MAXC = 9
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pointerFine = window.matchMedia('(hover: hover) and (pointer: fine)')

  const sum = (arr) => arr.reduce((a, b) => a + b, 0)
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
  const smooth = (x) => { const y = clamp(x, 0, 1); return y * y * (3 - 2 * y) }
  const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const name = (x) => (x && (x[window.App.locale] || x.el)) || ''
  // A color between two "#rrggbb" colors.
  function mixHex (a, b, k) {
    if (k >= 1 || a === b) return b
    const parts = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16))
    const [pa, pb] = [parts(a), parts(b)]
    return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('')}`
  }

  // The shape of a story: its dots spread over a disc (each at the best of 14 spots, the farthest from the dots placed), the one nearest the center first (the hub).
  // Each dot is joined to its nearest placed dot, and some to the second nearest, so the lines make one web with a few loops. A story of fewer dots is the first of them.
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
        const slotOf = new Map(rows.slice(0, COLORS).map((r, i) => [r.k, i]))
        const total = sum(rows.map((r) => r.n))
        themata.set(d, { slotOf, shares: rows.slice(0, COLORS).map((r, i) => ({ slot: i, p: r.n / total })) })
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
    let focus = null
    let zoomed = null
    let zs = 0
    let zt = 0
    const caption = h('div', { class: 'home-field-caption', 'aria-live': 'polite' })
    const INTERACTIVE = 'a, button, input, textarea, [role="dialog"], .search-panel'
    const dots = []
    const pointer = { x: 0, y: 0, on: false }
    const linkMap = new Map()

    const still = () => calm.matches
    const inZone = (x, y, pad = 0) => zones.some((z) => x > z.x0 - pad && x < z.x1 + pad && y > z.y0 - pad && y < z.y1 + pad)
    const scatter = (dot) => { dot.x = Math.random() * w; dot.y = Math.random() * ht; dot.vx = (Math.random() - 0.5) * 30; dot.vy = (Math.random() - 0.5) * 30 }
    const newDot = (seed) => { const dot = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, g: 0, wait: 0, seed, al: 0, on: false, want: false, delay: 0, gmax: 1, cl: null, slot: -1 }; dots.push(dot); return dot }

    // ---- the webs ----
    // There are always the same webs, one for each of the largest stories of the day; each keeps its place, its shape and its dots, and takes the story of its rank.
    const clusters = Array.from({ length: MAXC }, (_, i) => {
      const rand = rng(500 + i * 31)
      const { offs, edges } = web(PER, 16 + 4.2 * Math.sqrt(PER), rand)
      const ext = offs.map((_, k) => Math.max(...offs.slice(0, k + 1).map((q) => Math.hypot(q.x, q.y))))
      const c = { i, offs, edges, ext, members: [], x: 0, y: 0, vx: 0, vy: 0, th: rand() * TAU, sp: 4 + rand() * 4, ph: rand() * TAU, rot: rand() * TAU, rv: (rand() - 0.5) * 0.04,
        lit: 0, rel: 0, coh: 0, on: false, vis: false, s: null, n: 0, d: 0, count: 0, r: ext[PER - 1] + 10, issue: -1, slot: -1, prev: -1, mix: 1 }
      for (let j = 0; j < PER; j++) {
        const dot = newDot(rand())
        dot.cl = c
        dot.ox = offs[j].x
        dot.oy = offs[j].y
        dot.hub = j === 0
        c.members.push(dot)
      }
      return c
    })
    for (let j = 0; j < LOOSE; j++) {
      const rand = rng(9000 + j)
      const dot = newDot(rand())
      dot.on = dot.want = true
      dot.al = 1
      dot.gmax = 0.3
      dot.hvx = (rand() - 0.5) * 8
      dot.hvy = (rand() - 0.5) * 8
    }

    const colorOf = (slot) => (slot >= 0 ? Dash.SLOTS[slot] : Dash.color('--ink'))
    const colorNow = (c) => mixHex(colorOf(c.prev), colorOf(c.slot), c.mix)

    // The webs start at the best of 120 random spots each: the farthest from the ones placed, and clear of the text of the hero. Then they roam.
    function placeAll () {
      const rand = rng(77)
      const placed = []
      for (const c of clusters) {
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

    // The stories of a day go to the webs by rank. A dot of a web turns on or off after its own delay of up to 5 seconds, so the web grows or shrinks dot by dot.
    function assign (d, first) {
      const day = themataOf(d)
      const list = (ix.byDay[d] || []).slice(0, wide ? MAXC : 4)
      const max = list[0] ? list[0].n : 1
      clusters.forEach((c, i) => {
        const o = list[i]
        c.on = !!o
        if (o) {
          const slot = day.slotOf.has(o.s.issue) ? day.slotOf.get(o.s.issue) : -1
          c.prev = first || !c.s ? slot : c.slot
          c.mix = first || !c.s ? 1 : 0
          c.slot = slot
          c.s = o.s
          c.n = o.n
          c.d = d
          c.count = 6 + Math.round(26 * Math.sqrt(o.n / max))
          c.issue = home.issues[o.s.issue] && !home.issues[o.s.issue].catchAll ? o.s.issue : -1
          c.r = c.ext[c.count - 1] + 10
        } else c.count = 0
        c.members.forEach((dot, j) => {
          dot.want = c.on && j < c.count
          dot.delay = first ? 0 : Math.random() * 5
          if (first) dot.on = dot.want
        })
      })
      // The loose dots take the themata of the day in its shares, a few at a time.
      const rand = rng(d * 977 + 13)
      dots.filter((dot) => !dot.cl).forEach((dot) => {
        let pick = rand()
        let slot = -1
        for (const s of day.shares) { if (pick < s.p) { slot = s.slot; break } pick -= s.p }
        if (first) { dot.slot = slot; dot.hx = rand() * w; dot.hy = rand() * ht } else { dot.nextSlot = slot; dot.delay = Math.random() * 5 }
      })
      // The arcs: the webs that share a thema in a chain, the largest first. The ones that are no longer wanted fade out.
      const by = new Map()
      for (const c of clusters) if (c.on && c.issue >= 0) { if (!by.has(c.issue)) by.set(c.issue, []); by.get(c.issue).push(c) }
      const want = new Set()
      for (const group of by.values()) {
        for (let i = 1; i < group.length; i++) {
          const key = `${group[i - 1].i}-${group[i].i}`
          want.add(key)
          if (!linkMap.has(key)) linkMap.set(key, { a: group[i - 1], b: group[i], al: 0 })
        }
      }
      linkMap.forEach((l, key) => { l.want = want.has(key); if (first) l.al = l.want ? 1 : 0 })
    }

    function target (dot) {
      const c = dot.cl
      // Each dot wanders a few pixels on two slow waves, so a web breathes and no two dots move together.
      const f1 = 0.1 + dot.seed * 0.2
      const f2 = 0.07 + (1 - dot.seed) * 0.16
      const wx = Math.sin(clock * f1 + dot.seed * 57) * 4 + Math.sin(clock * f2 * 1.7 + dot.seed * 91) * 2.5
      const wy = Math.cos(clock * f2 + dot.seed * 33) * 4 + Math.cos(clock * f1 * 1.3 + dot.seed * 71) * 2.5
      if (c) {
        // The web turns slowly as a whole.
        const a = c.rot + c.rv * clock
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        dot.tx = c.x + cos * dot.ox - sin * dot.oy + wx
        dot.ty = c.y + sin * dot.ox + cos * dot.oy + wy
      } else {
        dot.tx = dot.hx + Math.sin(clock * 0.15 + dot.seed * 40) * 30 + wx
        dot.ty = dot.hy + Math.cos(clock * 0.12 + dot.seed * 25) * 24 + wy
      }
    }

    // ---- the zoom ----
    // The camera: screen = A + z * (world - B). It is the identity at rest; fully zoomed, the web is at the middle of the hero and S times larger.
    function view () {
      const c = zoomed
      if (!c) return { z: 1, ax: 0, ay: 0, bx: 0, by: 0, S: 1, Tx: 0, Ty: 0 }
      const Tx = w / 2
      const Ty = ht * 0.44
      const S = clamp(Math.min(w * 0.5, ht * 0.56) / (2 * Math.max(10, c.r - 10)), 2, 8)
      const e = smooth(zs)
      const bx = c.x * e
      const by = c.y * e
      return { z: 1 + (S - 1) * e, bx, by, ax: bx + (Tx - c.x) * e, ay: by + (Ty - c.y) * e, S, Tx, Ty }
    }
    function endZoom () { zoomed = null; zs = 0; zt = 0; focus = null; dayAt = clock; caption.classList.remove('is-on') }
    function fillCaption (c) {
      const topic = c.issue >= 0 ? home.issues[c.issue] : null
      const k = Math.max(1, Math.round(c.n / c.count))
      caption.replaceChildren(
        h('strong', { class: 'home-field-title' }, name(c.s)),
        h('span', { class: 'home-field-meta' }, topic ? h('i', { class: 'home-field-swatch', style: { background: colorOf(c.slot) } }) : null,
          `${topic ? `${name(topic)} · ` : ''}${fmt.int(c.n)} ${t('home.hero.articles')} · ${fmt.date(home.dates[c.d], { day: 'numeric', month: 'long' })}`),
        h('span', { class: 'home-field-note' }, t('home.field.dot', { k: fmt.int(k) })),
        h('span', { class: 'home-field-hint' }, t('home.field.back')))
    }
    function zoomIn (c) {
      zoomed = c
      zt = 1
      focus = c
      hideTip()
      section.classList.remove('is-field-hover')
      section.classList.add('is-zoomed')
      fillCaption(c)
      caption.classList.add('is-on')
      if (still()) { zs = 1; snap(); render() }
    }
    function zoomOut (now) {
      if (!zoomed) return
      zt = 0
      section.classList.remove('is-zoomed')
      caption.classList.remove('is-on')
      if (now || still()) { endZoom(); snap(); render() }
    }

    // ---- the roaming of the webs ----
    // A web keeps a heading that turns slowly. The edges, the text of the hero and the other webs push it away, and it turns to leave. A web under the pointer almost stops, so it can be reached.
    function roam (dt) {
      for (const c of clusters) {
        c.vis = c.on || c.members.some((dot) => dot.al > 0.02)
        if (!c.vis) continue
        if (zoomed === c && zt) { c.vx = c.vy = 0; continue }
        c.th += (Math.sin(clock * 0.21 + c.ph) + Math.sin(clock * 0.11 + c.ph * 2.1)) * 0.3 * dt
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
          if (o === c || !o.vis) continue
          const dx = c.x - o.x
          const dy = c.y - o.y
          const d = Math.hypot(dx, dy) || 1
          const gap = c.r + o.r + 44
          if (d < gap) { px += (dx / d) * (gap - d) * 1.2; py += (dy / d) * (gap - d) * 1.2 }
        }
        if (px || py) c.th = Math.atan2(Math.sin(c.th) + py * 0.03, Math.cos(c.th) + px * 0.03)
        const slow = 1 - 0.92 * c.lit
        const vx = Math.cos(c.th) * c.sp * slow + px * 0.5
        const vy = Math.sin(c.th) * c.sp * slow + py * 0.5
        c.vx += (vx - c.vx) * Math.min(1, dt * 0.8)
        c.vy += (vy - c.vy) * Math.min(1, dt * 0.8)
        c.x += c.vx * dt
        c.y += c.vy * dt
      }
    }

    // ---- the physics ----
    // A dot is pulled to its place by a spring (soft for a dot of a web, so it follows the web with a lag) and, before it has gathered, wanders.
    // The pointer pushes: a loose dot a lot, a dot of a web only a little, and none when the web is lit.
    function step (dt) {
      if (zoomed) {
        zs = zt > zs ? Math.min(zt, zs + dt / 1.1) : Math.max(zt, zs - dt / 0.9)
        if (!zt && zs <= 0) endZoom()
      }
      roam(dt)
      // The pointer in the world of the dots (zoomed, the same pixels reach fewer dots).
      const v = view()
      const pw = { x: (pointer.x - v.ax) / v.z + v.bx, y: (pointer.y - v.ay) / v.z + v.by }
      const R = 130 / v.z
      for (const dot of dots) {
        if (dot.delay > 0) {
          dot.delay -= dt
          if (dot.delay <= 0) { if (dot.cl) dot.on = dot.want; else if (dot.nextSlot !== undefined) dot.slot = dot.nextSlot }
        }
        dot.al += ((dot.on ? 1 : 0) - dot.al) * Math.min(1, dt * 0.9)
        if (!dot.cl) {
          dot.hx += dot.hvx * dt
          dot.hy += dot.hvy * dt
          if (dot.hx < 0 || dot.hx > w) { dot.hvx *= -1; dot.hx = clamp(dot.hx, 0, w) }
          if (dot.hy < 0 || dot.hy > ht) { dot.hvy *= -1; dot.hy = clamp(dot.hy, 0, ht) }
        }
        if (dot.wait > 0) { dot.wait -= dt; dot.g = 0 } else dot.g = Math.min(dot.gmax, dot.g + dt * 0.6)
        target(dot)
        const gg = smooth(dot.g)
        const K = dot.cl ? 5 : 14
        const C = dot.cl ? 4.5 : 7.1
        const wanderX = Math.sin(clock * 0.9 + dot.seed * 50) * Math.cos(clock * 0.37 + dot.seed * 17) * 90
        const wanderY = Math.cos(clock * 0.8 + dot.seed * 29) * Math.sin(clock * 0.41 + dot.seed * 13) * 90
        let ax = gg * (K * (dot.tx - dot.x) - C * dot.vx) + (1 - gg) * (wanderX - 0.9 * dot.vx)
        let ay = gg * (K * (dot.ty - dot.y) - C * dot.vy) + (1 - gg) * (wanderY - 0.9 * dot.vy)
        let near = 0
        if (pointer.on) {
          const dx = dot.x - pw.x
          const dy = dot.y - pw.y
          const d = Math.hypot(dx, dy)
          near = (1 - clamp(d / (R * 1.46), 0, 1)) ** 2
          if (d < R && d > 0.001) {
            const push = (1 - d / R) ** 2 * (dot.cl ? (dot.cl === zoomed ? 900 : 120 * (1 - 0.9 * dot.cl.lit)) : 620) / v.z
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
      linkMap.forEach((l, key) => { l.al += ((l.want ? 1 : 0) - l.al) * Math.min(1, dt * 0.8); if (!l.want && l.al < 0.01) linkMap.delete(key) })
      for (const c of clusters) c.mix = Math.min(1, c.mix + dt * 0.4)
      glow(dt)
    }
    // The focused web is lit; the others of its thema are half lit.
    function glow (dt) {
      for (const c of clusters) {
        const lit = c === focus ? 1 : 0
        const rel = focus && c !== focus && c.on && c.issue >= 0 && c.issue === focus.issue ? 0.55 : 0
        c.lit += (lit - c.lit) * Math.min(1, dt * 6)
        c.rel += (rel - c.rel) * Math.min(1, dt * 6)
      }
    }
    function snap () {
      for (const dot of dots) { target(dot); dot.x = dot.tx; dot.y = dot.ty; dot.vx = dot.vy = 0; dot.g = dot.gmax; dot.wait = 0; dot.delay = 0; dot.on = dot.cl ? dot.want : true; dot.al = dot.on ? 1 : 0 }
      for (const c of clusters) { c.mix = 1; c.vis = c.on }
      linkMap.forEach((l, key) => { if (!l.want) linkMap.delete(key); else l.al = 1 })
      glow(10)
    }

    // ---- the drawing ----
    const accent = () => Dash.color('--accent')
    function render () {
      ctx.setTransform(canvas.width / Math.max(w, 1), 0, 0, canvas.height / Math.max(ht, 1), 0, 0)
      ctx.clearRect(0, 0, w, ht)
      const v = view()
      ctx.translate(v.ax, v.ay)
      ctx.scale(v.z, v.z)
      ctx.translate(-v.bx, -v.by)
      const zk = smooth(zs)
      const away = 1 - 0.93 * zk
      const ks = v.z ** -0.5
      const lk = v.z ** -0.8
      const on = Math.max(0, ...clusters.map((c) => c.lit))
      const base = (wide ? 1 : 0.6) * fade
      // The loose dots wake up as the pointer comes near: each one has its own alpha.
      for (const dot of dots) {
        if (dot.cl) continue
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, (1.3 + dot.seed * 0.9 + (dot.p || 0) * 0.8) * ks, 0, TAU)
        ctx.fillStyle = colorOf(dot.slot)
        ctx.globalAlpha = (0.22 + 0.4 * (dot.p || 0)) * base * (1 - 0.5 * on) * away
        ctx.fill()
      }
      // How settled a web is: its dots near their places. Its lines and arcs are as strong as that, so a web that gathers does not throw lines across the hero.
      for (const c of clusters) c.coh = clamp(1 - sum(c.members.map((dot) => Math.hypot(dot.x - dot.tx, dot.y - dot.ty))) / c.members.length / (c.r * 1.4), 0, 1) ** 2
      // The themata: a dashed arc between two stories that share one, bowed away from the middle of the hero so it keeps off the text.
      ctx.lineWidth = lk
      ctx.setLineDash([2 / v.z, 5 / v.z])
      for (const l of linkMap.values()) {
        const { a, b } = l
        const hot = focus && focus.on && focus.issue === a.issue ? 1 : 0
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        let nx = -dy / len
        let ny = dx / len
        if ((a.x + b.x - w) * nx + (a.y + b.y - ht) * ny < 0) { nx = -nx; ny = -ny }
        ctx.strokeStyle = colorNow(a)
        ctx.globalAlpha = (0.2 + 0.5 * hot) * base * l.al * Math.min(a.coh, b.coh) * (on && !hot ? 0.4 : 1) * (1 - zk)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo((a.x + b.x) / 2 + nx * len * 0.2, (a.y + b.y) / 2 + ny * len * 0.2, b.x, b.y)
        ctx.stroke()
      }
      ctx.setLineDash([])
      for (const c of clusters) {
        if (!c.vis) continue
        const glowing = Math.max(c.lit, c.rel)
        const dim = (1 - 0.6 * on * (1 - glowing)) * (c === zoomed ? 1 : away)
        const color = colorNow(c)
        // The story: the lines of its web. A line is as strong as the weaker of its two dots.
        ctx.strokeStyle = color
        ctx.lineWidth = (0.9 + 0.5 * c.lit) * lk
        for (const [i, j, rest] of c.edges) {
          const a = c.members[i]
          const b = c.members[j]
          const both = Math.min(a.al, b.al)
          if (both < 0.03 || Math.hypot(a.x - b.x, a.y - b.y) > rest * 2.5 + 6) continue
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.globalAlpha = (0.3 + 0.45 * glowing) * base * dim * c.coh * both * (c === zoomed ? 1 - 0.25 * zk : 1)
          ctx.stroke()
        }
        ctx.fillStyle = color
        for (const dot of c.members) {
          if (dot.al < 0.03) continue
          ctx.beginPath()
          ctx.arc(dot.x, dot.y, (1.5 + dot.seed * 0.9 + (dot.hub ? 1.2 : 0) + 0.5 * glowing) * ks, 0, TAU)
          ctx.globalAlpha = (0.6 + 0.35 * glowing) * base * dim * dot.al * (c === zoomed ? 1 - 0.2 * zk : 1)
          ctx.fill()
        }
        if (glowing < 0.02 || !c.on || zoomed) continue
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
      fade = Math.min(1, fade + dt / 1.5)
      if (!zoomed && days.length > 1 && clock - dayAt > CYCLE) nextDay()
      step(dt)
      render()
      go()
    }
    function go () { if (!raf && visible && !document.hidden && !still() && canvas.isConnected) { last = performance.now(); raf = requestAnimationFrame(frame) } }
    function halt () { if (raf) cancelAnimationFrame(raf); raf = 0 }
    function nextDay () {
      dayPtr = (dayPtr + 1) % days.length
      dayAt = clock
      focus = null
      hideTip()
      assign(days[dayPtr], false)
    }

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
    function hideTip () { UI.hideTooltip(); document.querySelector('.tooltip')?.classList.remove('is-field') }
    function unfocus () {
      if (!focus || zoomed) return
      focus = null
      hideTip()
      section.classList.remove('is-field-hover')
      if (still()) { snap(); render() }
    }
    // The web under a point of the hero, the nearest if several.
    function hitAt (x, y) {
      let best = null
      for (const c of clusters) {
        if (!c.on) continue
        const dist = Math.hypot(c.x - x, c.y - y)
        if (dist < c.r + 14 && (!best || dist < best.dist)) best = { dist, c }
      }
      return best ? best.c : null
    }
    function onMove (e) {
      if (e.pointerType === 'touch' || !pointerFine.matches) return
      const box = section.getBoundingClientRect()
      pointer.x = e.clientX - box.left
      pointer.y = e.clientY - box.top
      pointer.on = !still()
      if (zoomed) return
      if (!wide || e.target.closest(INTERACTIVE)) return unfocus()
      const c = hitAt(pointer.x, pointer.y)
      if (!c) return unfocus()
      if (focus !== c) { focus = c; section.classList.add('is-field-hover'); if (still()) { snap(); render() } }
      showTip(box, focus)
    }
    // A click on a web zooms in on it. Zoomed, a click outside the web zooms out; a click on the web does nothing.
    function onClick (e) {
      if (!wide || e.target.closest(INTERACTIVE)) return
      const box = section.getBoundingClientRect()
      const x = e.clientX - box.left
      const y = e.clientY - box.top
      if (zoomed) {
        const v = view()
        if (zt && Math.hypot(x - v.Tx, y - v.Ty) > (zoomed.r - 10) * v.S + 24) zoomOut()
        return
      }
      const c = hitAt(x, y)
      if (c) zoomIn(c)
    }
    function onKey (e) { if (e.key === 'Escape') zoomOut() }
    function showTip (box, c) {
      const topic = c.issue >= 0 ? home.issues[c.issue] : null
      UI.showTooltip({
        title: name(c.s),
        rows: [topic ? { label: t('home.field.topic'), value: name(topic), color: c.slot >= 0 ? colorOf(c.slot) : null } : null, { label: t('home.field.articles'), value: fmt.int(c.n) }].filter(Boolean),
        note: fmt.date(home.dates[c.d], { weekday: 'long', day: 'numeric', month: 'long' })
      }, box.left + c.x, box.top + c.y - c.r - 14)
      // The shared tooltip sits above the point and flips under it when there is no room, which would cover the web: then it goes under the web.
      const tip = document.querySelector('.tooltip')
      tip?.classList.add('is-field')
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
      hideTip()
      caption.remove()
      document.removeEventListener('keydown', onKey)
    }
    function onVisible () { if (document.hidden) halt(); else go() }
    // The first frames: the dots start all over the hero and gather into their webs over a few seconds.
    function begin () {
      placeAll()
      assign(days[dayPtr], true)
      for (const dot of dots) { scatter(dot); dot.wait = 0.2 + Math.random() * 1.8; dot.g = 0 }
    }
    function onCalm () { if (still()) { halt(); snap(); fade = 1; render() } else { begin(); go() } }
    function attach () {
      section = canvas.parentElement
      if (!section || !days.length) return
      measure()
      begin()
      if (still()) { snap(); fade = 1; render() } else go()
      section.append(caption)
      io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) go(); else { halt(); zoomOut(true) } })
      io.observe(section)
      ro = new ResizeObserver(() => {
        if (!canvas.isConnected) return teardown()
        measure()
        placeAll()
        assign(days[dayPtr], true)
        for (const dot of dots) { dot.x = clamp(dot.x, 0, w); dot.y = clamp(dot.y, 0, ht) }
        if (still()) { snap(); render() }
      })
      ro.observe(section)
      document.addEventListener('visibilitychange', onVisible)
      calm.addEventListener('change', onCalm)
      section.addEventListener('pointermove', onMove)
      section.addEventListener('pointerleave', onLeave)
      section.addEventListener('click', onClick)
      document.addEventListener('keydown', onKey)
    }
    requestAnimationFrame(() => { if (canvas.isConnected) attach() })
    return canvas
  }

  window.HeroField = { create }
})()
