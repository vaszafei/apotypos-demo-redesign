// Shared parts from the live-site audit of 2026-10-22 (#2): patterns that recur on three or more live pages.
// Each part returns a node built with Dash.card and reads only tokens. Only pages.html loads this file; a page adopts a part when asked.
// Load after dash.js and messages-parts.js.
(function () {
  const { t, fmt, h, Icon } = window.App
  const { card, cardHead, cardState } = window.Dash
  const outLink = (url, ...children) => (App.safeUrl(url) ? h('a', { href: App.safeUrl(url), target: '_blank', rel: 'noopener' }, ...children) : h('span', {}, ...children))

  // A. Summary callout: a heading and a few generated findings, each with an optional link to the card or page that shows it.
  // items: [{ text, href, link }]. With no item the card shows the empty line, not an empty list.
  function Summary ({ cls = 'c-6', title, info, items }) {
    return card(`${cls} sum`, cardHead(title, null, info),
      items.length
        ? h('ol', { class: 'sum-list' }, items.map((x) => h('li', {}, h('p', { class: 'sum-text' }, x.text),
          x.href ? h('a', { class: 'dcard-link', href: x.href }, x.link || t('parts.sum.more'), ' →') : null)))
        : cardState('empty', t('parts.sum.empty')))
  }

  // B. Method and limits: the block at the end of a page. One line is always shown; the rest opens under it.
  // sections: [{ heading, text }], limits: [text].
  function Method ({ cls = 'c-12', lead, sections, limits }) {
    return card(`${cls} method`,
      h('details', { class: 'method-details' },
        h('summary', { class: 'method-summary' }, h('h2', { class: 'dcard-title' }, t('parts.method.title')), h('span', { class: 'dcard-sub' }, lead), Icon('chevron-down', 'icon icon-sm method-chev')),
        h('div', { class: 'method-body' },
          sections.map((s) => h('div', {}, h('h3', { class: 'method-heading' }, s.heading), h('p', { class: 'method-text' }, s.text))),
          limits && limits.length ? h('div', {}, h('h3', { class: 'method-heading' }, t('parts.method.limits')), h('ul', { class: 'method-limits' }, limits.map((x) => h('li', {}, x)))) : null)))
  }

  // E. Headlines and quotes. A headline has its outlet and date, the angle, the frame and the stance (critical, neutral, supportive).
  // The verbatim quotes, each with its source and link, open under «Δείτε παραδείγματα».
  // headlines: [{ title, url, outlet, date, angle, frame, stance }], quotes: [{ text, source, url, date }].
  function Quotes ({ cls = 'c-6', title, info, headlines, quotes = [] }) {
    const list = h('ul', { class: 'hlq-quotes', hidden: true }, quotes.map((q) => h('li', {},
      h('p', { class: 'hlq-quote' }, `«${q.text}»`),
      h('p', { class: 'muted-text' }, outLink(q.url, q.source), q.date ? ` · ${fmt.date(q.date, { day: 'numeric', month: 'short' })}` : ''))))
    const more = h('button', { type: 'button', class: 'dcard-link', 'aria-expanded': 'false' }, t('parts.hlq.more', { n: quotes.length }))
    more.addEventListener('click', () => {
      const open = list.hidden
      list.hidden = !open
      more.setAttribute('aria-expanded', String(open))
      more.textContent = open ? t('parts.hlq.less') : t('parts.hlq.more', { n: quotes.length })
    })
    return card(`${cls} hlq`, cardHead(title, null, info),
      headlines.length
        ? h('ul', { class: 'hlq-list' }, headlines.map((x) => h('li', {},
          outLink(x.url, x.title),
          h('span', { class: 'muted-text' }, [x.outlet, x.date ? fmt.date(x.date, { day: 'numeric', month: 'short' }) : null, x.frame].filter(Boolean).join(' · ')),
          h('span', { class: 'hlq-tags' },
            x.angle ? h('span', { class: 'hlq-angle' }, x.angle) : null,
            x.stance ? h('span', { class: 'hlq-stance' }, h('span', { class: 'swatch', style: { background: `var(--stance-${x.stance})` } }), t(`stance.${x.stance}`)) : null))))
        : cardState('empty', t('parts.hlq.empty')),
      quotes.length ? [Dash.cardFoot(more), list] : null)
  }

  // F. Filter chips: one row, each chip with its count. The pressed chip is the filter; onChange gets its key.
  // items: [{ key, label, n }]. The page keeps the value and draws the row again.
  function Chips ({ label, items, value, onChange }) {
    return h('ul', { class: 'fchip-row', 'aria-label': label }, items.map((x) => h('li', {},
      h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(x.key === value), onClick: () => onChange(x.key) },
        x.label, x.n == null ? null : h('span', { class: 'fchip-n' }, fmt.int(x.n))))))
  }

  // F. The dataset switch: the Greek or the Israeli set of outlets, on the shared segmented control.
  // The wrapper keeps the control at its own width in a card, which stretches its children.
  const DataSwitch = ({ value, onChange }) => h('div', { class: 'fchip-switch' }, UI.SegmentedControl({ label: t('parts.set.label'), value, onChange,
    options: [{ value: 'gr', label: t('parts.set.gr') }, { value: 'il', label: t('parts.set.il') }] }))

  window.Parts = { Summary, Method, Quotes, Chips, DataSwitch }
})()
