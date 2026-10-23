// Shared charts of the sections Πολιτική and Κόσμος. Load after dash.js.
(function () {
  const { t, fmt, h } = window.App
  const { fit, niceStep } = window.Dash

  const tip = (el, text) => {
    el.addEventListener('pointermove', (e) => UI.showTooltip(typeof text === 'function' ? text() : text, e.clientX, e.clientY))
    el.addEventListener('pointerleave', () => UI.hideTooltip())
    return el
  }

  // Short label of a week. The first and the last week of the window can be partial, so the label gives the real days.
  function weekLabel (week, window) {
    const from = week < window[0] ? window[0] : week
    const end = new Date(`${week}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 6)
    const toIso = end.toISOString().slice(0, 10)
    const to = toIso > window[1] ? window[1] : toIso
    const day = (iso) => fmt.date(iso, { day: 'numeric', month: 'short' })
    return { short: day(from), long: `${day(from)} – ${day(to)}` }
  }

  // Lines on one axis. Each series has a color and a label at its end. The hover line gives all values of one point.
  function LineChart ({ labels, tips, series, height = 240, yFormat = fmt.dec, min, max, zero = false, aria }) {
    return fit((holder, width) => {
      const pad = { top: 14, right: 96, bottom: 28, left: 40 }
      const all = series.flatMap((s) => s.values).filter((v) => v !== null)
      let lo = min ?? Math.min(...all, zero ? 0 : Infinity)
      let hi = max ?? Math.max(...all, zero ? 0 : -Infinity)
      if (lo === hi) { lo -= 1; hi += 1 }
      const step = niceStep((hi - lo) / 4)
      lo = Math.floor(lo / step) * step
      hi = Math.ceil(hi / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const x = (i) => pad.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW)
      const y = (v) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': aria })
      for (let v = lo; v <= hi + step / 2; v += step) {
        svg.append(h('line', { class: v === 0 && lo < 0 ? 'zero-line' : 'grid-line', x1: pad.left, x2: pad.left + plotW, y1: y(v), y2: y(v) }), h('text', { x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, yFormat(v)))
      }
      const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 64))))
      labels.forEach((l, i) => { if (i % every === 0 || i === labels.length - 1) svg.append(h('text', { x: x(i), y: height - 8, 'text-anchor': 'middle' }, l)) })
      const ends = []
      series.forEach((s) => {
        const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)]))
        let d = ''
        pts.forEach((p, i) => { if (p) d += `${d && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}` })
        svg.append(h('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-dasharray': s.dash || null }))
        pts.forEach((p) => { if (p && s.dots !== false) svg.append(h('circle', { cx: p[0], cy: p[1], r: 3, fill: s.color, stroke: '#ffffff', 'stroke-width': 1.5 })) })
        const last = pts.map((p, i) => [p, i]).filter(([p]) => p).pop()
        if (last) ends.push({ y: last[0][1], label: s.label, color: s.color })
      })
      // The end labels do not overlap: each label moves down to 13 px below the label above it.
      ends.sort((a, b) => a.y - b.y).forEach((e, i, arr) => { if (i && e.y - arr[i - 1].y < 13) e.y = arr[i - 1].y + 13 })
      ends.forEach((e) => svg.append(h('text', { class: 'line-end', x: pad.left + plotW + 8, y: e.y + 4, fill: 'var(--text-primary)' }, e.label)))
      const guide = h('line', { class: 'range-line', x1: 0, x2: 0, y1: pad.top, y2: pad.top + plotH, visibility: 'hidden' })
      svg.append(guide)
      const hit = h('rect', { class: 'hit', x: pad.left, y: pad.top, width: plotW, height: plotH })
      hit.addEventListener('pointermove', (e) => {
        const box = svg.getBoundingClientRect()
        const i = Math.max(0, Math.min(labels.length - 1, Math.round(((e.clientX - box.left - pad.left) / plotW) * (labels.length - 1))))
        guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('visibility', 'visible')
        UI.showTooltip([tips ? tips[i] : labels[i], ...series.map((s) => `${s.label}: ${s.values[i] === null ? '–' : yFormat(s.values[i])}`)].join(' · '), e.clientX, e.clientY)
      })
      hit.addEventListener('pointerleave', () => { guide.setAttribute('visibility', 'hidden'); UI.hideTooltip() })
      svg.append(hit)
      holder.replaceChildren(svg)
    })
  }

  // Critical, neutral and sympathetic shares in one UI.StackedBar. The text alternative gives the three shares.
  function ToneBar (tone, { labels = ['politics.tone.critical', 'politics.tone.neutral', 'politics.tone.sympathetic'], colors = UI.STANCE_COLORS } = {}) {
    return UI.StackedBar([tone.critical, tone.neutral, tone.sympathetic].map((v, i) => ({ label: t(labels[i]), value: v || 0, color: colors[i] })), { legend: false })
  }

  // Two values for one measure, one for each side: a title, then a UI.BarList with a row for each side in the color of the side.
  // rows: [{ label, note, a: { value, text, sub }, b: { ... } }].
  function PairRows (rows, { names, colors = ['var(--side-a)', 'var(--side-b)'], max } = {}) {
    return h('div', { class: 'pairs' }, rows.map((r) => h('div', { class: 'pair' },
      r.label ? h('h3', { class: 'pair-title' }, r.label) : null, r.note ? h('p', { class: 'pair-note' }, r.note) : null,
      UI.BarList([r.a, r.b].map((side, i) => ({ label: names[i], sub: side.sub, value: side.value, text: side.text, color: colors[i] })), { max: max ?? Math.max(r.a.value, r.b.value, 1) }))))
  }

  // A cell color for a value from -1 to +1: red below zero and blue above zero, white at zero.
  function divergeCell (v) {
    if (v === null || v === undefined) return { background: 'transparent', color: 'var(--text-secondary)' }
    const k = Math.min(1, Math.abs(v) / 0.6)
    const base = v < 0 ? [194, 59, 59] : [42, 98, 196]
    const mix = base.map((c) => Math.round(255 - (255 - c) * k * 0.85))
    return { background: `rgb(${mix.join(',')})`, color: k > 0.6 ? '#ffffff' : 'var(--text-primary)' }
  }

  // A signed number with a real minus sign. Numbers always use the Greek style (C12).
  const signed = (v, digits = 2) => (v === null || v === undefined ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('el-GR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v))}`)
  // A share that the data gives in percent (0 to 100), with no decimals.
  const pctOf = (v) => `${new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(v)}%`
  // A name from English data: the Greek message if one exists, else the name of the data.
  const dataName = (prefix, name) => (window.App.locale === 'el' ? window.MESSAGES.el[`${prefix}.${name}`] ?? name : name)

  window.Politics = { weekLabel, LineChart, ToneBar, PairRows, divergeCell, signed, pctOf, dataName, tip }
})()
