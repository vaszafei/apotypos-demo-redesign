// Cards that the entity pages (topic, story, outlet, group) share: the title card, the daily columns, the difference bars, the stance card and the groups card. Load after dash.js and spread.js.
(function () {
  const { t, fmt, h } = window.App

  // A row of the difference view, for UI.BarList. The center line is the share in all outlets. The bar goes right (teal) when the outlet has more, left (orange) when it has less.
  function DiffRow ({ label, value, usual, scale, tipKey = 'outlet2.how.tip' }) {
    const diff = value - usual
    const tip = t(tipKey, { label: typeof label === 'string' ? label : label.textContent, value: fmt.pct(value), usual: fmt.pct(usual), diff: `${diff >= 0 ? '+' : '−'}${fmt.pct(Math.abs(diff))}` })
    return { label, text: fmt.pct(value), bar: Spread.DiffTrack(diff, scale, tip) }
  }
  const scaleOf = (rows) => Math.max(0.05, ...rows.map((r) => Math.abs(r.value - r.usual)))

  // The daily columns of Ιδιοκτησία (UI.BarChart). series: [{ name, color, values }], from the bottom to the top.
  function DailyChart ({ dates, series, height = 220 }) {
    const totals = dates.map((_, i) => series.reduce((a, x) => a + (x.values[i] || 0), 0))
    return UI.BarChart({
      dates, series, height, label: t('outlet2.daily.aria'),
      tooltipOf: (i) => { const list = series.filter((x) => x.values[i] > 0).reverse().map((x) => `${x.name} ${fmt.int(x.values[i])}`).join(' · '); return `${t('story.daily.tip', { date: fmt.date(dates[i]), n: fmt.int(totals[i]) })}${list ? `: ${list}` : ''}` }
    })
  }

  // The card of the daily columns with a switch for the color of the columns: news (the analysed articles) or topics (the articles in stories).
  // daily[i] is [analysed, news] for day i. topicDays maps the index of an issue to its articles per day. The 8 largest topics have a color, the others are one gray part.
  const TOP_TOPICS = 8
  function DailyCard ({ dates, daily, topicDays, issues, info, topics = true, height }) {
    const { card, cardHead, SLOTS, NO_GROUP } = window.Dash
    const name = (x) => x[window.App.locale] || x.el
    const ranked = [...topicDays].map(([issue, values]) => ({ issue, values, total: values.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total)
    const lead = ranked.filter((r) => !issues[r.issue].catchAll).slice(0, TOP_TOPICS)
    const rest = ranked.filter((r) => !lead.includes(r))
    const series = lead.map((r, k) => ({ name: name(issues[r.issue]), color: SLOTS[k], values: r.values }))
    if (rest.length) series.push({ name: t('outlet2.daily.topic.rest'), color: NO_GROUP, values: dates.map((_, i) => rest.reduce((a, r) => a + r.values[i], 0)) })
    const modes = {
      news: [{ name: t('outlet2.daily.news'), color: 'var(--series-news)', values: daily.map(([, news]) => news) }, { name: t('outlet2.daily.other'), color: 'var(--series-other)', values: daily.map(([total, news]) => total - news) }],
      topic: series
    }
    let mode = 'news'
    const body = h('div', {})
    const tools = h('div', {})
    const draw = () => {
      const m = modes[mode]
      body.replaceChildren(DailyChart({ dates, series: m, height }), UI.Legend(m.map((x) => ({ label: x.name, color: x.color }))))
      if (topics) tools.replaceChildren(UI.SegmentedControl({ label: t('outlet2.daily.mode'), value: mode, onChange: (v) => { mode = v; draw() },
        options: [{ value: 'news', label: t('outlet2.daily.mode.news') }, { value: 'topic', label: t('outlet2.daily.mode.topic') }] }))
    }
    draw()
    return card('c-12', cardHead(t('outlet2.daily.title'), tools, info), body)
  }

  // The key of the difference bars: teal is more than usual, orange is less.
  const diffKey = () => UI.Legend([{ label: t('story.how.more'), color: 'var(--emph-more)' }, { label: t('story.how.less'), color: 'var(--emph-less)' }])


  // The title card: the kind and the name, the period once on the right, and one line of facts under them. The card is as wide as its content.
  // facts: { label, value, sub, spark } where spark is an svg from Dash.Spark.
  function TitleCard ({ kind, title, meta, facts }) {
    const { card } = window.Dash
    return card('c-12 ecard',
      h('div', { class: 'ecard-head' }, h('div', { class: 'ecard-name' }, h('span', { class: 'hero-kicker' }, kind), h('h1', { class: 'hero-title' }, title)),
        meta ? h('p', { class: 'ecard-meta' }, meta) : null),
      h('dl', { class: 'ecard-facts' }, facts.filter(Boolean).map((f) => h('div', { class: 'ecard-fact' },
        h('dt', {}, f.label), h('dd', {}, h('strong', {}, f.value), f.sub ? h('span', { class: 'ecard-sub' }, f.sub) : null, f.spark || null)))))
  }

  // The stance card of Ιδιοκτησία: the neutral share in the center, the critical share to the left, the supportive share to the right.
  // rows: { label, color, counts: [critical, neutral, supportive] }. A row needs 30 articles with a stance.
  function StanceCard ({ rows, foot, cls = 'c-4' }) {
    const { card, cardHead } = window.Dash
    const shown = rows.map((r) => {
      const n = r.counts[0] + r.counts[1] + r.counts[2]
      return { ...r, n, crit: n ? r.counts[0] / n : 0, neu: n ? r.counts[1] / n : 0, sup: n ? r.counts[2] / n : 0 }
    }).filter((r) => r.n >= 30)
    const head = cardHead(t('entity.stance.title'), null, t('entity.stance.info'))
    if (shown.length < 2) return card(cls, head, h('p', { class: 'dcard-empty' }, t('entity.stance.none')))
    const scale = Math.max(...shown.map((r) => Math.max(r.crit + r.neu / 2, r.sup + r.neu / 2)))
    return card(cls, head,
      UI.Legend(['critical', 'neutral', 'supportive'].map((nm, i) => ({ label: t(`stance.${nm}`), color: UI.STANCE_COLORS[i] }))),
      UI.BarList(shown.map((r) => ({
        label: [h('span', { class: 'dot', style: `--dot:${r.color}`, 'aria-hidden': 'true' }), r.label],
        text: `${fmt.pct(r.crit)} · ${fmt.pct(r.sup)}`,
        bar: UI.DivergingBar({ left: r.crit, middle: r.neu, right: r.sup, scale, label: t('g2.stance.row', { group: r.label, critical: fmt.pct(r.crit), neutral: fmt.pct(r.neu), supportive: fmt.pct(r.sup), n: fmt.int(r.n) }) })
      }))),
      foot ? h('p', { class: 'dcard-sub' }, foot) : null)
  }

  // The sunburst of Άρθρα ανά όμιλο (Ιδιοκτησία): the groups inside, their outlets outside, from the top, clockwise.
  // groups: { key, label, color, value, outlets: [{ name, value }] }.
  function Sunburst ({ groups, total }) {
    const { tint } = window.Dash
    const size = 176
    const c = size / 2
    const rings = [[44, 65], [67, 87]]
    const pad = 0.008
    const arc = (a0, a1, r0, r1) => {
      a0 += pad / 2
      a1 = Math.max(a0 + 0.002, a1 - pad / 2)
      const p = (a, r) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
      const large = a1 - a0 > Math.PI ? 1 : 0
      return `M${p(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`
    }
    const tipOn = (el, text) => {
      const show = (e) => UI.showTooltip(text, e.clientX, e.clientY)
      el.addEventListener('pointerenter', show)
      el.addEventListener('pointermove', show)
      el.addEventListener('pointerleave', () => UI.hideTooltip())
      return el
    }
    const svg = h('svg', { class: 'chart donut sunburst', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': groups.map((g) => `${g.label} ${fmt.pct(g.value / total)}`).join(', ') })
    let a = 0
    groups.forEach((g) => {
      const span = (g.value / total) * 2 * Math.PI
      svg.append(tipOn(h('path', { class: 'slice', d: arc(a, a + span, ...rings[0]), fill: g.color }), t('g2.donut.tip', { group: g.label, n: fmt.int(g.value), share: fmt.pct(g.value / total) })))
      let b = a
      g.outlets.forEach((o) => {
        const s = (o.value / total) * 2 * Math.PI
        svg.append(tipOn(h('path', { class: 'slice', d: arc(b, b + s, ...rings[1]), fill: tint(g.color, g.key === null ? 0.45 : 0.4) }), t('g2.tree.tip', { outlet: o.name, group: g.label, n: fmt.int(o.value), share: fmt.pct(o.value / total) })))
        b += s
      })
      a += span
    })
    svg.append(h('text', { class: 'donut-num', x: c, y: c + 3, 'text-anchor': 'middle' }, fmt.int(total)),
      h('text', { x: c, y: c + 19, 'text-anchor': 'middle' }, t('g2.donut.center')))
    return svg
  }

  // The card of Άρθρα ανά όμιλο: the groups with their outlets under each name on the left, the sunburst on the right.
  function GroupsCard ({ title, info, groups, total, cls = 'c-6' }) {
    const { card, cardHead } = window.Dash
    return card(cls, cardHead(title, null, info), h('div', { class: 'donut-wrap sun-wrap' },
      h('ul', { class: 'rows rows-groups rows-owners' }, groups.map((g) => h('li', {},
        h('span', { class: g.key === null ? 'dot dot-none' : 'dot', style: `--dot:${g.color}`, 'aria-hidden': 'true' }),
        h('span', { class: 'row-name' }, g.link || g.label),
        h('span', { class: 'row-value' }, fmt.pct(g.value / total)),
        g.sub ? h('span', { class: 'row-sub' }, g.sub) : null))),
      Sunburst({ groups, total })))
  }

  window.Entity = { DiffRow, scaleOf, DailyChart, DailyCard, diffKey, TitleCard, StanceCard, GroupsCard }
})()
