// Shared components of the prototypes. Names and props follow knowledge_base/redesign/shared-components.md.
(function () {
  const params = new URLSearchParams(location.search)

  // Language: Greek is the default. ?lang=en or the switch changes it.
  function readStoredLocale () {
    try { return localStorage.getItem('apotypos-locale') } catch { return null }
  }
  function storeLocale (value) {
    try { localStorage.setItem('apotypos-locale', value) } catch { /* storage is not available */ }
  }
  let locale = params.get('lang') || readStoredLocale() || 'el'
  if (!window.MESSAGES[locale]) locale = 'el'

  function t (key, values = {}) {
    const text = window.MESSAGES[locale][key] ?? window.MESSAGES.el[key] ?? key
    return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '')
  }

  // Numbers always use the Greek style (C12). Dates follow the active language.
  const intFormat = new Intl.NumberFormat('el-GR')
  const pctFormat = new Intl.NumberFormat('el-GR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const decFormat = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const signedFormat = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' })
  const fmt = {
    int: (n) => intFormat.format(n),
    pct: (n) => pctFormat.format(n),
    dec: (n) => decFormat.format(n),
    signed: (n) => signedFormat.format(n).replace('-', '−'),
    date: (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
      new Intl.DateTimeFormat(locale === 'el' ? 'el-GR' : 'en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')),
    period: (from, to) => t('period.text', { from: fmt.date(from), to: fmt.date(to) })
  }

  // The rule for an API answer: each call gives data, empty, notFound or failed.
  // ?state=empty, ?state=error, ?state=notfound and ?state=bad (the body {}) simulate the other results.
  function load (key, required, rowsOf) {
    const state = params.get('state')
    if (state === 'error') return { kind: 'failed' }
    if (state === 'notfound') return { kind: 'notFound' }
    const body = state === 'bad' ? {} : window.FIXTURES?.[key]
    if (!body || typeof body !== 'object') return { kind: 'failed' }
    if (!required.every((field) => body[field] !== null && body[field] !== undefined)) return { kind: 'failed' }
    let rows
    try { rows = rowsOf(body) } catch { return { kind: 'failed' } }
    if (!Array.isArray(rows)) return { kind: 'failed' }
    if (state === 'empty' || rows.length === 0) return { kind: 'empty', data: body }
    return { kind: 'data', data: body }
  }

  // A small element builder. Children can be strings, nodes, arrays or null.
  function h (tag, props = {}, ...children) {
    const svg = ['svg', 'g', 'rect', 'line', 'text', 'path', 'title', 'desc', 'circle', 'clipPath', 'defs'].includes(tag)
    const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag)
    for (const [name, value] of Object.entries(props || {})) {
      if (value === null || value === undefined || value === false) continue
      if (name.startsWith('on')) el.addEventListener(name.slice(2).toLowerCase(), value)
      else if (name === 'class') el.setAttribute('class', value)
      else if (name === 'style' && typeof value === 'object') Object.assign(el.style, value)
      else if (name === 'html') el.innerHTML = value
      else el.setAttribute(name, value === true ? '' : value)
    }
    append(el, children)
    return el
  }
  function append (el, children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue
      el.append(child instanceof Node ? child : document.createTextNode(String(child)))
    }
  }

  // Only http and https links from the data. A javascript: URL in the data never becomes a link.
  function safeUrl (url) {
    try { return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null } catch { return null }
  }

  function Icon (name, cls = 'icon') {
    const el = h('svg', { class: cls, viewBox: '0 0 24 24', fill: 'none', 'stroke-width': '1.5', stroke: 'currentColor', 'aria-hidden': 'true', 'data-icon': name })
    el.innerHTML = window.ICONS[name] || ''
    return el
  }

  // meta: a factual line under the title (period, counts, update date). It replaces a hint that gives instructions.
  function PageHeader ({ kicker, title, hint, meta, controls, updatedAt }) {
    const updated = updatedAt && h('span', { class: 'updated-at', 'data-testid': 'updated-at' }, t('range.updated', { date: fmt.date(updatedAt) }))
    const metaItems = meta ? [...meta, updated].filter(Boolean) : null
    return h('header', { class: 'page-header' },
      kicker && h('p', { class: 'page-kicker' }, kicker),
      h('h1', { class: 'page-title' }, title),
      hint && h('p', { class: 'page-hint' }, hint),
      metaItems && h('p', { class: 'page-meta' }, metaItems.map((m, i) => [i > 0 && h('span', { class: 'sep', 'aria-hidden': 'true' }, '·'), m])),
      (controls || (updatedAt && !meta)) && h('div', { class: 'page-controls' },
        controls,
        !meta && updated))
  }

  function SegmentedControl ({ options, value, label, onChange }) {
    return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
      options.map((o) => h('button', { type: 'button', 'aria-pressed': String(o.value === value), onClick: () => onChange(o.value) }, o.label)))
  }

  // RangeControl: presets and two day lists. No native date input (G23).
  function RangeControl ({ dates, from, to, presets, onChange }) {
    const preset = presets.find((p) => p.from === from && p.to === to)?.key ?? null
    const invalid = from > to
    const daySelect = (label, value, which) => h('label', { class: 'field' }, label,
      h('select', { onChange: (e) => onChange(which === 'from' ? { from: e.target.value, to } : { from, to: e.target.value }) },
        dates.map((d) => h('option', { value: d, selected: d === value }, fmt.date(d)))))
    return h('div', { class: 'range-control', 'data-testid': 'range-control' },
      h('div', { class: 'field' }, t('range.label'),
        SegmentedControl({ options: presets.map((p) => ({ value: p.key, label: p.label })), value: preset, label: t('range.label'), onChange: (key) => { const p = presets.find((x) => x.key === key); onChange({ from: p.from, to: p.to }) } })),
      h('div', { class: 'range-fields' }, daySelect(t('range.from'), from, 'from'), daySelect(t('range.to'), to, 'to')),
      invalid && h('p', { class: 'range-error', role: 'alert' }, t('range.invalid')))
  }

  // The presets of the data window 2026-08-01 to 2026-09-30.
  function periodPresets () {
    return [
      { key: 'all', label: t('range.all'), from: '2026-08-01', to: '2026-09-30' },
      { key: 'aug', label: t('range.aug'), from: '2026-08-01', to: '2026-08-31' },
      { key: 'sep', label: t('range.sep'), from: '2026-09-01', to: '2026-09-30' },
      { key: 'last14', label: t('range.last14'), from: '2026-09-17', to: '2026-09-30' }
    ]
  }

  function FilterBar (...controls) {
    return h('div', { class: 'filter-bar' }, controls)
  }

  function KpiStrip (tiles) {
    return h('section', { class: 'kpi-strip', style: { '--kpi-count': String(tiles.length) }, 'aria-label': 'KPI' }, tiles)
  }

  // KpiTile: kpiId is an approved KPI or "kept". emptyText is required.
  function KpiTile ({ kpiId, label, value, hint, emptyText, change, state = 'ready', extra }) {
    if (!emptyText) throw new Error(`KpiTile ${kpiId} has no emptyText`)
    const body = state === 'loading'
      ? h('div', { class: 'skeleton', style: { height: '40px' } })
      : state === 'empty'
        ? h('p', { class: 'kpi-empty' }, emptyText)
        : state === 'error'
          ? h('p', { class: 'kpi-empty' }, t('state.failed'))
          : [value !== '' && h('p', { class: 'kpi-value' }, value), change && h('span', { class: 'kpi-change' }, change), extra]
    return h('article', { class: 'kpi-tile', 'data-kpi': kpiId, 'data-state': state },
      h('h2', { class: 'kpi-label' }, label), body, state !== 'empty' && state !== 'error' && hint && h('p', { class: 'kpi-hint' }, hint))
  }

  function ChartCard ({ title, note, body, footnote, id }) {
    return h('section', { class: 'card', id },
      h('h2', { class: 'card-title' }, title),
      note && h('p', { class: 'card-note' }, note),
      body,
      footnote && h('p', { class: 'card-footnote' }, footnote))
  }

  function EmptyState ({ text, action }) {
    return h('div', { class: 'empty-state', 'data-state': 'empty' }, Icon('inbox'), h('p', { style: { margin: 0 } }, text), action)
  }

  function ErrorState ({ text = t('state.failed'), onRetry }) {
    return h('div', { class: 'error-state', role: 'alert', 'data-state': 'error' }, Icon('exclamation-triangle'), h('p', { style: { margin: 0 } }, text),
      onRetry && h('button', { type: 'button', class: 'button', onClick: onRetry }, Icon('arrow-path', 'icon icon-sm'), t('state.retry')))
  }

  function ErrorPage ({ status }) {
    document.title = `${t(`error.${status}.title`)} · ${t('site.name')}`
    return h('section', { class: 'error-page', 'data-state': `error-${status}` },
      h('p', { class: 'error-code' }, String(status)),
      h('h1', { class: 'page-title' }, t(`error.${status}.title`)),
      h('p', { class: 'page-hint' }, t(`error.${status}.text`)),
      h('p', {}, h('a', { class: 'button', href: 'index.html' }, t('error.home')), ' ', h('a', { class: 'button', href: 'pages.html' }, t('error.pages'))))
  }

  function DataNotice ({ text }) {
    return h('p', { class: 'data-notice', role: 'note' }, Icon('exclamation-triangle'), text)
  }

  function FactList (facts) {
    return h('dl', { class: 'fact-list' }, facts.map((f) => [h('dt', {}, f.label), h('dd', {}, f.value)]))
  }

  // Bars (#54). Every bar of every page comes from the components below, with one spec:
  // - A horizontal bar is 8 px high with round ends (4 px) on a track of --bar-track. The fill is --bar-fill,
  //   or the color of the data (a group, a party, a stance, a side). A reference value (an average) is a tick of 2 px.
  // - The parts of a stacked bar have a gap of 2 px. A diverging bar grows to both sides of a center line of 2 px.
  // - A column is 70% of its slot and 32 px wide at most, with round top corners (4 px). The parts of a stacked column have a gap of 1 px.
  // - The value axis has 4 to 5 grid lines and 12 px labels on the left. A date axis keeps 64 px or more between two labels.
  // - The caller formats the values (fmt.int for counts, fmt.pct for shares). In a list the value is on the line of the label,
  //   on the right, and the bar is under them; in a list 440 px wide or more the bar is between them (#60). In a table cell the value is on the left of the bar.
  // - Each chart shows what it says (#60): a column chart labels its highest column, and a reference value (an average) is a tick or a dashed line with its key.
  // - Hover shows the shared tooltip. The same text is the label for a screen reader.
  // - Legend: Legend() above the bars, a swatch of 10 px for each color.
  // - Empty: a value of 0 shows the track only. A stacked bar under minN shows a text. A chart with no value is the page's EmptyState.
  function withTip (el, text) {
    if (!text) return el
    el.setAttribute('aria-label', text)
    const show = (e) => showTooltip(text, e.clientX, e.clientY)
    el.addEventListener('pointerenter', show)
    el.addEventListener('pointermove', show)
    el.addEventListener('pointerleave', hideTooltip)
    return el
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v || 0))
  const pctOfMax = (v, max) => `${clamp01(v / (max || 1)) * 100}%`

  // Legend: a swatch and a name for each color of a chart. items: [{ label, color }], or { label, tick: true } for the marker of a reference value.
  function Legend (items) {
    return h('ul', { class: 'legend' }, items.map((i) => h('li', {}, i.tick ? h('span', { class: 'swatch-tick' }) : h('span', { class: 'swatch', style: { background: i.color } }), i.label)))
  }

  // HBar: one value on a track. color: the color of the data. marker: a reference value on the same scale, as a tick.
  // text: the value in a table cell, on the left of the bar. label: the tooltip and the text for a screen reader.
  function HBar (value, max = 1, { color, marker, text, label } = {}) {
    const fill = h('div', { class: 'hbar-fill', style: color ? { width: pctOfMax(value, max), background: color } : { width: pctOfMax(value, max) } })
    const bar = h('div', { class: 'hbar', role: label ? 'img' : null },
      text !== undefined && h('span', { class: 'bar-value' }, text),
      h('div', { class: 'hbar-track' }, fill, marker !== undefined && h('span', { class: 'bar-marker', style: { left: pctOfMax(marker, max) } })))
    return withTip(bar, label)
  }

  // StackedBar: the parts of one whole. segments: [{ label, value, color }].
  // legend: false in a row or a table cell. minN: under this total the bar is a text. marker: a share of the whole, as a tick.
  function StackedBar (segments, { legend = true, minN = 0, marker, label } = {}) {
    const total = segments.reduce((s, x) => s + (x.value || 0), 0)
    if (minN && total < minN) return h('span', { class: 'bar-empty' }, t('stance.few', { n: minN }))
    const share = (s) => fmt.pct(total ? s.value / total : 0)
    const text = label ?? segments.map((s) => `${s.label} ${share(s)}`).join(', ')
    const bar = withTip(h('div', { class: total ? 'stacked' : 'stacked is-empty', role: 'img' },
      segments.filter((s) => s.value > 0).map((s) => h('span', { style: { width: `${(s.value / total) * 100}%`, background: s.color } })),
      marker !== undefined && h('span', { class: 'bar-marker', style: { left: `${clamp01(marker) * 100}%` } })), text)
    return legend ? h('div', { class: 'stacked-wrap' }, bar, Legend(segments.map((s) => ({ label: `${s.label} ${share(s)}`, color: s.color })))) : bar
  }

  // DivergingBar: shares on the two sides of a center line. middle: a share across the line (the neutral stance), half on each side.
  // scale: the value that fills half of the track. colors: [left, middle, right]. faint: a value from few articles.
  // marker: a reference value as a tick, on the same scale, negative to the left of the center line.
  const STANCE_COLORS = ['var(--stance-critical)', 'var(--stance-neutral)', 'var(--stance-supportive)']
  function DivergingBar ({ left = 0, middle = 0, right = 0, scale = 1, colors = STANCE_COLORS, label, faint = false, marker }) {
    const half = (v) => Math.min(50, (Math.max(0, v) / (scale || 1)) * 50)
    const m = half(middle / 2)
    const l = Math.min(half(left), 50 - m)
    const r = Math.min(half(right), 50 - m)
    // The outer end of a part is round, the end at the center line or at the next part is square, as in StackedBar.
    const seg = (from, width, color, ends) => (width > 0 ? h('span', { class: ['dbar-seg', ...ends.map((e) => `is-${e}`)].join(' '), style: { left: `${from}%`, width: `${width}%`, background: color } }) : null)
    return withTip(h('div', { class: faint ? 'dbar is-faint' : 'dbar', role: label ? 'img' : null },
      seg(50 - m - l, l, colors[0], ['left']), seg(50 - m, 2 * m, colors[1], [!l && 'left', !r && 'right'].filter(Boolean)), seg(50 + m, r, colors[2], ['right']),
      h('span', { class: 'dbar-mid' }),
      marker !== undefined && h('span', { class: 'bar-marker', style: { left: `${50 + Math.sign(marker) * half(Math.abs(marker))}%` } })), label)
  }

  // BarGroup: two or more values to compare, one bar each, on one scale. bars: [{ value, color, label }].
  function BarGroup (bars, max) {
    return h('div', { class: 'bar-group' }, bars.map((b) => HBar(b.value, max, { color: b.color, label: b.label })))
  }

  // BarList: rows with a label, a value on the right and a bar under them. In a list 440 px wide or more (app.css), the bar is
  // between the label and the value, on the same line, and the bars of all rows start and end at the same place.
  // rows: [{ label, sub, value, text, color, marker, tip, bar, bars, cls, title, onClick, pressed }]. text: the value as shown (fmt.int of value if none).
  // onClick: the row is a button that picks a filter, pressed when the filter is on.
  // bar: another bar of this file (a DivergingBar, a StackedBar). bars: [{ value, color, label }], two or more values to compare, one bar each.
  // reference: { value, label }, a reference value (an average) as a tick on each bar of one value, with its key above the list (none without a label).
  // columns: a long list runs in this number of columns, side by side where they fit (360 px or more each), one under the other where not.
  function BarList (rows, { max, cls, reference, columns } = {}) {
    const top = max ?? Math.max(...rows.flatMap((r) => (r.bars ? r.bars.map((b) => b.value) : [r.value || 0])), reference ? reference.value : 0, 1)
    const button = (r) => (r.onClick ? { tabindex: 0, role: 'button', 'aria-pressed': r.pressed === undefined ? null : String(r.pressed), onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.onClick() } } } : {})
    const list = (part) => h('div', { class: 'bar-box' }, h('ul', { class: cls ? `bar-list ${cls}` : 'bar-list' }, part.map((r) => h('li', { class: [r.cls, r.onClick && 'is-pick', r.pressed && 'is-picked'].filter(Boolean).join(' ') || null, onClick: r.onClick, title: r.title, ...button(r) },
      h('span', { class: 'row-name', title: typeof r.label === 'string' ? r.label : null }, r.label, r.sub ? h('span', { class: 'row-sub' }, r.sub) : null),
      h('span', { class: 'row-value' }, r.text ?? fmt.int(r.value)),
      r.bar ?? (r.bars
        ? BarGroup(r.bars, top)
        : HBar(r.value, top, { color: r.color, marker: r.marker ?? reference?.value, label: r.tip }))))))
    const size = columns > 1 ? Math.ceil(rows.length / columns) : rows.length
    const parts = []
    for (let i = 0; i < rows.length || !parts.length; i += size || 1) parts.push(rows.slice(i, i + size))
    const body = parts.length > 1 ? h('div', { class: 'bar-cols' }, parts.map(list)) : list(parts[0])
    return reference?.label ? h('div', { class: 'bar-list-wrap' }, Legend([{ label: reference.label, tick: true }]), body) : body
  }

  // A column with phone: false is hidden below 640 px.
  const cellClass = (c) => [c.num && 'num', c.phone === false && 'hide-phone'].filter(Boolean).join(' ') || null

  // DataTable: the first 10 rows, and a control for the rest (C07, G19). With moreStep, the control adds that number of rows each time (APO-180).
  // A column with sortable: true has a sort button in its header. sortValue(row) is the value (default row[sortKey]); no value (null, NaN) always sorts last.
  // The first click sorts high to low, the second low to high. sort: { key, dir } is the order at first ('desc' or 'asc'). The rank column follows the sort.
  function DataTable ({ columns, rows, rankColumn = false, pageSize = 10, moreStep = 0, caption, emptyText, emptyAction, rowId, sort }) {
    if (rows.length === 0) return EmptyState({ text: emptyText, action: emptyAction })
    let expanded = false
    let shown = pageSize
    let order = sort ? { key: sort.key, dir: sort.dir || 'desc' } : null
    const keyOf = (c, i) => c.sortKey ?? c.key ?? String(i)
    const valueOf = (c, row) => (c.sortValue ? c.sortValue(row) : row[c.sortKey ?? c.key])
    const isNone = (v) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))
    const sorted = () => {
      const col = order && columns.find((c, i) => c.sortable && keyOf(c, i) === order.key)
      if (!col) return rows
      const sign = order.dir === 'asc' ? 1 : -1
      return rows.slice().sort((a, b) => {
        const x = valueOf(col, a)
        const y = valueOf(col, b)
        if (isNone(x) || isNone(y)) return isNone(x) && isNone(y) ? 0 : isNone(x) ? 1 : -1
        return sign * (typeof x === 'string' ? x.localeCompare(y, App.locale) : x - y)
      })
    }
    const wrap = h('div', moreStep ? { tabindex: '-1' } : {})
    const head = (c, i) => {
      if (!c.sortable) return h('th', { scope: 'col', class: cellClass(c) }, c.label)
      const key = keyOf(c, i)
      const active = order?.key === key
      return h('th', { scope: 'col', class: cellClass(c), 'aria-sort': active ? (order.dir === 'asc' ? 'ascending' : 'descending') : null },
        h('button', { type: 'button', class: 'sort-button', 'data-sort': key, onClick: () => { order = { key, dir: active && order.dir === 'desc' ? 'asc' : 'desc' }; render(); wrap.querySelector(`[data-sort="${key}"]`)?.focus() } },
          c.label, h('span', { class: 'sort-arrow', 'aria-hidden': 'true' }, active ? (order.dir === 'asc' ? '↑' : '↓') : '')))
    }
    const render = () => {
      const list = sorted()
      const visible = moreStep ? list.slice(0, shown) : expanded ? list : list.slice(0, pageSize)
      const table = h('table', { class: 'data-table' },
        caption && h('caption', {}, caption),
        h('thead', {}, h('tr', {}, rankColumn && h('th', { class: 'rank', scope: 'col' }, t('table.rank')),
          columns.map(head))),
        h('tbody', {}, visible.map((row, i) => h('tr', { id: rowId ? rowId(row) : null },
          rankColumn && h('td', { class: 'rank' }, String(i + 1)),
          columns.map((c) => h('td', { class: cellClass(c) }, c.render ? c.render(row) : row[c.key]))))))
      wrap.replaceChildren(h('div', { class: 'table-wrap' }, table),
        moreStep
          ? (shown >= rows.length ? '' : h('div', { class: 'table-more' },
            h('button', { type: 'button', class: 'button', onClick: () => { shown += moreStep; render(); (wrap.querySelector('.table-more button') || wrap).focus() } },
              t('table.step', { n: fmt.int(Math.min(moreStep, rows.length - shown)) }))))
          : rows.length <= pageSize ? '' : h('div', { class: 'table-more' },
            h('button', { type: 'button', class: 'button', 'aria-expanded': String(expanded), onClick: () => { expanded = !expanded; render() } },
              expanded ? t('table.less') : t('table.more', { n: fmt.int(rows.length) }))))
    }
    render()
    return wrap
  }

  // Tooltip shared by the charts.
  let tooltip
  function showTooltip (text, x, y) {
    tooltip ||= document.body.appendChild(h('div', { class: 'tooltip', role: 'status' }))
    tooltip.textContent = text
    tooltip.hidden = false
    const box = tooltip.getBoundingClientRect()
    tooltip.style.left = `${Math.min(window.innerWidth - box.width - 8, Math.max(8, x - box.width / 2))}px`
    tooltip.style.top = `${Math.max(8, y - box.height - 12)}px`
  }
  function hideTooltip () { if (tooltip) tooltip.hidden = true }

  // BarChart: columns. values: one series, or series: [{ name, color, values }], stacked from the bottom.
  // dates: the columns are days, with a label each 64 px or more. labels: the columns are categories, each with its label.
  // below: a second line of label under each column, in HTML, so it wraps. axisLabel: the name of the axis under the labels.
  // topLabels: a short value above each column (a share). tooltipOf(i): the text of column i, for the tooltip and the table for a screen reader. It draws at the real width, so the 12 px labels never scale down.
  // Variants with a real need: max (a fixed top, 1 for shares), colorOf(i) (a column in another color), markers (a number above a column),
  // muted(i) (outside the chosen period), flagged(i) (a gap in the data), onPick(n)/picked (a click on a column picks it),
  // onSelect({ from, to }) (a drag over the days picks a period), minWidth (below 720 px the chart keeps this width and scrolls).
  // The highest column has its value above it (peak: false leaves it out, topLabels replace it). reference: { value, label }, a reference value
  // (an average, the previous period) as a dashed line across the columns, with its label on the right of the columns.
  function BarChart ({ values, series, dates, labels, below, axisLabel, height = 220, label, tooltipOf, valueFormat = fmt.int, max, colorOf, topLabels, markers = {}, muted, flagged, picked = null, onPick, onSelect, minWidth, peak = true, reference }) {
    const n = (dates || labels).length
    const parts = series || [{ name: label, values }]
    const totals = Array.from({ length: n }, (_, i) => parts.reduce((a, s) => a + (s.values[i] || 0), 0))
    const tipOf = tooltipOf || ((i) => `${dates ? fmt.date(dates[i]) : labels[i]}: ${valueFormat(totals[i])}`)
    const holder = h('div', { class: 'chart-holder', style: minWidth ? `--chart-min:${minWidth}px` : null })
    // A pick shows at once. The page can draw the chart again with its own state.
    let sel = picked
    const draw = () => {
      // A fractional width rounds up in clientWidth, so the drawing would shrink below 12 px. Round down.
      const width = Math.floor(holder.getBoundingClientRect().width)
      if (!width) return
      const hasMarks = Object.keys(markers).length > 0
      // The peak: the highest total, on up to 3 columns that share it.
      const highest = Math.max(...totals)
      const peaks = peak && !topLabels && highest > 0 ? totals.map((v, i) => (v === highest ? i : -1)).filter((i) => i >= 0) : []
      const peakAt = new Set(peaks.length <= 3 ? peaks : peaks.slice(0, 1))
      const pad = { top: (hasMarks ? 26 : 0) + (topLabels || peakAt.size ? 18 : 0) + CHART_FRAME.top, right: reference ? Math.max(CHART_FRAME.right, String(reference.label).length * 7 + 10) : CHART_FRAME.right, bottom: axisLabel ? CHART_FRAME.bottom + 16 : CHART_FRAME.bottom, left: CHART_FRAME.left }
      const step = niceStep((max ?? Math.max(...totals, 1)) / 4)
      const top = max ?? Math.ceil(Math.max(...totals, 1) / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const slot = plotW / n
      const w = Math.max(1, Math.min(CHART_FRAME.barMax, slot * 0.7))
      const r = Math.min(CHART_FRAME.barRadius, w / 2)
      const y = (v) => pad.top + plotH - (Math.min(v, top) / top) * plotH
      const uid = Math.random().toString(36).slice(2, 7)
      const svg = h('svg', { class: 'chart bar-chart', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' })
      for (let v = 0; v <= top + step / 2; v += step) {
        svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }),
          h('text', { x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, valueFormat(v)))
      }
      // Dates: 64 px or more between two labels, and a label each week (7, 14 days) on more than 20 days.
      // Categories: each label, or fewer labels when the longest one (about 7 px a letter at 12 px) does not fit its slot.
      const dateStep = Math.ceil(CHART_FRAME.labelEvery / slot)
      const every = dates ? (n > 20 ? Math.ceil(dateStep / 7) * 7 : dateStep) : Math.max(1, Math.ceil((Math.max(...labels.map((l) => String(l).length)) * 7 + 12) / slot))
      const cols = []
      for (let i = 0; i < n; i++) {
        const x = pad.left + i * slot
        const bx = x + (slot - w) / 2
        if (flagged && flagged(i)) svg.append(h('rect', { class: 'bar-flag', x: x + 1, y: pad.top, width: Math.max(1, slot - 2), height: plotH }))
        const dim = (muted && muted(i)) || (sel !== null && sel !== i)
        const col = h('g', { class: dim ? 'bar-col is-muted' : 'bar-col' })
        if (totals[i] > 0) {
          // The column has round top corners (a clip path) and a gap of 1 px between its parts.
          const yt = y(totals[i])
          const yb = y(0)
          const clip = `bc-${uid}-${i}`
          svg.append(h('defs', {}, h('clipPath', { id: clip }, h('path', { d: `M${bx} ${yb}V${yt + r}Q${bx} ${yt} ${bx + r} ${yt}H${bx + w - r}Q${bx + w} ${yt} ${bx + w} ${yt + r}V${yb}Z` }))))
          col.setAttribute('clip-path', `url(#${clip})`)
          let base = 0
          parts.forEach((s) => {
            const v = s.values[i] || 0
            if (!v) return
            const gap = base + v < totals[i] ? 1 : 0
            col.append(h('rect', { x: bx, y: y(base + v), width: w, height: Math.max(0.5, y(base) - y(base + v) - gap), fill: s.color || (colorOf && colorOf(i)) || 'var(--bar-fill)' }))
            base += v
          })
        }
        svg.append(col)
        cols.push(col)
        if (topLabels && topLabels[i]) svg.append(h('text', { class: 'bar-top', x: x + slot / 2, y: y(totals[i]) - 6, 'text-anchor': 'middle' }, topLabels[i]))
        // The value of the peak stays inside the plot when its column is at an edge.
        if (peakAt.has(i) && markers[i] === undefined) svg.append(h('text', { class: 'bar-top', x: Math.min(width - pad.right, Math.max(pad.left, x + slot / 2)), y: y(totals[i]) - 6, 'text-anchor': x + slot / 2 < pad.left + 16 ? 'start' : x + slot / 2 > width - pad.right - 16 ? 'end' : 'middle' }, valueFormat(totals[i])))
        if (markers[i] !== undefined) {
          const cy = y(totals[i]) - (topLabels && topLabels[i] ? 30 : 13)
          svg.append(h('circle', { class: 'bar-mark', cx: x + slot / 2, cy, r: 9 }), h('text', { class: 'bar-mark-text', x: x + slot / 2, y: cy + 4, 'text-anchor': 'middle' }, String(markers[i])))
        }
        if (i % every === 0) {
          const text = dates ? fmt.date(dates[i], { day: 'numeric', month: 'short' }) : labels[i]
          svg.append(h('text', { class: sel === i ? 'is-picked' : null, x: x + slot / 2, y: pad.top + plotH + CHART_FRAME.labelGap, 'text-anchor': 'middle' }, text))
        }
      }
      if (reference && reference.value > 0) {
        const ry = y(reference.value)
        svg.append(h('line', { class: 'bar-ref', x1: pad.left, x2: width - pad.right, y1: ry, y2: ry }),
          h('text', { class: 'bar-ref-text', x: width - pad.right + 6, y: ry + 4, 'text-anchor': 'start' }, reference.label))
      }
      if (axisLabel) svg.append(h('text', { class: 'axis-title', x: pad.left + plotW / 2, y: height - 4, 'text-anchor': 'middle' }, axisLabel))
      const indexAt = (e) => Math.min(n - 1, Math.max(0, Math.floor((e.clientX - svg.getBoundingClientRect().left - pad.left) / slot)))
      const hover = h('rect', { class: 'bar-hover', x: 0, y: pad.top, width: slot, height: plotH, visibility: 'hidden' })
      const band = h('rect', { class: 'bar-band', x: 0, y: pad.top, width: 0, height: plotH, visibility: 'hidden' })
      svg.prepend(hover, band)
      const showAt = (e) => { const i = indexAt(e); hover.setAttribute('x', pad.left + i * slot); hover.setAttribute('visibility', 'visible'); showTooltip(tipOf(i), e.clientX, e.clientY); return i }
      const leave = () => { hover.setAttribute('visibility', 'hidden'); hideTooltip() }
      if (onPick) {
        // Each column is a button, so the keyboard can pick it.
        for (let i = 0; i < n; i++) {
          const hit = h('rect', { class: 'bar-hit', x: pad.left + i * slot, y: pad.top, width: slot, height: plotH + 20, tabindex: 0, role: 'button', 'aria-pressed': String(sel === i), 'aria-label': tipOf(i) })
          hit.addEventListener('pointermove', showAt)
          hit.addEventListener('pointerleave', leave)
          const pick = (byKey) => { sel = i; draw(); if (byKey) holder.querySelectorAll('.bar-hit')[i]?.focus(); onPick(i) }
          hit.addEventListener('click', () => pick(false))
          hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(true) } })
          svg.append(hit)
        }
        svg.removeAttribute('aria-hidden')
        svg.setAttribute('role', 'group')
        svg.setAttribute('aria-label', label)
      } else {
        const overlay = h('rect', { class: onSelect ? 'bar-hit is-select' : 'bar-hit', x: pad.left, y: pad.top, width: plotW, height: plotH })
        let anchor = null
        overlay.addEventListener('pointermove', (e) => {
          const i = showAt(e)
          if (anchor === null) return
          const lo = Math.min(anchor, i)
          band.setAttribute('x', pad.left + lo * slot)
          band.setAttribute('width', (Math.max(anchor, i) - lo + 1) * slot)
          band.setAttribute('visibility', 'visible')
        })
        overlay.addEventListener('pointerleave', leave)
        if (onSelect) {
          overlay.addEventListener('pointerdown', (e) => { anchor = indexAt(e); overlay.setPointerCapture(e.pointerId) })
          overlay.addEventListener('pointerup', (e) => {
            const i = indexAt(e)
            const a = anchor
            anchor = null
            leave()
            band.setAttribute('visibility', 'hidden')
            if (a !== null && a !== i) onSelect({ from: dates[Math.min(a, i)], to: dates[Math.max(a, i)] })
          })
          overlay.addEventListener('pointercancel', () => { anchor = null; band.setAttribute('visibility', 'hidden') })
        }
        svg.append(overlay)
      }
      const nodes = [svg]
      if (below) nodes.push(h('div', { class: 'bar-below', style: { paddingLeft: `${pad.left}px`, paddingRight: `${pad.right}px`, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` } }, below.map((b) => h('span', {}, b))))
      // The same values as a table for a screen reader and the keyboard. The tooltip needs a mouse.
      // A table does not obey the 1 px width of .visually-hidden, so a div holds it.
      if (!onPick) {
        nodes.push(h('div', { class: 'visually-hidden' }, h('table', {}, h('caption', {}, label),
          h('tbody', {}, totals.map((_, i) => h('tr', {}, h('th', { scope: 'row' }, dates ? fmt.date(dates[i]) : labels[i]), h('td', {}, tipOf(i))))))))
      }
      holder.replaceChildren(...nodes)
    }
    requestAnimationFrame(draw)
    new ResizeObserver(() => draw()).observe(holder)
    return minWidth ? h('div', { class: 'chart-scroll' }, holder) : holder
  }
  // A smooth line through the points: a monotone cubic curve (it never swings above or below the points it joins). A gap or a missing value starts a new curve.
  function smoothPath (pts, gapAt) {
    const parts = []
    let seg = []
    pts.forEach((p, i) => {
      if (!p) { if (seg.length) parts.push(seg); seg = []; return }
      if (gapAt.has(i) && seg.length) { parts.push(seg); seg = [] }
      seg.push(p)
    })
    if (seg.length) parts.push(seg)
    const f = (v) => v.toFixed(1)
    return parts.map((s) => {
      const n = s.length
      if (n === 1) return `M${f(s[0][0])} ${f(s[0][1])}`
      const dx = s.slice(1).map((q, i) => q[0] - s[i][0])
      const m = s.slice(1).map((q, i) => (q[1] - s[i][1]) / dx[i])
      const tan = s.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2))
      m.forEach((slope, i) => {
        if (slope === 0) { tan[i] = 0; tan[i + 1] = 0; return }
        const a = tan[i] / slope
        const b = tan[i + 1] / slope
        const k = a * a + b * b
        if (k > 9) { const tau = 3 / Math.sqrt(k); tan[i] = tau * a * slope; tan[i + 1] = tau * b * slope }
      })
      let d = `M${f(s[0][0])} ${f(s[0][1])}`
      for (let i = 0; i < n - 1; i++) d += `C${f(s[i][0] + dx[i] / 3)} ${f(s[i][1] + (tan[i] * dx[i]) / 3)} ${f(s[i + 1][0] - dx[i] / 3)} ${f(s[i + 1][1] - (tan[i + 1] * dx[i]) / 3)} ${f(s[i + 1][0])} ${f(s[i + 1][1])}`
      return d
    }).join('')
  }

  // The frame every chart shares: the plot starts 44 px from the left (the value labels end 6 px before it), the labels of the x axis sit 16 px under the plot, a column is at most 8 px thin.
  const CHART_FRAME = { top: 12, left: 44, bottom: 24, right: 8, labelGap: 16, barMax: 8, barRadius: 3, labelEvery: 64 }
  function niceStep (raw) {
    const p = 10 ** Math.floor(Math.log10(raw || 1))
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10
  }

  // MatrixChart: a diverging scale with a gray middle. Labels do not rotate (C04, G18).
  function MatrixChart ({ rows, columns, cell, legend, caption, rowHeader }) {
    return h('div', {},
      h('div', { class: 'matrix-wrap', tabindex: '0', role: 'region', 'aria-label': caption },
        h('table', { class: 'matrix' },
          h('caption', { class: 'visually-hidden' }, caption),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, rowHeader), columns.map((c) => h('th', { scope: 'col', title: c.title }, c.label)))),
          h('tbody', {}, rows.map((r, ri) => h('tr', {}, h('th', { scope: 'row' }, r.label), columns.map((_, ci) => {
            const c = cell(ri, ci)
            return h('td', { class: c.className, style: { background: c.background, color: c.color }, title: c.title, 'aria-label': c.title }, c.text)
          })))))),
      legend)
  }


  // MiniStance: a StackedBar with no legend, for a table cell. The text alternative gives the shares and the number of articles.
  function MiniStance (segments, minN = 30) {
    const total = segments.reduce((s, x) => s + x.value, 0)
    return StackedBar(segments, { legend: false, minN, label: segments.map((s) => `${s.label} ${fmt.pct(total ? s.value / total : 0)}`).join(', ') + ` · n = ${fmt.int(total)}` })
  }

  // OwnershipMap: two columns, the owner on the left and the outlets on the right. A line joins them.
  // groups: [{ key, title, subtitle, share, outlets: [{ name, href, value, share }] }]. A group with no title is the group without an owner.
  function OwnershipMap ({ groups, max, caption, emptyOwner }) {
    return h('ul', { class: 'owner-map', 'aria-label': caption }, groups.map((g) => h('li', { class: g.title ? 'owner-row' : 'owner-row is-none' },
      h('div', { class: 'owner-node' },
        h('p', { class: 'owner-name' }, g.title ? (g.href ? h('a', { href: g.href }, g.title) : g.title) : emptyOwner),
        g.subtitle && h('p', { class: 'owner-sub' }, g.subtitle),
        h('p', { class: 'owner-share' }, g.shareText)),
      h('ul', { class: 'owner-outlets' }, g.outlets.map((o) => h('li', {},
        h('span', { class: 'outlet-name' }, o.href ? h('a', { href: o.href }, o.name) : o.name),
        h('span', { class: 'outlet-value' }, o.valueText),
        HBar(o.value, max)))))))
  }

  window.App = { t, fmt, load, h, Icon, safeUrl, params, get locale () { return locale }, setLocale (value) { locale = value; storeLocale(value) } }
  // EntityLink (entity-contract.md): the name of an entity as a link to its page. A page that is built has a prototype file.
  // The link to a page that is not built opens the 404 page. A name with no key stays plain text.
  const ENTITY_ROUTES = { outlet: '/outlet/<slug>', group: '/group/<slug>', owner: '/owner/<slug>', topic: '/topic/<slug>', story: '/story/<id>', article: '/article/<id>', person: '/person/<slug>' }
  const ENTITY_PAGES = {
    outlet: (key) => (/^[0-9a-f]{10}$/.test(key) ? `outlet-v2.html?slug=${key}` : null),
    group: (key) => `group-v2.html?g=${encodeURIComponent(key)}`,
    // The Story page opens for the ids of the data. The keys of the entities page are not ids.
    story: (key) => (/^\d+$/.test(key) ? `story-v2.html?id=${key}` : null),
    topic: (key) => (/^\d+$/.test(key) ? `topic-v2.html?i=${key}` : null)
  }
  function EntityLink ({ type, key, label, count, color }) {
    if (!key) return h('span', { class: 'entity-text' }, label)
    const page = ENTITY_PAGES[type] ? ENTITY_PAGES[type](key) : null
    return h('a', {
      class: page ? 'entity-link' : 'entity-link is-missing', href: page || '404.html', 'data-entity': type, 'data-page': page ? 'built' : 'missing',
      title: page ? null : t('entity.link.missing')
    }, color && h('span', { class: 'swatch', style: { background: color } }), label, count !== undefined && h('span', { class: 'entity-count' }, count), !page && h('span', { class: 'visually-hidden' }, ` (${t('entity.link.missing.short')})`))
  }

  window.UI = { EntityLink, ENTITY_ROUTES, PageHeader, SegmentedControl, RangeControl, periodPresets, FilterBar, KpiStrip, KpiTile, ChartCard, EmptyState, ErrorState, ErrorPage, DataNotice, FactList, HBar, Legend, BarGroup, BarList, DivergingBar, STANCE_COLORS, DataTable, BarChart, CHART_FRAME, smoothPath, StackedBar, MiniStance, OwnershipMap, MatrixChart, showTooltip, hideTooltip }
})()
