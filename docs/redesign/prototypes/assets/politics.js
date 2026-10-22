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

  // Columns with an optional dark part at the base (for example the articles with a threat frame inside all articles).
  // marks: a number in a circle above a column. top: a small text above a column.
  function ColumnChart ({ labels, values, part, tips, top, marks = {}, height = 220, aria, color = 'var(--series-news)', partColor = 'var(--stance-critical)', below }) {
    return fit((holder, width) => {
      const pad = { top: Object.keys(marks).length ? 44 : 26, right: 8, bottom: below ? 44 : 26, left: 40 }
      const maxV = Math.max(...values, 1)
      const step = niceStep(maxV / 4)
      const hi = Math.ceil(maxV / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const bw = plotW / values.length
      const y = (v) => pad.top + plotH - (v / hi) * plotH
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': aria })
      for (let v = 0; v <= hi; v += step) svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: pad.left + plotW, y1: y(v), y2: y(v) }), h('text', { x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmt.int(v)))
      const gap = Math.min(10, bw * 0.25)
      const every = Math.max(1, Math.ceil(values.length / Math.max(2, Math.floor(plotW / 56))))
      values.forEach((v, i) => {
        const bx = pad.left + i * bw + gap / 2
        const w = Math.max(1, bw - gap)
        if (v) svg.append(h('rect', { x: bx, y: y(v), width: w, height: pad.top + plotH - y(v), rx: Math.min(3, w / 2), fill: part ? 'var(--bar-muted)' : color }))
        if (part && part[i]) svg.append(h('rect', { x: bx, y: y(part[i]), width: w, height: pad.top + plotH - y(part[i]) - (part[i] === v ? 0 : 0), rx: Math.min(3, w / 2), fill: partColor }))
        if (top && top[i]) svg.append(h('text', { class: 'pt-label', x: bx + w / 2, y: y(v) - 6, 'text-anchor': 'middle' }, top[i]))
        if (marks[i]) {
          const cy = y(v) - (top && top[i] ? 30 : 12)
          svg.append(h('circle', { cx: bx + w / 2, cy, r: 8, fill: '#1f1f1f' }), h('text', { x: bx + w / 2, y: cy + 3.5, 'text-anchor': 'middle', fill: '#ffffff', 'font-size': 10 }, String(marks[i])))
        }
        if (i % every === 0) svg.append(h('text', { x: bx + w / 2, y: pad.top + plotH + 16, 'text-anchor': 'middle' }, labels[i]))
        if (below && below[i] !== undefined) svg.append(h('text', { class: 'below-label', x: bx + w / 2, y: pad.top + plotH + 34, 'text-anchor': 'middle' }, below[i]))
        svg.append(tip(h('rect', { class: 'hit', x: pad.left + i * bw, y: pad.top, width: bw, height: plotH }), tips ? tips[i] : `${labels[i]} · ${fmt.int(v)}`))
      })
      holder.replaceChildren(svg)
    })
  }

  // A list of rows: a label, a value and a bar under them. rows: [{ label, value, text, sub, color }].
  function Rows (rows, { max, cls = '' } = {}) {
    const top = max ?? Math.max(...rows.map((r) => r.value), 1)
    return h('ul', { class: `rows ${cls}` }, rows.map((r) => h('li', { style: r.color ? `--bar-color:${r.color}` : null },
      h('span', { class: 'row-name', title: r.label }, r.label, r.sub ? h('span', { class: 'row-sub' }, r.sub) : null),
      h('span', { class: 'row-value' }, r.text ?? fmt.int(r.value)),
      UI.HBar(r.value, top))))
  }

  // Critical, neutral and sympathetic shares in one bar. The text alternative gives the three shares.
  function ToneBar (tone, { labels = ['politics.tone.critical', 'politics.tone.neutral', 'politics.tone.sympathetic'], colors = ['var(--stance-critical)', 'var(--stance-neutral)', 'var(--stance-supportive)'] } = {}) {
    const parts = [tone.critical, tone.neutral, tone.sympathetic]
    const total = parts.reduce((a, b) => a + (b || 0), 0) || 1
    const text = parts.map((p, i) => `${t(labels[i])} ${fmt.pct((p || 0) / total)}`).join(' · ')
    return h('div', { class: 'stack tone-bar', role: 'img', 'aria-label': text, title: text },
      parts.map((p, i) => (p ? h('span', { style: `width:${(p / total) * 100}%;--seg:${colors[i]}` }) : null)))
  }

  // Two bars for one measure: one for each side. rows: [{ label, note, a: { value, text, sub }, b: { ... } }].
  function PairRows (rows, { names, colors = ['var(--side-a)', 'var(--side-b)'], max } = {}) {
    return h('div', { class: 'pairs' }, rows.map((r) => {
      const top = max ?? Math.max(r.a.value, r.b.value, 1)
      const line = (side, i) => h('div', { class: 'pair-line' },
        h('span', { class: 'pair-name' }, h('span', { class: 'dot', style: `--dot:${colors[i]}` }), names[i]),
        h('span', { class: 'pair-track' }, h('span', { class: 'pair-fill', style: `width:${Math.min(1, side.value / top) * 100}%;--seg:${colors[i]}` })),
        h('span', { class: 'pair-val' }, h('strong', {}, side.text)),
        side.sub ? h('span', { class: 'pair-sub' }, side.sub) : null)
      return h('div', { class: 'pair' }, h('h3', { class: 'pair-title' }, r.label), r.note ? h('p', { class: 'pair-note' }, r.note) : null, line(r.a, 0), line(r.b, 1))
    }))
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

  window.Politics = { weekLabel, LineChart, ColumnChart, Rows, ToneBar, PairRows, divergeCell, signed, pctOf, dataName, tip }
})()
