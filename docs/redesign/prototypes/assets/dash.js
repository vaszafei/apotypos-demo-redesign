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

  // Groups to outlets: a Sankey with two columns (Μέσα › Επισκόπηση and Ιδιοκτησία). groups: [{ name (null: no group), outlets: [{ name, n }] }]. The group is on the left, the outlets of the group are on the right, and the width of a band is the articles of the outlet.
  // An outlet is at least one row high so that its name can be read, and its band sits in the middle of the row. The node of a group is centered on its outlets.
  function GroupFlow ({ groups: input, colorOf, groupLink, outletLink, noneLabel }) {
    const groups = input.map((g) => ({ name: g.name, outlets: g.outlets.slice().sort((a, b) => b.n - a.n), n: g.outlets.reduce((s, o) => s + o.n, 0) })).sort((a, b) => b.n - a.n)
    const total = groups.reduce((s, g) => s + g.n, 0)
    return fit((holder, width) => {
      const narrow = width < 520
      const labelL = narrow ? 104 : 156
      const labelR = narrow ? 134 : 176
      const NODE = 8
      const ROW = 20
      const GAP = 2
      const GROUP_GAP = 10
      const k = 340 / (total || 1)
      const xL = labelL + 6
      const xR = width - labelR - 6 - NODE
      let y = 0
      const placed = groups.map((g) => {
        const rows = g.outlets.map((o) => {
          const rowH = Math.max(ROW, k * o.n)
          const row = { o, top: y, h: rowH, band: Math.max(1, k * o.n) }
          y += rowH + GAP
          return row
        })
        const top = rows[0].top
        const bottom = rows[rows.length - 1].top + rows[rows.length - 1].h
        y += GROUP_GAP - GAP
        const nodeH = Math.max(4, k * g.n)
        return { g, rows, top, bottom, nodeH, nodeTop: (top + bottom) / 2 - nodeH / 2 }
      })
      const height = Math.ceil(y - GROUP_GAP)
      holder.style.height = `${height}px`
      const svg = h('svg', { class: 'chart flow', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' })
      const labels = []
      placed.forEach((p) => {
        const color = p.g.name ? colorOf(p.g.name) : colorOf(null)
        let cursor = p.nodeTop + (p.nodeH - p.rows.reduce((s, r) => s + r.band, 0)) / 2
        svg.append(h('rect', { class: 'flow-node', x: xL - NODE, y: p.nodeTop, width: NODE, height: p.nodeH, fill: color }))
        p.rows.forEach((r) => {
          const yL0 = cursor
          const yL1 = cursor + r.band
          cursor = yL1
          const yR0 = r.top + (r.h - r.band) / 2
          const yR1 = yR0 + r.band
          const mid = (xL + xR) / 2
          const band = h('path', { class: 'flow-band', fill: color, d: `M${xL} ${yL0}C${mid} ${yL0} ${mid} ${yR0} ${xR} ${yR0}L${xR} ${yR1}C${mid} ${yR1} ${mid} ${yL1} ${xL} ${yL1}Z` })
          const text = t('flow.band', { group: p.g.name || noneLabel, outlet: r.o.name, n: fmt.int(r.o.n), share: fmt.pct(r.o.n / p.g.n) })
          const show = (e) => UI.showTooltip(text, e.clientX, e.clientY)
          band.addEventListener('pointerenter', show)
          band.addEventListener('pointermove', show)
          band.addEventListener('pointerleave', () => UI.hideTooltip())
          svg.append(band, h('rect', { class: 'flow-node', x: xR, y: r.top, width: NODE, height: r.h, fill: color }))
          labels.push(h('p', { class: 'flow-label flow-outlet', style: { left: `${xR + NODE + 8}px`, top: `${r.top + r.h / 2}px`, width: `${labelR - NODE - 8}px` } },
            h('span', { class: 'flow-name' }, outletLink(r.o)), h('span', { class: 'flow-n' }, fmt.int(r.o.n))))
        })
        const name = p.g.name ? groupLink(p.g.name) : h('span', {}, noneLabel)
        const two = p.bottom - p.top >= 36
        labels.push(h('p', { class: two ? 'flow-label flow-group is-two' : 'flow-label flow-group', style: { left: '0px', width: `${labelL - 4}px`, top: `${(p.top + p.bottom) / 2}px` } },
          h('span', { class: 'flow-name' }, name), two && h('span', { class: 'flow-sub' }, fmt.int(p.g.n))))
      })
      holder.replaceChildren(svg, ...labels)
    })
  }

  window.Dash = { GroupFlow, stateContent, select, fit, reset, niceStep, pct0, get SLOTS () { return slots() }, get NO_GROUP () { return color('--cat-0') }, color, seq, groupColors, groupColor, textOn, tint, Spark, card, cardHead, Info, emptyText, cardState, cardFoot, Stat, TopBar }
})()
