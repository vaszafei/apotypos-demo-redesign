// Cards that the page of an outlet and the page of a group share: the daily columns and the difference bars. Load after dash.js and spread.js.
(function () {
  const { t, fmt, h } = window.App
  const { fit, niceStep } = window.Dash

  // A row of the difference view. The center line is the share in all outlets. The bar goes right (teal) when the outlet has more, left (orange) when it has less.
  function DiffRow ({ label, value, usual, scale, tipKey = 'outlet2.how.tip' }) {
    const diff = value - usual
    const tip = t(tipKey, { label, value: fmt.pct(value), usual: fmt.pct(usual), diff: `${diff >= 0 ? '+' : '−'}${fmt.pct(Math.abs(diff))}` })
    return h('li', { title: tip }, h('span', { class: 'div-name' }, label), h('span', { class: 'div-num' }, fmt.pct(value)), Spread.DiffTrack(diff, scale, tip))
  }
  const scaleOf = (rows) => Math.max(0.05, ...rows.map((r) => Math.abs(r.value - r.usual)))

  // Thin columns with a round top, one for each day. stacks[i] is the parts of day i from the bottom to the top: { name, v, fill }. A day with no articles has no column.
  function DailyChart ({ dates, stacks }) {
    const days = stacks.length
    const totals = stacks.map((parts) => parts.reduce((a, p) => a + p.v, 0))
    return fit((holder, width) => {
      const height = 190
      const pad = { top: 8, right: 4, bottom: 34, left: 40 }
      const max = Math.max(...totals, 1)
      const step = niceStep(max / 4)
      const top = Math.ceil(max / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const bw = plotW / days
      const y = (v) => pad.top + plotH - (v / top) * plotH
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' })
      for (let v = 0; v <= top; v += step) {
        svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }), h('text', { x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmt.int(v)))
      }
      const every = Math.max(1, Math.ceil(18 / bw))
      const w = Math.min(10, Math.max(2, bw * 0.6))
      stacks.forEach((all, i) => {
        const bx = pad.left + i * bw + (bw - w) / 2
        const parts = all.filter((p) => p.v > 0)
        let base = pad.top + plotH
        parts.forEach((p, k) => {
          const hgt = (p.v / top) * plotH
          const attrs = { fill: p.fill, stroke: '#ffffff', 'stroke-width': 0.5 }
          svg.append(k === parts.length - 1 ? h('path', { ...attrs, d: Spread.topRound(bx, base - hgt, w, hgt, 4) }) : h('rect', { ...attrs, x: bx, y: base - hgt, width: w, height: hgt }))
          base -= hgt
        })
        if (i % every === 0) {
          const date = dates[i]
          svg.append(h('text', { x: bx + w / 2, y: height - 18, 'text-anchor': 'middle' }, String(Number(date.slice(8)))))
          if (i === 0 || date.endsWith('-01')) svg.append(h('text', { class: 'axis-month', x: bx + w / 2, y: height - 4, 'text-anchor': 'middle' }, fmt.date(date, { month: 'short' })))
        }
      })
      const overlay = h('rect', { class: 'overlay', x: pad.left, y: pad.top, width: plotW, height: plotH })
      overlay.addEventListener('pointermove', (e) => {
        const i = Math.min(days - 1, Math.max(0, Math.floor((e.clientX - svg.getBoundingClientRect().left - pad.left) / bw)))
        const list = stacks[i].filter((p) => p.v > 0).reverse().map((p) => `${p.name} ${fmt.int(p.v)}`).join(' · ')
        UI.showTooltip(`${t('story.daily.tip', { date: fmt.date(dates[i]), n: fmt.int(totals[i]) })}${list ? `: ${list}` : ''}`, e.clientX, e.clientY)
      })
      overlay.addEventListener('pointerleave', () => UI.hideTooltip())
      svg.append(overlay)
      const table = h('div', { class: 'visually-hidden' }, h('table', {}, h('caption', {}, t('outlet2.daily.aria')),
        h('tbody', {}, totals.map((v, i) => h('tr', {}, h('th', { scope: 'row' }, fmt.date(dates[i])), h('td', {}, fmt.int(v)))))))
      holder.replaceChildren(svg, table)
    })
  }

  // The card of the daily columns with a switch for the color of the columns: news (the analysed articles) or topics (the articles in stories).
  // daily[i] is [analysed, news] for day i. topicDays maps the index of an issue to its articles per day. The 8 largest topics have a color, the others are one gray part.
  const TOP_TOPICS = 8
  function DailyCard ({ dates, daily, topicDays, issues, info }) {
    const { card, cardHead, SLOTS, NO_GROUP } = window.Dash
    const name = (x) => x[window.App.locale] || x.el
    const ranked = [...topicDays].map(([issue, values]) => ({ issue, values, total: values.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total)
    const lead = ranked.filter((r) => !issues[r.issue].catchAll).slice(0, TOP_TOPICS)
    const rest = ranked.filter((r) => !lead.includes(r))
    const series = lead.map((r, k) => ({ name: name(issues[r.issue]), fill: SLOTS[k], values: r.values }))
    if (rest.length) series.push({ name: t('outlet2.daily.topic.rest'), fill: NO_GROUP, values: dates.map((_, i) => rest.reduce((a, r) => a + r.values[i], 0)) })
    const modes = {
      news: {
        stacks: daily.map(([total, news]) => [{ name: t('outlet2.daily.news'), v: news, fill: 'var(--series-news)' }, { name: t('outlet2.daily.other'), v: total - news, fill: 'var(--series-other)' }]),
        key: [{ name: t('outlet2.daily.news'), fill: 'var(--series-news)' }, { name: t('outlet2.daily.other'), fill: 'var(--series-other)' }]
      },
      topic: { stacks: dates.map((_, i) => series.map((x) => ({ name: x.name, v: x.values[i], fill: x.fill }))), key: series }
    }
    let mode = 'news'
    const body = h('div', {})
    const tools = h('div', {})
    const draw = () => {
      const m = modes[mode]
      body.replaceChildren(DailyChart({ dates, stacks: m.stacks }),
        h('ul', { class: 'legend-inline legend-wrap' }, m.key.map((x) => h('li', {}, h('span', { class: 'swatch', style: { background: x.fill } }), x.name))))
      tools.replaceChildren(UI.SegmentedControl({ label: t('outlet2.daily.mode'), value: mode, onChange: (v) => { mode = v; draw() },
        options: [{ value: 'news', label: t('outlet2.daily.mode.news') }, { value: 'topic', label: t('outlet2.daily.mode.topic') }] }))
    }
    draw()
    return card('c-12', cardHead(t('outlet2.daily.title'), tools, info), body)
  }

  // The key of the difference bars: teal is more than usual, orange is less.
  const diffKey = () => h('span', { class: 'legend-inline' },
    h('span', {}, h('span', { class: 'swatch', style: { background: 'var(--emph-more)' } }), t('story.how.more')),
    h('span', {}, h('span', { class: 'swatch', style: { background: 'var(--emph-less)' } }), t('story.how.less')))

  window.Entity = { DiffRow, scaleOf, DailyChart, DailyCard, diffKey }
})()
