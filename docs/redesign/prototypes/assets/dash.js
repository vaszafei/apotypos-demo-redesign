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

  // Stat card: small. A label, a number, one short line and a small picture of the same measure.
  function Stat ({ label, value, sub, viz, kpi, empty }) {
    const el = card('c-4 dstat', h('h2', { class: 'dstat-label' }, label),
      empty
        ? emptyText(t('media2.stat.empty'))
        : h('div', { class: 'dstat-row' }, h('p', { class: 'dstat-value' }, value), h('p', { class: 'dstat-sub' }, sub), viz))
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

  window.Dash = { stateContent, select, fit, reset, niceStep, pct0, get SLOTS () { return slots() }, get NO_GROUP () { return color('--cat-0') }, color, seq, groupColors, groupColor, textOn, tint, Spark, card, cardHead, Info, emptyText, Stat, TopBar }
})()
