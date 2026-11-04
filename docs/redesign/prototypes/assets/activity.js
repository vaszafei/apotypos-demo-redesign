// The overview of Μέσα › Θέματα in the layout of an activity console: five figures with their change, two top lists, one wide chart and four charts.
// Load after messages, components, dash and the fixtures home, stories and mme. Activity.Overview() returns the node.
(function () {
    Object.assign(window.MESSAGES.el, {
      'act.title': 'Θέματα', 'act.sub': 'Τι απασχολεί τα ελληνικά ΜΜΕ', 'act.period': 'Περίοδος', 'act.p30': 'Τελευταίες 30 ημέρες', 'act.p14': 'Τελευταίες 14 ημέρες', 'act.p7': 'Τελευταίες 7 ημέρες',
      'act.tab.overview': 'Επισκόπηση', 'act.vs': 'έναντι πριν', 'act.k.articles': 'Άρθρα', 'act.k.stories': 'Νέες ιστορίες', 'act.k.perday': 'Ανά ημέρα', 'act.k.top5': 'Top 5 θέματα', 'act.k.outlets': 'Ενεργά μέσα',
      'act.top.topics': 'Κορυφαία θέματα', 'act.top.outlets': 'Κορυφαία μέσα', 'act.more': 'Εξερεύνηση', 'act.art': 'άρθρα', 'act.topic.sub': '{share} της ατζέντας',
      'act.c.main': 'Άρθρα ανά θέμα', 'act.c.type': 'Είδος άρθρων', 'act.c.stories': 'Νέες ιστορίες ανά θέμα', 'act.c.stance': 'Στάση προς την κυβέρνηση', 'act.c.outlets': 'Άρθρα ανά μέσο',
      'act.news': 'Ειδήσεις', 'act.soft': 'Αθλητικά, lifestyle, καιρός', 'act.other': 'Άλλα'
    })
    Object.assign(window.MESSAGES.en, {
      'act.title': 'Topics', 'act.sub': 'What Greek media are writing about', 'act.period': 'Period', 'act.p30': 'Past 30 days', 'act.p14': 'Past 14 days', 'act.p7': 'Past 7 days',
      'act.tab.overview': 'Overview', 'act.vs': 'vs prev period', 'act.k.articles': 'Articles', 'act.k.stories': 'New stories', 'act.k.perday': 'Per day', 'act.k.top5': 'Top 5 topics', 'act.k.outlets': 'Active outlets',
      'act.top.topics': 'Top topics', 'act.top.outlets': 'Top outlets', 'act.more': 'Explore', 'act.art': 'articles', 'act.topic.sub': '{share} of the agenda',
      'act.c.main': 'Articles by topic', 'act.c.type': 'Kind of articles', 'act.c.stories': 'New stories by topic', 'act.c.stance': 'Stance on the government', 'act.c.outlets': 'Articles by outlet',
      'act.news': 'News', 'act.soft': 'Sports, lifestyle, weather', 'act.other': 'Other'
    })
    const { t, fmt, h } = App
    const { fit, niceStep } = Dash
    const home = window.FIXTURES.home
    const storyList = window.FIXTURES.stories.stories
    const mset = window.FIXTURES.mme.sets.gr
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
    function Kpi (label, value, spark, now, before, invert) {
      const change = before ? (now - before) / before : 0
      const up = change >= 0
      const color = up ? 'var(--act-up)' : 'var(--act-down)'
      return h('div', { class: 'act-card act-kpi' }, h('div', {}, h('p', { class: 'act-kpi-label' }, label), h('p', { class: 'act-kpi-value' }, value)), Spark(spark, color),
        h('p', { class: 'act-kpi-foot' }, h('span', { class: `act-delta ${up ? 'up' : 'down'}` }, `${up ? '↑' : '↓'} ${fmt.dec(Math.abs(change) * 100)}%`), h('span', {}, t('act.vs'))))
    }
    function Head (title, href) {
      return h('div', { class: 'act-card-head' }, h('h2', {}, title), h('a', { href }, `${t('act.more')} ›`))
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
        svg.append(h('line', { class: 'grid', x1: cx, x2: cx, y1: pad.top, y2: pad.top + plotH }), h('text', { x: cx, y: height - 6, 'text-anchor': 'middle' }, fmt.date(home.dates[i], { day: 'numeric', month: 'short' })))
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


  function Overview () {
    const root = h('div', {})
        const draw = () => {
          const i1 = N - 1
          const i0 = N - days
          const p1 = i0 - 1
          const p0 = Math.max(0, i0 - days)
          const issueItems = hardIdx.filter((k) => !home.issues[k].catchAll).map((k) => ({ k, label: name(home.issues[k]), values: home.issueDaily[k] }))
          const rankedIssues = hardIdx.map((k) => ({ k, label: name(home.issues[k]), n: sum(home.issueDaily[k], i0, i1), before: sum(home.issueDaily[k], p0, p1) })).sort((a, b) => b.n - a.n)
          const newsNow = sum(newsDaily, i0, i1)
          const newsBefore = sum(newsDaily, p0, p1)
          const top5Now = rankedIssues.slice(0, 5).reduce((a, r) => a + r.n, 0) / (newsNow || 1)
          const top5Keys = rankedIssues.slice(0, 5).map((r) => r.k)
          const top5Before = top5Keys.reduce((a, k) => a + sum(home.issueDaily[k], p0, p1), 0) / (newsBefore || 1)
          const top5Spark = newsDaily.slice(i0).map((v, j) => top5Keys.reduce((a, k) => a + home.issueDaily[k][i0 + j], 0) / (v || 1))
          const active = (a, b) => home.outlets.filter((o) => sum(o.daily, a, b) >= 1).length
          const activeDaily = home.dates.map((_, i) => home.outlets.filter((o) => o.daily[i] > 0).length)

          const kpis = h('div', { class: 'act-grid-5' },
            Kpi(t('act.k.articles'), short(newsNow), newsDaily.slice(i0), newsNow, newsBefore),
            Kpi(t('act.k.stories'), short(sum(storiesDaily, i0, i1)), storiesDaily.slice(i0), sum(storiesDaily, i0, i1), sum(storiesDaily, p0, p1)),
            Kpi(t('act.k.perday'), short(newsNow / days), newsDaily.slice(i0), newsNow / days, newsBefore / (p1 - p0 + 1)),
            Kpi(t('act.k.top5'), fmt.pct(top5Now), top5Spark, top5Now, top5Before),
            Kpi(t('act.k.outlets'), fmt.int(active(i0, i1)), activeDaily.slice(i0), active(i0, i1), active(p0, p1)))

          const topTopics = h('div', { class: 'act-card' }, Head(t('act.top.topics'), '#act-details'),
            h('ol', { class: 'act-top' }, rankedIssues.slice(0, 5).map((r, j) => h('li', {}, h('span', { class: 'rank' }, fmt.int(j + 1)), h('span', { class: 'swatch', style: { background: COLORS[j] || OTHER } }),
              h('span', {}, h('a', { class: 'quiet-link', href: `topic-v2.html?i=${r.k}` }, r.label), h('small', {}, t('act.topic.sub', { share: fmt.pct(r.n / (newsNow || 1)) }))),
              h('span', { class: 'num' }, short(r.n), h('span', {}, ` ${t('act.art')}`))))))
          const rankedOutlets = home.outlets.map((o) => ({ name: o.name, n: sum(o.daily, i0, i1) })).sort((a, b) => b.n - a.n)
          const allOutlets = rankedOutlets.reduce((a, o) => a + o.n, 0) || 1
          const topOutlets = h('div', { class: 'act-card' }, Head(t('act.top.outlets'), 'media-v2.html'),
            h('ol', { class: 'act-top' }, rankedOutlets.slice(0, 5).map((o, j) => h('li', {}, h('span', { class: 'rank' }, fmt.int(j + 1)), h('span', { class: 'swatch', style: { background: COLORS[j] || OTHER } }),
              h('span', {}, o.name, h('small', {}, fmt.pct(o.n / allOutlets))), h('span', { class: 'num' }, short(o.n), h('span', {}, ` ${t('act.art')}`))))))

          const mainSeries = topSeries(issueItems, 4, i0, i1)
          const mainCard = h('div', { class: 'act-card' }, Head(t('act.c.main'), '#act-details'), Bars(mainSeries, i0, i1, 300), Legend(mainSeries))
          const typeSeries = [{ label: t('act.news'), values: newsDaily, color: 'var(--act-6)' }, { label: t('act.soft'), values: softDaily, color: 'var(--act-2)' }]
          const storyItems = hardIdx.filter((k) => !home.issues[k].catchAll).map((k) => {
            const values = new Array(N).fill(0)
            storyList.forEach((s) => { if (!s.generic && s.issue === k) values[s.days[0]]++ })
            return { label: name(home.issues[k]), values }
          })
          const storySeries = topSeries(storyItems, 3, i0, i1)
          // The stance of each day, from the rows [day, critical, neutral, supportive] of each outlet and topic.
          const stanceByDay = [0, 1, 2].map(() => new Array(N).fill(0))
          mset.os.forEach((byIssue) => byIssue.forEach((row, k) => { if (!row) return; for (let j = 0; j < row.length; j += 4) { for (let m = 0; m < 3; m++) stanceByDay[m][row[j]] += row[j + 1 + m] } }))
          const stanceSeries = ['critical', 'neutral', 'supportive'].map((nm, m) => ({ label: t(`stance.${nm}`), values: stanceByDay[m], color: STANCE[m] }))
          const outletSeries = topSeries(home.outlets.map((o) => ({ label: o.name, values: o.daily })), 3, i0, i1)
          const chartCard = (title, href, chart, series) => h('div', { class: 'act-card' }, Head(title, href), chart, Legend(series))

          const select = h('select', { class: 'act-period', 'aria-label': t('act.period') }, [[30, 'act.p30'], [14, 'act.p14'], [7, 'act.p7']].map(([v, k]) => h('option', { value: v, selected: v === days }, t(k))))
          select.addEventListener('change', () => { days = Number(select.value); draw() })
          const tabs = h('nav', { class: 'act-tabs', 'aria-label': t('act.title') },
            h('a', { href: 'topics-v2.html', 'aria-current': 'page' }, t('act.tab.overview')),
            h('a', { href: 'topics-v2.html?tab=topic' }, t('tab.media.topics.topic')), h('a', { href: 'topics-v2.html?tab=agenda' }, t('tab.media.topics.agenda')), h('a', { href: 'overton-v2.html' }, t('tab.media.shifts')))

          root.replaceChildren(h('div', { class: 'act' },
            h('div', { class: 'act-head' }, h('div', {}, h('h1', {}, t('act.title')), h('p', {}, t('act.sub'))), select),
            tabs, kpis, h('div', { class: 'act-grid-2' }, topTopics, topOutlets), mainCard,
            h('div', { class: 'act-grid-2' },
              chartCard(t('act.c.type'), 'media-v2.html', Areas(typeSeries, i0, i1, 240), typeSeries),
              chartCard(t('act.c.stories'), 'stories-v2.html', Bars(storySeries, i0, i1, 240), storySeries),
              chartCard(t('act.c.stance'), 'topics-v2.html?tab=topic', Bars(stanceSeries, i0, i1, 240), stanceSeries),
              chartCard(t('act.c.outlets'), 'media-v2.html', Bars(outletSeries, i0, i1, 240), outletSeries))))
        }
        draw()
    return root
  }
  window.Activity = { Overview }
})()
