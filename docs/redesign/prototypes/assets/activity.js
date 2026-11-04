// The parts of the activity console: the period controls and figures of Θέματα › Επισκόπηση, and the charts that Μέσα, Πώς γράφουν and Ιστορίες show.
// Load after messages, components, dash and the fixture home. The stories and mme fixtures are needed only by the charts that read them.
(function () {
    Object.assign(window.MESSAGES.el, {
      'act.period': 'Περίοδος', 'act.p30': 'Τελευταίες 30 ημέρες', 'act.p14': 'Τελευταίες 14 ημέρες', 'act.p7': 'Τελευταίες 7 ημέρες', 'act.agenda.all': 'Όλα τα θέματα', 'act.agenda.info': 'Το μερίδιο κάθε θέματος στην ειδησεογραφία του διαστήματος. Το κλικ σε ένα θέμα το ανοίγει στο Θέματα › Ένα θέμα, με όλο το διάστημα της ανάλυσης.', 'act.pall': 'Όλο το διάστημα', 'act.newsonly': 'Μόνο ειδησεογραφία', 'act.k.top': 'Πρώτο θέμα', 'act.evolution': 'Εξέλιξη', 'act.evolution.info': 'Άρθρα του θέματος ανά ημέρα.', 'act.topic.articles': 'Άρθρα', 'act.topic.share': 'Μερίδιο της ατζέντας', 'act.topic.stance': 'Στάση απέναντι στην κυβέρνηση, ανά μέσο', 'act.topic.stance.info': 'Μέσα με 10 ή περισσότερα άρθρα του θέματος που παίρνουν θέση, από τα πιο επικριτικά στα πιο υποστηρικτικά.', 'act.emphasis': 'Ποιος έδωσε έμφαση σε κάθε θέμα', 'act.emphasis.info': 'Επιλέξτε θέμα: τα μέσα ταξινομημένα με βάση το μερίδιο της ειδησεογραφίας τους.', 'act.emphasis.pick': 'Θέμα',
      'act.tab.overview': 'Επισκόπηση', 'act.vs': 'έναντι πριν', 'act.k.articles': 'Άρθρα', 'act.k.stories': 'Νέες ιστορίες', 'act.k.top5': 'Top 5 θέματα', 'act.top.outlets': 'Κορυφαία μέσα', 'act.art': 'άρθρα', 'act.c.type': 'Είδος άρθρων', 'act.c.stories': 'Νέες ιστορίες ανά θέμα', 'act.c.stance': 'Στάση προς την κυβέρνηση', 'act.c.outlets': 'Άρθρα ανά μέσο',
      'act.news': 'Ειδήσεις', 'act.soft': 'Αθλητικά, lifestyle, καιρός', 'act.other': 'Άλλα'
    })
    Object.assign(window.MESSAGES.en, {
      'act.period': 'Period', 'act.p30': 'Past 30 days', 'act.p14': 'Past 14 days', 'act.p7': 'Past 7 days', 'act.agenda.all': 'All topics', 'act.agenda.info': 'The share of each topic in the news of the period. A click on a topic opens it on Topics › One topic, with the whole period of the analysis.', 'act.pall': 'Whole period', 'act.newsonly': 'News only', 'act.k.top': 'Top topic', 'act.evolution': 'Evolution', 'act.evolution.info': 'Articles of the topic per day.', 'act.topic.articles': 'Articles', 'act.topic.share': 'Share of the agenda', 'act.topic.stance': 'Stance on the government, by outlet', 'act.topic.stance.info': 'Outlets with 10 or more articles on the topic that take a position, from most critical to most supportive.', 'act.emphasis': 'Who emphasised each topic', 'act.emphasis.info': 'Pick a topic: outlets ranked by its share of their news.', 'act.emphasis.pick': 'Topic',
      'act.tab.overview': 'Overview', 'act.vs': 'vs prev period', 'act.k.articles': 'Articles', 'act.k.stories': 'New stories', 'act.k.top5': 'Top 5 topics', 'act.top.outlets': 'Top outlets', 'act.art': 'articles', 'act.c.type': 'Kind of articles', 'act.c.stories': 'New stories by topic', 'act.c.stance': 'Stance on the government', 'act.c.outlets': 'Articles by outlet',
      'act.news': 'News', 'act.soft': 'Sports, lifestyle, weather', 'act.other': 'Other'
    })
    const { t, fmt, h } = App
    const { fit, niceStep } = Dash
    const home = window.FIXTURES.home
    const storyList = (window.FIXTURES.stories || {}).stories || []
    const mset = window.FIXTURES.mme ? window.FIXTURES.mme.sets.gr : null
    const COLORS = ['var(--act-1)', 'var(--act-2)', 'var(--act-3)', 'var(--act-4)']
    const OTHER = 'var(--act-5)'
    const STANCE = ['var(--stance-critical)', 'var(--stance-neutral)', 'var(--stance-supportive)']
    const name = (x) => x[App.locale] || x.el
    const N = home.dates.length
    let days = 30
    const short = (n) => (n >= 1e6 ? `${fmt.dec(n / 1e6)}M` : n >= 1e4 ? `${fmt.dec(n / 1e3)}K` : fmt.int(Math.round(n)))
    const sum = (a, i0, i1) => { let s = 0; for (let i = i0; i <= i1; i++) s += a[i] || 0; return s }
    const hardIdx = home.issues.map((x, k) => k).filter((k) => !home.issues[k].soft)
    const softIdx = home.issues.map((x, k) => k).filter((k) => home.issues[k].soft)
    const daily = (idx) => home.dates.map((_, i) => idx.reduce((a, k) => a + home.issueDaily[k][i], 0))
    const newsDaily = daily(hardIdx)
    const softDaily = daily(softIdx)
    const storiesDaily = new Array(N).fill(0)
    storyList.forEach((s) => { if (!s.generic) storiesDaily[s.days[0]]++ })

    function Spark (values, color) {
      const W = 84; const H = 46; const top = Math.max(...values, 1); const low = Math.min(...values)
      const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * W} ${H - 3 - ((v - low) / ((top - low) || 1)) * (H - 6)}`)
      return h('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, h('path', { d: `M${pts.join('L')}`, fill: 'none', stroke: color, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }))
    }
    function Kpi (label, value, spark, now, before, small) {
      const change = before ? (now - before) / before : 0
      const up = change >= 0
      const color = up ? 'var(--act-up)' : 'var(--act-down)'
      return h('div', { class: 'act-card act-kpi' }, h('div', {}, h('p', { class: 'act-kpi-label' }, label), h('p', { class: small ? 'act-kpi-value is-text' : 'act-kpi-value' }, value)), Spark(spark, color),
        h('p', { class: 'act-kpi-foot' }, h('span', { class: `act-delta ${up ? 'up' : 'down'}` }, `${up ? '↑' : '↓'} ${fmt.dec(Math.abs(change) * 100)}%`), h('span', {}, t('act.vs'))))
    }
    function Head (title) {
      return h('div', { class: 'act-card-head' }, h('h2', {}, title))
    }
    function Legend (items) {
      return h('ul', { class: 'act-legend' }, items.map((x) => h('li', {}, h('i', { style: { background: x.color } }), x.label)))
    }
    // The x labels and the dashed grid of every chart.
    function frame (svg, width, height, top, i0, i1, pad) {
      const step = niceStep(top / 4)
      const max = Math.ceil(top / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const x = (i) => pad.left + ((i - i0) / Math.max(i1 - i0 + 1, 1)) * plotW
      const y = (v) => pad.top + plotH - (v / max) * plotH
      for (let v = 0; v <= max; v += step) svg.append(h('line', { class: 'grid', x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }), h('text', { x: pad.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, short(v)))
      const n = i1 - i0 + 1
      const every = Math.max(1, Math.ceil(70 / (plotW / n)))
      for (let i = i0; i <= i1; i += every) {
        const cx = x(i) + plotW / n / 2
        svg.append(h('line', { class: 'grid', x1: cx, x2: cx, y1: pad.top, y2: pad.top + plotH }), h('text', { x: Math.min(cx, width - 24), y: height - 6, 'text-anchor': 'middle' }, fmt.date(home.dates[i], { day: 'numeric', month: 'short' })))
      }
      svg.append(h('line', { class: 'base', x1: pad.left, x2: width - pad.right, y1: y(0), y2: y(0) }))
      return { x, y, slot: plotW / n, plotH, max }
    }
    function Bars (series, i0, i1, height) {
      return fit((holder, width) => {
        const svg = h('svg', { class: 'act-chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': series.map((s) => s.label).join(', ') })
        const totals = []
        for (let i = i0; i <= i1; i++) totals.push(series.reduce((a, s) => a + s.values[i], 0))
        const f = frame(svg, width, height, Math.max(...totals, 1), i0, i1, { left: 52, right: 10, top: 8, bottom: 26 })
        const w = Math.min(f.slot * 0.72, 32)
        for (let i = i0; i <= i1; i++) {
          let base = 0
          const cx = f.x(i) + f.slot / 2
          series.forEach((s) => { const v = s.values[i]; if (v) { svg.append(h('rect', { x: cx - w / 2, y: f.y(base + v), width: w, height: Math.max(f.y(base) - f.y(base + v), 0.5), fill: s.color })); base += v } })
          const hit = h('rect', { class: 'hit', x: f.x(i), y: 8, width: f.slot, height: f.plotH })
          const tip = [fmt.date(home.dates[i]), ...series.filter((s) => s.values[i]).map((s) => `${s.label}: ${fmt.int(s.values[i])}`)].join('\n')
          hit.addEventListener('pointermove', (e) => UI.showTooltip(tip, e.clientX, e.clientY))
          hit.addEventListener('pointerleave', () => UI.hideTooltip())
          svg.append(hit)
        }
        holder.replaceChildren(svg)
      })
    }
    function Areas (series, i0, i1, height) {
      return fit((holder, width) => {
        const svg = h('svg', { class: 'act-chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': series.map((s) => s.label).join(', ') })
        const top = Math.max(...series.flatMap((s) => s.values.slice(i0, i1 + 1)), 1)
        const f = frame(svg, width, height, top, i0, i1, { left: 52, right: 10, top: 8, bottom: 26 })
        const px = (i) => f.x(i) + f.slot / 2
        series.forEach((s) => {
          const line = UI.smoothPath(s.values.slice(i0, i1 + 1).map((v, j) => [px(i0 + j), f.y(v)]), new Set())
          svg.append(h('path', { d: `${line}L${px(i1)} ${f.y(0)}L${px(i0)} ${f.y(0)}Z`, fill: s.color, 'fill-opacity': 0.25 }), h('path', { d: line, fill: 'none', stroke: s.color, 'stroke-width': 1.75 }))
        })
        for (let i = i0; i <= i1; i++) {
          const hit = h('rect', { class: 'hit', x: f.x(i), y: 8, width: f.slot, height: f.plotH })
          const tip = [fmt.date(home.dates[i]), ...series.map((s) => `${s.label}: ${fmt.int(s.values[i])}`)].join('\n')
          hit.addEventListener('pointermove', (e) => UI.showTooltip(tip, e.clientX, e.clientY))
          hit.addEventListener('pointerleave', () => UI.hideTooltip())
          svg.append(hit)
        }
        holder.replaceChildren(svg)
      })
    }
    // The largest items of the period and one "other" series.
    function topSeries (items, count, i0, i1, colors = COLORS) {
      const ranked = items.slice().sort((a, b) => sum(b.values, i0, i1) - sum(a.values, i0, i1))
      const rest = home.dates.map((_, i) => ranked.slice(count).reduce((a, x) => a + x.values[i], 0))
      return [...ranked.slice(0, count).map((x, k) => ({ ...x, color: colors[k] })), { label: t('act.other'), values: rest, color: OTHER }]
    }

  const hardItems = () => hardIdx.filter((k) => !home.issues[k].catchAll).map((k) => ({ k, label: name(home.issues[k]), values: home.issueDaily[k] }))

  // The filter of Θέματα › Επισκόπηση. It stays on screen and changes the figures and the ranking.
  function Controls ({ days: value, newsOnly, onDays, onNews }) {
    const select = h('select', { class: 'act-period', 'aria-label': t('act.period') }, [[30, 'act.p30'], [14, 'act.p14'], [7, 'act.p7'], [N, 'act.pall']].map(([v, k]) => h('option', { value: v, selected: v === value }, t(k))))
    select.addEventListener('change', () => onDays(Number(select.value)))
    const box = h('input', { type: 'checkbox', checked: newsOnly })
    box.addEventListener('change', () => onNews(box.checked))
    return h('div', { class: 'act-controls' }, select, h('label', { class: 'act-check' }, box, t('act.newsonly')))
  }

  // Four figures on the news articles of the period, each against the period before it. The whole period has nothing before it, so it has no change.
  function Figures (period) {
    const i1 = N - 1
    const i0 = N - period
    const p1 = i0 - 1
    const p0 = Math.max(0, i0 - period)
    const hasBefore = p1 >= p0 && p1 >= 0
    const ranked = hardIdx.map((k) => ({ k, label: name(home.issues[k]), n: sum(home.issueDaily[k], i0, i1) })).sort((a, b) => b.n - a.n)
    const now = sum(newsDaily, i0, i1)
    const before = hasBefore ? sum(newsDaily, p0, p1) : 0
    const keys = ranked.slice(0, 5).map((r) => r.k)
    const shareOf = (ks, a, b, all) => ks.reduce((s, k) => s + sum(home.issueDaily[k], a, b), 0) / (all || 1)
    const top = ranked[0]
    const shareSpark = (ks) => newsDaily.slice(i0).map((v, j) => ks.reduce((a, k) => a + home.issueDaily[k][i0 + j], 0) / (v || 1))
    return h('div', { class: 'act-grid-4' },
      Kpi(t('act.k.articles'), short(now), newsDaily.slice(i0), now, before),
      Kpi(t('act.k.stories'), short(sum(storiesDaily, i0, i1)), storiesDaily.slice(i0), sum(storiesDaily, i0, i1), hasBefore ? sum(storiesDaily, p0, p1) : 0),
      Kpi(t('act.k.top'), top.label, shareSpark([top.k]), top.n / (now || 1), hasBefore ? shareOf([top.k], p0, p1, before) : 0, true),
      Kpi(t('act.k.top5'), fmt.pct(shareOf(keys, i0, i1, now)), shareSpark(keys), shareOf(keys, i0, i1, now), hasBefore ? shareOf(keys, p0, p1, before) : 0))
  }

  const chartCard = (cls, title, chart, series) => h('div', { class: `act-card ${cls}` }, Head(title), chart, Legend(series))
  const i0 = 0
  const i1 = N - 1
  function TopOutlets (cls) {
    const ranked = home.outlets.map((o) => ({ name: o.name, n: sum(o.daily, i0, i1) })).sort((a, b) => b.n - a.n)
    const all = ranked.reduce((a, o) => a + o.n, 0) || 1
    return h('div', { class: `act-card ${cls}` }, Head(t('act.top.outlets')), h('ol', { class: 'act-top' }, ranked.slice(0, 5).map((o, j) => h('li', {}, h('span', { class: 'rank' }, fmt.int(j + 1)), h('span', { class: 'swatch', style: { background: COLORS[j] || OTHER } }),
      h('span', {}, o.name, h('small', {}, fmt.pct(o.n / all))), h('span', { class: 'num' }, short(o.n), h('span', {}, ` ${t('act.art')}`))))))
  }
  function OutletBars (cls) {
    const series = topSeries(home.outlets.map((o) => ({ label: o.name, values: o.daily })), 3, i0, i1)
    return chartCard(cls, t('act.c.outlets'), Bars(series, i0, i1, 260), series)
  }
  function KindCard (cls) {
    const series = [{ label: t('act.news'), values: newsDaily, color: 'var(--act-6)' }, { label: t('act.soft'), values: softDaily, color: 'var(--act-2)' }]
    return chartCard(cls, t('act.c.type'), Areas(series, i0, i1, 260), series)
  }
  function StanceCard (cls) {
    const byDay = [0, 1, 2].map(() => new Array(N).fill(0))
    mset.os.forEach((byIssue) => byIssue.forEach((row) => { if (!row) return; for (let j = 0; j < row.length; j += 4) { for (let m = 0; m < 3; m++) byDay[m][row[j]] += row[j + 1 + m] } }))
    const series = ['critical', 'neutral', 'supportive'].map((nm, m) => ({ label: t(`stance.${nm}`), values: byDay[m], color: STANCE[m] }))
    return chartCard(cls, t('act.c.stance'), Bars(series, i0, i1, 260), series)
  }
  function StoryTopics (cls) {
    const items = hardItems().map((x) => {
      const values = new Array(N).fill(0)
      storyList.forEach((s) => { if (!s.generic && s.issue === x.k) values[s.days[0]]++ })
      return { label: x.label, values }
    })
    const series = topSeries(items, 3, i0, i1)
    return chartCard(cls, t('act.c.stories'), Bars(series, i0, i1, 260), series)
  }
  function Evolution (cls, issueName) {
    const k = home.issues.findIndex((x) => x.el === issueName)
    if (k < 0) return null
    const series = [{ label: name(home.issues[k]), values: home.issueDaily[k], color: 'var(--series-1)' }]
    return h('div', { class: `act-card ${cls}` }, Head(t('act.evolution')), h('p', { class: 'dcard-sub' }, t('act.evolution.info')), Bars(series, i0, i1, 200))
  }
  // The overview of the subjects: a donut of the largest and the list of them. A click on a subject opens it on Θέματα › Ένα θέμα.
  // items: [{ label, n, href }], the largest first. href is empty when the subject has no page.
  function Agenda (cls, items, allHref) {
    const total = items.reduce((a, x) => a + x.n, 0) || 1
    const top = items.slice(0, Dash.SLOTS.length).map((x, i) => ({ ...x, color: Dash.SLOTS[i] }))
    const parts = [...top, { label: t('topics2.agenda.rest'), n: items.slice(Dash.SLOTS.length).reduce((a, x) => a + x.n, 0), href: allHref, color: 'var(--bar-muted)' }]
    const size = 240
    const center = size / 2
    const outer = center - 2
    const inner = outer - 36
    const point = (radius, turn) => [center + radius * Math.sin(turn * 2 * Math.PI), center - radius * Math.cos(turn * 2 * Math.PI)]
    const arc = (a0, a1) => {
      const big = a1 - a0 > 0.5 ? 1 : 0
      const [x0, y0] = point(outer, a0); const [x1, y1] = point(outer, a1); const [x2, y2] = point(inner, a1); const [x3, y3] = point(inner, a0)
      return `M${x0} ${y0}A${outer} ${outer} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 ${big} 0 ${x3} ${y3}Z`
    }
    let turn = 0
    const donut = h('svg', { class: 'chart donut agenda-donut', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': parts.map((p) => `${p.label}: ${fmt.int(p.n)}`).join(', ') },
      parts.map((p) => {
        const start = turn
        turn += p.n / total
        const slice = h('path', { class: p.href ? 'agenda-slice is-link' : 'agenda-slice', d: arc(start, Math.min(turn, 0.9999)), fill: p.color })
        const tip = `${p.label}: ${fmt.int(p.n)} · ${fmt.pct(p.n / total)}`
        slice.addEventListener('pointermove', (e) => UI.showTooltip(tip, e.clientX, e.clientY))
        slice.addEventListener('pointerleave', () => UI.hideTooltip())
        if (p.href) slice.addEventListener('click', () => { location.href = window.ROUTES?.href ? window.ROUTES.href(p.href) : p.href })
        return slice
      }),
      h('text', { class: 'donut-num', x: center, y: center + 2, 'text-anchor': 'middle' }, fmt.int(total)),
      h('text', { class: 'donut-cap', x: center, y: center + 20, 'text-anchor': 'middle' }, t('topics2.agenda.center')))
    return h('div', { class: `dcard ${cls}` }, Dash.cardHead(t('topics2.agenda.title'), allHref ? h('a', { class: 'dcard-link', href: allHref }, `${t('act.agenda.all')} →`) : null, t('act.agenda.info')),
      h('div', { class: 'donut-wrap agenda-wrap' }, donut, h('ul', { class: 'agenda-legend' }, parts.map((p) => h('li', {},
        h('span', { class: 'swatch', style: { background: p.color } }),
        h('span', { class: 'agenda-name' }, p.href ? h('a', { class: 'quiet-link', href: p.href }, p.label) : p.label),
        h('span', { class: 'agenda-num' }, `${fmt.pct(p.n / total)} · ${fmt.int(p.n)}`))))))
  }
  window.Activity = { Agenda, Controls, Figures, TopOutlets, OutletBars, KindCard, StanceCard, StoryTopics, Evolution }
})()
