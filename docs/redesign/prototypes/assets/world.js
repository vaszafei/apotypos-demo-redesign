// Shared parts of the report pages of Αναλύσεις: Ο πόλεμος της αφήγησης, Μία είδηση πολλές εκδοχές and Γαλλία (#36, #37, #38).
// Load after politics.js.
(function () {
  const { fmt, h } = window.App
  const { fit, niceStep } = window.Dash
  const { tip } = window.Politics

  // A share in percent with one decimal, in the Greek style: 8.9 gives "8,9".
  const dec1 = (v) => new Intl.NumberFormat('el-GR', { maximumFractionDigits: 1 }).format(v)
  // A text of the data in the active language. The data gives a string, or a pair [Greek, English].
  const el = (x) => (Array.isArray(x) ? (window.App.locale === 'en' && x[1] ? x[1] : x[0]) : x ?? '')

  // A verdict pill. The four verdicts use the status colors: ok, over (exaggeration), open, no (does not stand).
  const Verdict = (status, label) => h('span', { class: 'verdict', 'data-status': status }, label)

  // Outlet chips: a name and an optional count.
  const Chips = (items, cls = '') => h('ul', { class: `chips ${cls}` }, items.map((x) => h('li', { class: 'chip', style: x.color ? `--chip:${x.color}` : null },
    x.color ? h('span', { class: 'dot', style: `--dot:${x.color}` }) : null, x.label, x.n ? h('strong', {}, String(x.n)) : null)))

  // A rect with rounded top corners only.
  function topRounded (x, y, w, hgt, r) {
    r = Math.max(0, Math.min(r, w / 2, hgt))
    return `M${x} ${y + hgt}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hgt}Z`
  }

  // Stacked columns. The top of each column is round. A click on a column picks it.
  // series: [{ color, values }], bottom first. top: a small text above each column. below: a second line of label, in HTML, so it can wrap.
  function StackColumns ({ labels, below, top, series, tips, picked, onPick, yFormat = fmt.int, height = 240, aria, minWidth = 0 }) {
    const wrap = h('div', { class: 'stack-cols', style: minWidth ? `min-width:${minWidth}px` : null })
    const chart = fit((holder, width) => {
      const pad = { top: top ? 24 : 12, right: 4, bottom: 22, left: 36 }
      const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0))
      const step = niceStep(Math.max(...totals, 1) / 4)
      const hi = Math.ceil(Math.max(...totals, 1) / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const bw = plotW / labels.length
      const gap = Math.min(14, bw * 0.3)
      const y = (v) => pad.top + plotH - (v / hi) * plotH
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': aria })
      for (let v = 0; v <= hi + step / 2; v += step) svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: pad.left + plotW, y1: y(v), y2: y(v) }), h('text', { x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, yFormat(v)))
      const groups = labels.map((label, i) => {
        const bx = pad.left + i * bw + gap / 2
        const w = Math.max(2, bw - gap)
        const g = h('g', { class: `col-group${picked && picked() === i ? ' is-picked' : ''}` })
        let base = 0
        const last = series.map((s, k) => (s.values[i] ? k : -1)).reduce((a, b) => Math.max(a, b), -1)
        series.forEach((s, k) => {
          const v = s.values[i] || 0
          if (!v) return
          const y0 = y(base + v)
          const hgt = y(base) - y0
          g.append(k === last ? h('path', { d: topRounded(bx, y0, w, hgt, 5), fill: s.color }) : h('rect', { x: bx, y: y0, width: w, height: Math.max(0, hgt - 1), fill: s.color }))
          base += v
        })
        if (top && top[i]) g.append(h('text', { class: 'pt-label', x: bx + w / 2, y: y(totals[i]) - 6, 'text-anchor': 'middle' }, top[i]))
        g.append(h('text', { x: bx + w / 2, y: pad.top + plotH + 16, 'text-anchor': 'middle' }, label))
        const hit = tip(h('rect', { class: 'hit', x: pad.left + i * bw, y: pad.top, width: bw, height: plotH + pad.bottom }), tips ? tips[i] : label)
        if (onPick) {
          hit.style.cursor = 'pointer'
          hit.addEventListener('click', () => { groups.forEach((x, j) => x.classList.toggle('is-picked', j === i)); onPick(i) })
        }
        g.append(hit)
        svg.append(g)
        return g
      })
      holder.replaceChildren(svg)
      if (below) {
        const row = h('div', { class: 'stack-below', style: `padding-left:${pad.left}px;padding-right:${pad.right}px;grid-template-columns:repeat(${labels.length},minmax(0,1fr))` },
          below.map((b) => h('span', {}, b)))
        holder.append(row)
      }
    })
    wrap.append(chart)
    return wrap
  }

  // A time strip from one date to another: small gray dots for the moments, numbered black circles for the cases.
  // The circles move apart so they do not touch.
  function TimeStrip ({ from, to, moments, cases, labels }) {
    const t0 = Date.parse(from)
    const t1 = Date.parse(to)
    return fit((holder, width) => {
      const pad = 16
      const x = (d) => pad + ((Date.parse(d) - t0) / (t1 - t0)) * (width - 2 * pad)
      const hgt = 64
      const mid = 30
      const svg = h('svg', { class: 'chart time-strip', width, height: hgt, viewBox: `0 0 ${width} ${hgt}`, role: 'img', 'aria-label': `${labels.case}: ${cases.length}` })
      svg.append(h('line', { class: 'strip-line', x1: pad, x2: width - pad, y1: mid, y2: mid }))
      for (let year = new Date(t0).getUTCFullYear(); year <= new Date(t1).getUTCFullYear(); year++) {
        const yx = x(`${year}-01-01`)
        svg.append(h('line', { class: 'grid-line', x1: yx, x2: yx, y1: mid - 6, y2: mid + 6 }), h('text', { x: Math.max(yx + 4, pad), y: hgt - 6 }, String(year)))
      }
      moments.forEach((m) => svg.append(tip(h('circle', { class: 'strip-moment', cx: x(m.date), cy: mid, r: 4 }), `${labels.moment}: ${m.label}`)))
      const placed = cases.map((c) => ({ ...c, cx: x(c.date) })).sort((a, b) => a.cx - b.cx)
      placed.forEach((c, i) => { if (i && c.cx - placed[i - 1].cx < 22) c.cx = placed[i - 1].cx + 22 })
      const over = placed.length ? placed[placed.length - 1].cx - (width - pad) : 0
      if (over > 0) placed.forEach((c) => { c.cx -= over })
      placed.forEach((c) => svg.append(tip(h('g', { class: 'strip-case' }, h('circle', { cx: c.cx, cy: mid, r: 10 }), h('text', { x: c.cx, y: mid + 4, 'text-anchor': 'middle' }, String(c.n))), `${labels.case} ${c.n}: ${c.label} · ${fmt.date(c.date)}`)))
      holder.replaceChildren(svg)
    })
  }

  window.World = { dec1, el, Verdict, Chips, StackColumns, TimeStrip, topRounded }
})()
