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
    const svg = ['svg', 'g', 'rect', 'line', 'text', 'path', 'title', 'desc', 'circle'].includes(tag)
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

  function HBar (share, max = 1) {
    return h('div', { class: 'hbar' },
      h('div', { class: 'hbar-track' }, h('div', { class: 'hbar-fill', style: { width: `${Math.max(0, Math.min(1, share / max)) * 100}%` } })))
  }

  // A column with phone: false is hidden below 640 px.
  const cellClass = (c) => [c.num && 'num', c.phone === false && 'hide-phone'].filter(Boolean).join(' ') || null

  // DataTable: the first 10 rows, and a control for the rest (C07, G19). With moreStep, the control adds that number of rows each time (APO-180).
  function DataTable ({ columns, rows, pageSize = 10, moreStep = 0, caption, emptyText, emptyAction, rowId }) {
    if (rows.length === 0) return EmptyState({ text: emptyText, action: emptyAction })
    let expanded = false
    let shown = pageSize
    const wrap = h('div', moreStep ? { tabindex: '-1' } : {})
    const render = () => {
      const visible = moreStep ? rows.slice(0, shown) : expanded ? rows : rows.slice(0, pageSize)
      const table = h('table', { class: 'data-table' },
        caption && h('caption', {}, caption),
        h('thead', {}, h('tr', {},
          columns.map((c) => h('th', { scope: 'col', class: cellClass(c) }, c.label)))),
        h('tbody', {}, visible.map((row) => h('tr', { id: rowId ? rowId(row) : null },
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

  // BarChart: one series. It draws at the real width, so the 12 px labels never scale down.
  function BarChart ({ values, height = 220, tooltipOf, markers = {}, label, tickEvery = 7, valueFormat = fmt.int }) {
    const holder = h('div', { class: 'chart-holder' })
    const draw = () => {
      const width = holder.clientWidth || 600
      const pad = { top: 16, right: 8, bottom: 28, left: 48 }
      const max = Math.max(...values.map((v) => v.value), 1)
      const step = niceStep(max / 4)
      const top = Math.ceil(max / step) * step
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const bw = plotW / values.length
      // Keep 64 px or more between two date labels.
      const every = Math.max(tickEvery, Math.ceil(64 / bw))
      const y = (v) => pad.top + plotH - (v / top) * plotH
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' },
        h('title', {}, label))
      for (let v = 0; v <= top; v += step) {
        svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }),
          h('text', { x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, valueFormat(v)))
      }
      values.forEach((v, i) => {
        const x = pad.left + i * bw
        const barH = Math.max(0, pad.top + plotH - y(v.value))
        const bar = h('rect', { class: 'bar', x: x + 1, y: y(v.value), width: Math.max(1, bw - 2), height: barH, rx: Math.min(4, bw / 3) })
        const hit = h('rect', {
          class: 'bar-hit', x, y: pad.top, width: bw, height: plotH,
          onMouseenter: (e) => { bar.classList.add('is-active'); showTooltip(tooltipOf(v), e.clientX, e.clientY) },
          onMousemove: (e) => showTooltip(tooltipOf(v), e.clientX, e.clientY),
          onMouseleave: () => { bar.classList.remove('is-active'); hideTooltip() }
        })
        svg.append(bar, hit)
        if (markers[i]) svg.append(h('text', { x: x + bw / 2, y: y(v.value) - 4, 'text-anchor': 'middle', style: { fill: 'var(--text-primary)', fontWeight: 600 } }, markers[i]))
        if (i % every === 0) svg.append(h('text', { x: x + bw / 2, y: height - 8, 'text-anchor': 'middle' }, fmt.date(v.key, { day: 'numeric', month: 'short' })))
      })
      // The same values as a table for a screen reader and the keyboard. The tooltip needs a mouse.
      // A table does not obey the 1 px width of .visually-hidden, so a div holds it.
      const table = h('div', { class: 'visually-hidden' }, h('table', {}, h('caption', {}, label),
        h('tbody', {}, values.map((v) => h('tr', {}, h('th', { scope: 'row' }, fmt.date(v.key)), h('td', {}, tooltipOf(v)))))))
      holder.replaceChildren(svg, table)
    }
    requestAnimationFrame(draw)
    new ResizeObserver(() => draw()).observe(holder)
    return holder
  }
  function niceStep (raw) {
    const p = 10 ** Math.floor(Math.log10(raw || 1))
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10
  }

  function StackedBar (segments) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1
    return h('div', {},
      h('div', { class: 'stacked', role: 'img', 'aria-label': segments.map((s) => `${s.label} ${fmt.pct(s.value / total)}`).join(', ') },
        segments.map((s) => h('span', { style: { width: `${(s.value / total) * 100}%`, background: s.color }, title: `${s.label}: ${fmt.pct(s.value / total)}` }))),
      h('ul', { class: 'legend' }, segments.map((s) => h('li', {}, h('span', { class: 'swatch', style: { background: s.color } }), `${s.label} ${fmt.pct(s.value / total)}`))))
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


  // MiniStance: a stacked bar with no legend, for a table cell. The text alternative gives the shares.
  function MiniStance (segments, minN = 30) {
    const total = segments.reduce((s, x) => s + x.value, 0)
    if (total < minN) return h('span', { class: 'mini-empty' }, t('stance.few', { n: minN }))
    return h('div', { class: 'stacked stacked-mini', role: 'img', 'aria-label': segments.map((s) => `${s.label} ${fmt.pct(s.value / total)}`).join(', ') + ` · n = ${fmt.int(total)}` },
      segments.map((s) => h('span', { style: { width: `${(s.value / total) * 100}%`, background: s.color }, title: `${s.label}: ${fmt.pct(s.value / total)}` })))
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

  window.UI = { EntityLink, ENTITY_ROUTES, PageHeader, SegmentedControl, RangeControl, periodPresets, FilterBar, KpiStrip, KpiTile, ChartCard, EmptyState, ErrorState, ErrorPage, DataNotice, FactList, HBar, DataTable, BarChart, StackedBar, MiniStance, OwnershipMap, MatrixChart, showTooltip, hideTooltip }
})()
