// Shared parts of the dashboard pages (APO-161): the top bar, the compact stat card, the cards and the small charts.
// Load after components.js. The pages media-v2, groups-v2 and fingerprints-v2 use it.
(function () {
  const { t, fmt, h, Icon } = window.App

  // The charts draw again at their real width. reset() stops the old observers before a page draws again.
  const watchers = []
  function reset () { watchers.splice(0).forEach((o) => o.disconnect()) }
  function fit (draw) {
    const holder = h('div', { class: 'fit' })
    // A fractional width rounds up in clientWidth, so the drawing would shrink below 12 px. Round down.
    const run = () => { const w = Math.floor(holder.getBoundingClientRect().width); if (w) draw(holder, w) }
    requestAnimationFrame(run)
    const observer = new ResizeObserver(run)
    observer.observe(holder)
    watchers.push(observer)
    return holder
  }

  const niceStep = (raw) => { const p = 10 ** Math.floor(Math.log10(raw || 1)); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10 }
  const pct0 = (v) => `${Math.round(v * 100)}%`

  // Colors come from tokens.css (#2). color(name) returns a token as #rrggbb, for the code that computes with a color (tint, textOn, a mix).
  // A style that only shows a color can use var(--name) directly. The cache key has the theme, so a theme switch reads the new values.
  const colorCache = new Map()
  let probe = null
  function toHex (value) {
    const v = value.trim().toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(v)) return v
    if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`
    probe = probe || document.createElement('canvas').getContext('2d')
    probe.fillStyle = 'black'
    probe.fillStyle = v
    return probe.fillStyle
  }
  function color (name) {
    const key = `${document.documentElement.dataset.theme || ''}|${name}`
    if (!colorCache.has(key)) colorCache.set(key, toHex(getComputedStyle(document.documentElement).getPropertyValue(name)))
    return colorCache.get(key)
  }
  // The categorical slots 1 to 8 (--cat-1 to --cat-8); --cat-0 is "no known group".
  const slots = () => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => color(`--cat-${i}`))
  // The fixed group to slot map (#2): a group has the same color on every page, whatever list the page has.
  // Slots 1 to 8 follow the order of the groups file. Antenna Group is only in the live data (/api/sources), so it has a 9th slot.
  const GROUP_SLOT = new Map([['Alter Ego Media', 1], ['DPG Digital Media', 2], ['Συμφέροντα Μπάκου-Καϋμενάκη', 3], ['Politis Group', 4],
    ['Συμφέροντα Μελισσανίδη', 5], ['Όμιλος ΣΚΑΪ', 6], ['Συμφέροντα Σαββίδη', 7], ['Όμιλος Βαρδινογιάννη', 8], ['Antenna Group', 9]])
  const slotOf = (name) => (GROUP_SLOT.has(name) ? color(`--cat-${GROUP_SLOT.get(name)}`) : null)
  const groupColor = (name) => (name && slotOf(name)) || color('--cat-0')
  function groupColors (groupList) { const s = slots(); return new Map(groupList.map((g, i) => [g.name, slotOf(g.name) || s[i % s.length]])) }
  // A step of the sequential ramp (--seq-1 to --seq-7) for a value from 0 to 1, with the text color of that step.
  const seq = (v) => { const k = Math.min(7, Math.max(1, Math.ceil((Number.isFinite(v) ? v : 0) * 7))); return { background: `var(--seq-${k})`, color: `var(--seq-text-${k})` } }

  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // The text color with the better contrast on a hex background.
  const textOn = (hex) => { const l = luminance(hex); const dark = color('--text-on-light'); return (l + 0.05) / (luminance(dark) + 0.05) >= (luminance(color('--text-on-dark')) + 0.05) / (l + 0.05) ? dark : color('--text-on-dark') }
  const tint = (hex, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('')}`

  // Sparkline: the whole window in gray and the selected period in the accent color.
  function Spark (values, i0, i1, label, { w = 96, hgt = 28 } = {}) {
    const max = Math.max(...values, 1)
    const x = (i) => 1 + (i / Math.max(values.length - 1, 1)) * (w - 2)
    const y = (v) => hgt - 2 - (v / max) * (hgt - 4)
    const path = (from, to) => values.slice(from, to + 1).map((v, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    return h('svg', { class: 'spark', width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, role: 'img', 'aria-label': label },
      h('path', { class: 'spark-base', d: path(0, values.length - 1) }),
      h('path', { class: 'spark-range', d: path(i0, i1) }))
  }

  const card = (cls, ...children) => h('section', { class: `dcard ${cls}` }, ...children)
  // Info: the explanation of a card is not on the card. A round icon button (the information-circle of the icon set) in the top right corner shows it on hover, on focus and on a tap.
  function Info (text) {
    const btn = h('button', { type: 'button', class: 'info-btn', 'aria-label': t('dash.info'), 'aria-expanded': 'false' }, Icon('information-circle', 'icon'))
    const wrap = h('span', { class: 'info' }, btn, h('span', { class: 'info-pop', role: 'note' }, text))
    btn.addEventListener('click', () => { const open = !wrap.classList.contains('is-open'); closeInfos(); wrap.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)) })
    return wrap
  }
  function closeInfos () { document.querySelectorAll('.info.is-open').forEach((el) => { el.classList.remove('is-open'); el.firstChild.setAttribute('aria-expanded', 'false') }) }
  document.addEventListener('click', (e) => { if (!e.target.closest('.info')) closeInfos() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfos() })
  const cardHead = (title, aside, info) => h('div', { class: 'dcard-head' }, h('h2', { class: 'dcard-title' }, title),
    aside || info ? h('div', { class: 'dcard-tools' }, aside, info ? Info(info) : null) : null)
  const emptyText = (text) => h('p', { class: 'dcard-empty' }, text)
  // The body of a card that has no data yet: loading, empty or error. The error state has a retry button when onRetry is given.
  const cardState = (kind, text, onRetry) => kind === 'loading'
    ? h('div', { class: 'dcard-skeleton', 'data-state': 'loading', role: 'status', 'aria-label': text || t('state.loading') },
      h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' }))
    : kind === 'error' ? UI.ErrorState({ text: text || undefined, onRetry })
      : h('p', { class: 'dcard-empty', 'data-state': 'empty' }, text)
  // The link under the body of a card, for example «Όλα τα θέματα →». Pass an a.dcard-link or a button.dcard-link.
  const cardFoot = (link) => h('div', { class: 'dcard-foot' }, link)

  // Stat card: small. A label, a number, one short line and a small picture of the same measure.
  // delta: the change against the previous period as a fraction (0.12 is ▲ +12%), shown before the short line.
  // variant 'compact': the number and the short line share a row. It takes no column class, the page places it.
  function Stat ({ label, value, sub, viz, kpi, empty, delta, variant }) {
    const el = card(`${variant === 'compact' ? 'dstat-compact' : 'c-4'} dstat`, h('h2', { class: 'dstat-label' }, label),
      empty
        ? emptyText(t('media2.stat.empty'))
        : h('div', { class: 'dstat-row' }, h('p', { class: 'dstat-value' }, value),
          h('p', { class: 'dstat-sub' }, delta == null ? sub : [h('span', { class: 'delta' }, `${delta >= 0 ? '▲' : '▼'} ${fmt.signed(delta * 100)}%`), ' ', sub]), viz))
    if (kpi) el.dataset.kpi = kpi
    return el
  }

  // Top bar: the title, then the tabs of the page, then the actions of the active tab. It stays on screen while the page scrolls.
  // quiet: the page has no visible title and no line of counts, only the tabs. The title stays for screen readers.
  function TopBar ({ title, meta, aside, actions, tabs, error, quiet }) {
    // The unified header (prototype, ?header=v2): the date range, the set of outlets and a view switch are page actions. The rest are filters of the tab.
    if (window.Shell?.headerV2) {
      const list = [aside, ...(actions || [])].filter(Boolean)
      const isPage = (el) => el.matches?.('.dr, .segmented, .set-select')
      return Shell.PageHead({ meta: quiet ? null : meta, actions: list.filter(isPage), filters: list.filter((el) => !isPage(el)), tabs, error })
    }
    return h('header', { class: 'dash-bar' },
      quiet ? h('h1', { class: 'visually-hidden' }, title)
        : h('div', { class: 'dash-head' }, h('h1', { class: 'dash-title' }, title), meta && h('span', { class: 'dash-meta' }, meta), aside && h('div', { class: 'dash-aside' }, aside)),
      tabs,
      actions && actions.length ? h('div', { class: 'dash-actions' }, actions) : null,
      error && h('p', { class: 'dash-error', role: 'alert' }, error))
  }

  // A labelled drop-down list for the top bar. All lists have the same height and text size (.field-inline in dash.css).
  const select = (label, value, options, onChange) => h('label', { class: 'field-inline' }, label,
    h('select', { onChange: (e) => onChange(e.target.value) }, options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label))))

  // The content for an answer that is not data: the 404 page, the empty state or the error state. It returns null when every answer has data.
  function stateContent (results, { title, tabs, quiet } = {}) {
    const bad = results.find((r) => r.kind !== 'data')
    if (!bad) return null
    if (bad.kind === 'notFound') return [UI.ErrorPage({ status: 404 })]
    const head = title ? TopBar({ title, tabs, quiet }) : null
    return [head, bad.kind === 'empty' ? h('div', { class: 'dash-grid' }, card('c-12', UI.EmptyState({ text: t('topics2.empty') }))) : UI.ErrorState({ onRetry: () => location.reload() })]
  }

  // Lines: the average of the last 7 days of each of the 8 largest topics of the period, one color each. The vertical axis is linear, and the chart is tall on a wide card, so the ends of the lines are as far
  // apart as they can be. The lines are monotone cubic curves (Fritsch–Carlson), so a curve never goes below 0 or above its neighbouring days.
  // series: [{ name, color, values, key (for href), bold }], the values of the days of dates. href(s): the page of a line (its name at the end is the link).
  // band: { from, to }, the indexes of a period that is tinted. tall: the height on a wide card. sparse: the lines are 0 most of the time (stories), so the tooltip leaves out the lines that are 0 on the day and cuts long names. sqrt: the vertical axis is the square root of the value, so the small lines are not flat on the floor under a large one. A hover shows the values of all of them at that day, under a vertical guide, in the white tooltip.
  function LinesChart ({ dates, series, caption, href, band, tall, sparse, sqrt }) {
    return fit((holder, width) => {
      const height = width < 520 ? 190 : tall || (width < 640 ? 280 : 380)
      // Where there is room (a card 520 px wide or more) each line has its name at its end, on the right. Narrower, a legend over the chart names the lines.
      const labelled = width >= 520
      const long = width >= 700
      const pad = { top: 10, right: labelled ? (long ? 205 : 135) : 12, bottom: 24, left: 44 }
      const n = dates.length
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const peak = Math.max(...series.flatMap((s) => s.values), 1)
      const tickStep = niceStep(peak / (height < 300 ? 4 : 6))
      const yMax = Math.ceil(peak / tickStep) * tickStep
      const X = (i) => pad.left + (i / Math.max(n - 1, 1)) * plotW
      const f = sqrt ? Math.sqrt : (v) => v
      const Y = (v) => pad.top + plotH - (f(v) / f(yMax)) * plotH
      const svg = h('svg', { class: 'chart line-draw', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': caption })
      // The lines of the grid: every tickStep on a linear axis; on a square root axis the round values that are at least 24 px apart, from the top down, with the top and 0 always there.
      let ticks = []
      if (sqrt) {
        const round = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000].filter((v) => v < yMax).concat(yMax).reverse()
        for (const v of round) if ((!ticks.length || Y(v) - Y(ticks[ticks.length - 1]) >= 24) && Y(0) - Y(v) >= 24) ticks.push(v)
        ticks.push(0)
      } else for (let v = 0; v <= yMax; v += tickStep) ticks.push(v)
      ticks.forEach((v) => svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: width - pad.right, y1: Y(v), y2: Y(v) }), h('text', { x: pad.left - 6, y: Y(v) + 4, 'text-anchor': 'end' }, fmt.int(v))))
      const step = plotW / Math.max(n - 1, 1)
      // A label about every 72 px: every day, or every 2 to 7 days in a short period, a whole number of weeks in a long one.
      const fitDays = Math.max(1, Math.ceil(72 / step))
      const every = fitDays > 7 ? Math.ceil(fitDays / 7) * 7 : fitDays
      for (let i = 0; i < n; i += every) svg.append(h('text', { x: X(i), y: height - 6, 'text-anchor': 'middle' }, fmt.date(dates[i], { day: 'numeric', month: 'short' })))
      if (band) {
        // A period inside the whole window: a tint behind the lines, at least 3 px wide, so a single day can be seen.
        const x0 = Math.max(pad.left, X(band.from) - step / 2)
        const x1 = Math.min(width - pad.right, X(band.to) + step / 2)
        svg.append(h('rect', { class: 'line-band', x: x0, y: pad.top, width: Math.max(3, x1 - x0), height: plotH }))
      }
      series.slice().reverse().forEach((s) => {
        const path = h('path', { class: 'line-series', d: UI.smoothPath(s.values.map((v, i) => [X(i), Y(v)]), new Set()), stroke: s.color, 'stroke-width': s.bold ? 2.5 : 1.5, pathLength: 1 })
        svg.append(path)
      })
      if (labelled) {
        // The name of a line is at the end of the line, on its own height. Only where two ends are less than 13 px apart the names move apart,
        // each by half of what is missing, so a name never touches another and stays beside its own line.
        const marks = series.map((s) => ({ s, y: Y(s.values[n - 1]), at: Y(s.values[n - 1]) })).sort((a, b) => a.y - b.y)
        for (let round = 0; round < 40; round++) {
          let moved = false
          for (let k = 1; k < marks.length; k++) {
            const miss = 13 - (marks[k].y - marks[k - 1].y)
            if (miss > 0.1) { marks[k - 1].y -= miss / 2; marks[k].y += miss / 2; moved = true }
          }
          if (!moved) break
        }
        // Many ends at the bottom (the lines of stories that are over) push the names up: the names stay inside the plot, and a name that moved far from its line has a thin leader.
        const [lo, hi] = [pad.top + 4, pad.top + plotH + 4]
        for (let k = marks.length - 1; k >= 0; k--) marks[k].y = Math.min(marks[k].y, k === marks.length - 1 ? hi : marks[k + 1].y - 13)
        for (let k = 0; k < marks.length; k++) marks[k].y = Math.max(marks[k].y, k === 0 ? lo : marks[k - 1].y + 13)
        const max = long ? 32 : 17
        // The name is the link of its topic (the href is the one of UI.EntityLink, so the route is in one place).
        marks.forEach(({ s, y: ly, at }) => {
          const link = document.createElementNS('http://www.w3.org/2000/svg', 'a')
          link.setAttribute('href', href(s))
          link.setAttribute('class', 'line-end-link')
          link.append(h('title', {}, s.name), h('text', { class: 'line-end', x: X(n - 1) + 10, y: ly + 4 }, s.name.length > max ? `${s.name.slice(0, max - 1)}…` : s.name))
          if (Math.abs(ly - at) > 6) svg.append(h('line', { class: 'line-leader', x1: X(n - 1), y1: at, x2: X(n - 1) + 8, y2: ly, stroke: s.color }))
          svg.append(h('circle', { class: 'line-dot', cx: X(n - 1), cy: at, r: 3, fill: s.color }), link)
        })
      }
      const rule = h('line', { class: 'hover-rule', y1: pad.top, y2: pad.top + plotH, stroke: 'var(--rule)', 'stroke-width': 1, visibility: 'hidden' })
      const dots = series.map((s) => h('circle', { r: 3.5, fill: s.color, stroke: 'var(--surface-page)', 'stroke-width': 1.5, visibility: 'hidden' }))
      svg.append(rule, ...dots)
      const over = h('rect', { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: 'transparent' })
      const read = (e) => {
        const box = svg.getBoundingClientRect()
        const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - box.left - pad.left) / plotW) * (n - 1))))
        rule.setAttribute('x1', X(i)); rule.setAttribute('x2', X(i)); rule.setAttribute('visibility', 'visible')
        dots.forEach((c, k) => { c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(series[k].values[i])); c.setAttribute('visibility', 'visible') })
        UI.showTooltip({
          title: fmt.date(dates[i]),
          rows: series.filter((s) => !sparse || s.values[i] > 0).map((s) => ({ label: sparse && s.name.length > 44 ? `${s.name.slice(0, 43)}…` : s.name, value: fmt.int(Math.round(s.values[i])), color: s.color })).sort((a, b) => Number(b.value.replace(/\D/g, '')) - Number(a.value.replace(/\D/g, '')))
        }, e.clientX, e.clientY)
      }
      over.addEventListener('pointermove', read)
      over.addEventListener('pointerenter', read)
      over.addEventListener('pointerleave', () => { UI.hideTooltip(); rule.setAttribute('visibility', 'hidden'); dots.forEach((c) => c.setAttribute('visibility', 'hidden')) })
      svg.append(over)
      const table = h('div', { class: 'visually-hidden' }, h('table', {}, h('caption', {}, caption),
        h('tbody', {}, series.map((s) => h('tr', {}, h('th', { scope: 'row' }, s.name), h('td', {}, fmt.int(Math.round(s.values[n - 1]))))))))
      const legend = UI.Legend(series.map((s) => ({ label: s.name, color: s.color })))
      holder.replaceChildren(...(labelled ? [] : [legend]), svg, table)
    })
  }

  // Stories to outlets: a Sankey with two columns (Μέσα › Ιστορίες). stories: [{ id, name, n, flows: [{ o (index of outlets), n }] }], outlets: [{ name, slug (null: the rest), n }].
  // The stories are on the left in boxes with their names, the largest first, the outlets are on the right, and the width of a band is the articles. A story has its own color.
  // A story or an outlet under the mouse keeps its bands and dims the others. current: the id of the story that is picked in the list.
  function StoryFlow ({ stories: input, outlets, current, colorOf, storyLink, outletLink, heads, restLabel }) {
    const stories = input.slice().sort((a, b) => b.n - a.n)
    const total = stories.reduce((s, x) => s + x.n, 0)
    return fit((holder, width) => {
      const narrow = width < 520
      const labelR = narrow ? 84 : 136
      const NODE = 8
      const ROW = 36
      const ROW_O = 22
      const GAP = 4
      const HEAD = 22
      const boxW = narrow ? 150 : 230
      const xS1 = boxW
      const xO = width - labelR - 6 - NODE
      const k = 360 / (total || 1)
      const band = (n) => Math.max(1.2, k * n)

      // The column of stories and the column of outlets. The shorter one is centered against the taller.
      let y = 0
      const placedS = stories.map((s) => { const row = { s, top: y, h: Math.max(ROW, k * s.n) }; y += row.h + GAP; return row })
      const heightS = y - GAP
      const baseO = outlets.map((o) => Math.max(ROW_O, k * o.n))
      const spare = Math.max(0, heightS - baseO.reduce((s, v) => s + v, 0) - GAP * (outlets.length - 1))
      const sumO = outlets.reduce((s, o) => s + o.n, 0) || 1
      let yo = 0
      const placedO = outlets.map((o, i) => { const row = { o, top: yo, h: baseO[i] + spare * (o.n / sumO) }; yo += row.h + GAP; return row })
      const heightO = yo - GAP
      const body = Math.ceil(Math.max(heightS, heightO))
      const shiftS = (body - heightS) / 2
      const shiftO = (body - heightO) / 2
      const height = body + HEAD
      holder.style.height = `${height}px`
      holder.classList.add('flow-story')
      holder.classList.toggle('is-narrow', narrow)

      const svg = h('svg', { class: 'chart flow', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' })
      const labels = []
      const marks = { story: new Map(), outlet: new Map() }
      const mark = (kind, key, el) => { if (!marks[kind].has(key)) marks[kind].set(key, []); marks[kind].get(key).push(el) }
      const on = (kind, key) => { holder.classList.add('has-hl'); marks[kind].get(key).forEach((el) => el.classList.add('is-hl')) }
      const off = (kind, key) => { holder.classList.remove('has-hl'); marks[kind].get(key).forEach((el) => el.classList.remove('is-hl')) }
      const hover = (el, kind, key, tip) => {
        el.addEventListener('pointerenter', (e) => { on(kind, key); if (tip) UI.showTooltip(tip, e.clientX, e.clientY) })
        if (tip) el.addEventListener('pointermove', (e) => UI.showTooltip(tip, e.clientX, e.clientY))
        el.addEventListener('pointerleave', () => { off(kind, key); UI.hideTooltip() })
        el.addEventListener('focusin', () => on(kind, key))
        el.addEventListener('focusout', () => off(kind, key))
      }
      const head = (text, left) => labels.push(h('p', { class: 'flow-head', style: { left: `${left}px`, top: '0px' } }, text))
      head(heads.story, 0)
      head(heads.outlet, xO + NODE + 8)

      // Where the bands of each outlet end: stacked in its row in the order of the stories, from the top.
      const intake = placedO.map((r) => ({ cursor: HEAD + shiftO + r.top + (r.h - band(r.o.n)) / 2 }))
      const bands = []
      placedS.forEach((r, si) => {
        const s = r.s
        const color = colorOf(s.id, si)
        const rowTop = HEAD + shiftS + r.top
        const mid = rowTop + r.h / 2
        let out = mid - band(s.n) / 2
        s.flows.slice().sort((a, b) => a.o - b.o).forEach((f) => {
          const c0 = out
          const c1 = out + band(f.n)
          out = c1
          const d0 = intake[f.o].cursor
          const d1 = d0 + band(f.n)
          intake[f.o].cursor = d1
          const x2 = (xS1 + xO) / 2
          const path = h('path', { class: 'flow-band', fill: color, d: `M${xS1} ${c0}C${x2} ${c0} ${x2} ${d0} ${xO} ${d0}L${xO} ${d1}C${x2} ${d1} ${x2} ${c1} ${xS1} ${c1}Z` })
          bands.push(path)
          mark('story', s.id, path); mark('outlet', f.o, path)
          hover(path, 'story', s.id, { title: s.name, rows: [{ label: placedO[f.o].o.name || restLabel(placedO[f.o].o), value: `${fmt.int(f.n)} · ${fmt.pct(f.n / s.n)}`, color }] })
        })
        const box = h('div', { class: s.id === current ? 'flow-box is-current' : 'flow-box', style: { left: '0px', top: `${rowTop}px`, width: `${boxW}px`, height: `${r.h}px`, '--flow-color': color } },
          h('span', { class: 'flow-name' }, storyLink(s)), h('span', { class: 'flow-n' }, fmt.int(s.n)))
        mark('story', s.id, box)
        hover(box, 'story', s.id)
        labels.push(box)
      })
      svg.prepend(...bands)
      placedO.forEach((r, i) => {
        const top = HEAD + shiftO + r.top
        svg.append(h('rect', { class: 'flow-node flow-node-out', x: xO, y: top, width: NODE, height: r.h }))
        const lab = h('p', { class: 'flow-label flow-outlet', style: { left: `${xO + NODE + 8}px`, top: `${top + r.h / 2}px`, width: `${labelR - NODE - 8}px` } },
          h('span', { class: 'flow-name' }, r.o.slug ? outletLink(r.o) : h('span', {}, restLabel(r.o))), h('span', { class: 'flow-n' }, fmt.int(r.o.n)))
        mark('outlet', i, lab)
        hover(lab, 'outlet', i)
        labels.push(lab)
      })
      holder.replaceChildren(svg, ...labels)
    })
  }

  // Donut: the parts of one whole, from the top, clockwise, with a legend. parts: [{ label, value, color, text }], text is the right column of the legend row.
  // center: { num, cap } shown at rest. A slice or a legend row focuses its part: the center shows its share and name, the other parts dim. pick: the index of a part that stays focused at rest. stack: the value goes under the name (for a narrow card).
  // A part can have tip (a tooltip on its legend row).
  function Donut ({ parts, center, size = 220, aria, pick, stack }) {
    const total = parts.reduce((a, p) => a + p.value, 0)
    const c = size / 2
    const r1 = c - 4
    const r0 = r1 * 0.68
    const arc = (a0, a1) => {
      a0 += 0.006
      a1 = Math.max(a0 + 0.002, a1 - 0.006)
      const p = (a, r) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
      const large = a1 - a0 > Math.PI ? 1 : 0
      return `M${p(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`
    }
    const svg = h('svg', { class: 'chart donut dn', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': aria || parts.map((p) => `${p.label} ${fmt.pct(p.value / total)}`).join(', ') })
    const num = h('text', { class: 'donut-num', x: c, y: c + 2, 'text-anchor': 'middle' }, center.num)
    const cap = h('text', { class: 'donut-cap', x: c, y: c + 20, 'text-anchor': 'middle' }, center.cap)
    svg.append(num, cap)
    const slices = []
    const rows = []
    const focus = (j) => {
      const i = j ?? pick ?? null
      const p = i == null ? null : parts[i]
      slices.forEach((el, k) => el?.classList.toggle('is-dim', i != null && k !== i))
      rows.forEach((el, k) => el.classList.toggle('is-on', k === i))
      num.textContent = p ? fmt.pct(p.value / total) : center.num
      cap.textContent = p ? (p.label.length > 22 ? `${p.label.slice(0, 21)}…` : p.label) : center.cap
    }
    let a = 0
    parts.forEach((p, i) => {
      const span = total ? (p.value / total) * 2 * Math.PI : 0
      if (p.value > 0) {
        const slice = h('path', { class: 'dn-slice', d: arc(a, a + span), fill: p.color, tabindex: 0, 'aria-label': `${p.label}: ${fmt.pct(p.value / total)}` })
        slice.addEventListener('pointerenter', () => focus(i))
        slice.addEventListener('pointerleave', () => focus(null))
        slice.addEventListener('focus', () => focus(i))
        slice.addEventListener('blur', () => focus(null))
        slices[i] = slice
        svg.insertBefore(slice, num)
      }
      a += span
    })
    const legend = h('ul', { class: 'rows dn-legend' }, parts.map((p, i) => {
      const li = h('li', { class: 'dn-row' }, h('span', { class: 'dn-dot', style: `background:${p.color}`, 'aria-hidden': 'true' }), h('span', { class: 'row-name' }, p.label), h('span', { class: 'row-value' }, p.text))
      li.addEventListener('pointerenter', () => focus(i))
      li.addEventListener('pointerleave', () => focus(null))
      rows[i] = li
      return p.tip ? UI.withTip(li, p.tip) : li
    }))
    focus(null)
    return h('div', { class: `donut-wrap dn-wrap${stack ? ' dn-stack' : ''}` }, svg, legend)
  }

  // Sunburst: two rings and a legend. rings: [{ label, value, color, tip, children: [{ key, label, value, color, tip }] }], the inner ring is the first level and its children are the outer ring,
  // from the top, clockwise. A child key is a legend key: a legend row, or a slice of the outer ring, dims the outer slices with another key. legend: [{ key, label, color, text, tip }].
  // The tooltips are white cards. center: { num, cap }.
  function Sunburst ({ rings, legend, center, size = 260, aria }) {
    const total = rings.reduce((a, r) => a + r.value, 0)
    const c = size / 2
    const R = c - 4
    const inner = [R * 0.34, R * 0.6]
    const outer = [R * 0.63, R]
    const arc = (a0, a1, [r0, r1]) => {
      a0 += 0.006
      a1 = Math.max(a0 + 0.002, a1 - 0.006)
      const p = (a, r) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
      const large = a1 - a0 > Math.PI ? 1 : 0
      return `M${p(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`
    }
    const svg = h('svg', { class: 'chart donut dn dn-sun', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': aria || rings.map((r) => `${r.label} ${fmt.pct(r.value / total)}`).join(', ') })
    const num = h('text', { class: 'donut-num', x: c, y: c + 2, 'text-anchor': 'middle' }, center.num)
    const cap = h('text', { class: 'donut-cap', x: c, y: c + 18, 'text-anchor': 'middle' }, center.cap)
    svg.append(num, cap)
    const outers = []
    const rows = new Map()
    const dim = (keep) => {
      outers.forEach((o) => o.el.classList.toggle('is-dim', keep != null && !keep(o)))
      rows.forEach((li, k) => li.classList.toggle('is-on', keep != null && outers.some((o) => o.key === k && keep(o))))
    }
    const tip = (el, text, enter, leave) => {
      const show = (e) => UI.showTooltip(text, e.clientX, e.clientY)
      el.addEventListener('pointerenter', (e) => { show(e); enter() })
      el.addEventListener('pointermove', show)
      el.addEventListener('pointerleave', () => { UI.hideTooltip(); leave() })
      return el
    }
    let a = 0
    rings.forEach((r, ri) => {
      const span = Math.min(total ? (r.value / total) * 2 * Math.PI : 0, 2 * Math.PI - 0.02)
      svg.insertBefore(tip(h('path', { class: 'dn-slice', d: arc(a, a + span, inner), fill: r.color }), r.tip, () => dim((o) => o.ring === ri), () => dim(null)), num)
      let b = a
      r.children.forEach((ch) => {
        const sp = total ? Math.min((ch.value / total) * 2 * Math.PI, 2 * Math.PI - 0.02) : 0
        if (ch.value > 0) {
          const el = h('path', { class: 'dn-slice', d: arc(b, b + sp, outer), fill: ch.color })
          outers.push({ el, key: ch.key, ring: ri })
          svg.insertBefore(tip(el, ch.tip, () => dim((o) => o.key === ch.key), () => dim(null)), num)
        }
        b += sp
      })
      a += span
    })
    const list = h('ul', { class: 'rows dn-legend' }, legend.map((l) => {
      const li = h('li', { class: 'dn-row' }, h('span', { class: 'dn-dot', style: `background:${l.color}`, 'aria-hidden': 'true' }), h('span', { class: 'row-name' }, l.label), h('span', { class: 'row-value' }, l.text))
      li.addEventListener('pointerenter', () => dim((o) => o.key === l.key))
      li.addEventListener('pointerleave', () => dim(null))
      rows.set(l.key, li)
      return l.tip ? UI.withTip(li, l.tip) : li
    }))
    return h('div', { class: 'donut-wrap dn-wrap' }, svg, list)
  }

  window.Dash = { Donut, Sunburst, LinesChart, StoryFlow, stateContent, select, fit, reset, niceStep, pct0, get SLOTS () { return slots() }, get NO_GROUP () { return color('--cat-0') }, color, seq, groupColors, groupColor, textOn, tint, Spark, card, cardHead, Info, emptyText, cardState, cardFoot, Stat, TopBar }
})()
