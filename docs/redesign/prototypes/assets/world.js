// Shared parts of the report pages of Αναλύσεις: Ο πόλεμος της αφήγησης, Μία είδηση πολλές εκδοχές and Γαλλία (#36, #37, #38).
// Load after politics.js.
(function () {
  const { fmt, h } = window.App
  const { fit } = window.Dash
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

  window.World = { dec1, el, Verdict, Chips, TimeStrip }
})()
