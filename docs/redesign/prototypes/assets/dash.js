// Shared parts of the dashboard pages (APO-161): the top bar, the compact stat card, the cards and the small charts.
// Load after components.js. The pages media-v2, groups-v2 and fingerprints-v2 use it.
(function () {
  const { t, fmt, h } = window.App

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

  // One fixed color for each group: the categorical slots 1 to 8 of the dataviz palette, in the order of the groups file.
  const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
  const NO_GROUP = '#9a978f'
  // The stories of the news topics, largest first. A story with the name of its topic is a catch-all and does not count (APO-168).
  function newsStories (media) {
    const soft = new Set(media.issues.filter((i) => i.soft).map((i) => i.el))
    return media.stories.filter((s) => !soft.has(s.issue) && s.el !== s.issue)
      .map((s) => ({ ...s, count: s.daily.reduce((a, b) => a + b, 0) })).filter((s) => s.count >= 3).sort((a, b) => b.count - a.count)
  }
  // The fixed group to slot map (#2): a group has the same color on every page, whatever list the page has.
  // Slots 1 to 8 follow the order of the groups file. Antenna Group is only in the live data (/api/sources), so it has a 9th slot.
  const GROUP_SLOT = new Map([['Alter Ego Media', '#2a78d6'], ['DPG Digital Media', '#eb6834'], ['Συμφέροντα Μπάκου-Καϋμενάκη', '#1baf7a'], ['Politis Group', '#eda100'],
    ['Συμφέροντα Μελισσανίδη', '#e87ba4'], ['Όμιλος ΣΚΑΪ', '#008300'], ['Συμφέροντα Σαββίδη', '#6250d6'], ['Όμιλος Βαρδινογιάννη', '#e34948'], ['Antenna Group', '#4b5d73']])
  const groupColor = (name) => (name ? GROUP_SLOT.get(name) || NO_GROUP : NO_GROUP)
  function groupColors (groupList) { return new Map(groupList.map((g, i) => [g.name, GROUP_SLOT.get(g.name) || SLOTS[i % SLOTS.length]])) }

  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // The text color with the better contrast on a hex background.
  const textOn = (hex) => { const l = luminance(hex); return (l + 0.05) / (luminance('#1f1f1f') + 0.05) >= 1.05 / (l + 0.05) ? '#1f1f1f' : '#ffffff' }
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

  // Scale: a line from the lowest to the highest value, a tick for the average, a dot for this row.
  function Scale (value, min, max, avg, valueText, avgText) {
    const w = 96
    const span = max - min || 1
    const x = (v) => 4 + ((v - min) / span) * (w - 8)
    return h('svg', { class: 'scale', width: w, height: 16, viewBox: `0 0 ${w} 16`, role: 'img', 'aria-label': t('media2.scale.aria', { value: valueText, avg: avgText }) },
      h('line', { class: 'scale-line', x1: 4, x2: w - 4, y1: 8, y2: 8 }),
      h('line', { class: 'scale-avg', x1: x(avg), x2: x(avg), y1: 2, y2: 14 }),
      h('circle', { class: 'scale-dot', cx: x(value), cy: 8, r: 5 }))
  }

  const card = (cls, ...children) => h('section', { class: `dcard ${cls}` }, ...children)
  // Info: the explanation of a card is not on the card. A round button in the top right corner shows it on hover, on focus and on a tap.
  function Info (text) {
    const btn = h('button', { type: 'button', class: 'info-btn', 'aria-label': t('dash.info'), 'aria-expanded': 'false' }, 'i')
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
  function Meter (share) {
    return h('div', { class: 'meter', role: 'img', 'aria-label': fmt.pct(share) }, h('div', { class: 'meter-fill', style: { width: `${Math.max(0, Math.min(1, share)) * 100}%` } }))
  }

  // Top bar: the title, then the tabs of the page, then the actions of the active tab. It stays on screen while the page scrolls.
  // quiet: the page has no visible title and no line of counts, only the tabs. The title stays for screen readers.
  function TopBar ({ title, meta, aside, actions, tabs, error, quiet }) {
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

  window.Dash = { stateContent, select, fit, reset, niceStep, pct0, SLOTS, NO_GROUP, groupColors, groupColor, newsStories, textOn, tint, Spark, Scale, card, cardHead, Info, emptyText, Stat, Meter, TopBar }
})()
