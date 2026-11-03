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

  // C. Period control with a volume brush: the period picker (date-range.js), which holds the presets, and the daily columns.
  // A drag over the columns or the picker sets the same period. onChange gets { from, to } once for each change.
  // presets: [{ key, label, from, to }], values: the articles of each day of dates. from, to and every preset bound must be days of dates.
  // A redraw gives the focus back to the control that had it and keeps the summary line as one node, so a screen reader announces it.
  function Period ({ cls = 'c-12', title, info, dates, values, from, to, presets, onChange }) {
    let view = { from, to }
    const sum = h('p', { class: 'dcard-sub', 'aria-live': 'polite' })
    const body = h('div', { class: 'brush' }, sum)
    let shown = []
    const set = (r) => {
      const next = r.from <= r.to ? { from: r.from, to: r.to } : { from: r.to, to: r.from }
      if (next.from === view.from && next.to === view.to) return
      view = next
      draw()
      onChange({ ...view })
    }
    const draw = () => {
      const i0 = dates.indexOf(view.from)
      const i1 = dates.indexOf(view.to)
      let total = 0
      for (let i = i0; i <= i1; i++) total += values[i]
      // A choice in the picker's popover gives the focus to the picker's button.
      const buttons = () => [...body.querySelectorAll('button')].filter((b) => !b.closest('.dr-pop'))
      const inPop = body.contains(document.activeElement) && document.activeElement.closest('.dr-pop')
      const focused = buttons().indexOf(inPop ? body.querySelector('.dr-trigger') : document.activeElement)
      shown.forEach((node) => node.remove())
      shown = [
        h('div', { class: 'brush-controls' }, UI.DateRangePicker({ dates, from: view.from, to: view.to, presets, onChange: set })),
        UI.BarChart({ dates, values, height: 140, label: title, onSelect: set, muted: (i) => i < i0 || i > i1,
          tooltipOf: (i) => t('parts.brush.day', { date: fmt.date(dates[i]), n: fmt.int(values[i]) }) })]
      body.prepend(...shown)
      if (focused >= 0) buttons()[focused]?.focus()
      sum.textContent = t('parts.brush.sum', { n: fmt.int(total), days: i1 - i0 + 1 })
    }
    draw()
    return card(`${cls} brush-card`, cardHead(title, null, info), body)
  }

  // D. Entity × entity heatmap: a table of rows by columns on one sequential scale (Dash.seq), built on UI.MatrixChart.
  // cell(r, c) gives { v, n }: the value and the count it comes from. A cell under minN shows «—» and no value.
  function Heatmap ({ cls = 'c-12', title, info, caption, rowHeader, rows, columns, cell, minN, format = fmt.pct }) {
    const values = rows.flatMap((_, r) => columns.map((_, c) => cell(r, c)))
    const max = Math.max(...values.filter((x) => x.n >= minN).map((x) => x.v), 0) || 1
    const matrix = UI.MatrixChart({ caption: caption || title, rowHeader, rows, columns,
      cell: (r, c) => {
        const x = cell(r, c)
        if (x.n < minN) return { className: 'cell-empty hmx-masked', text: '—' }
        return { ...Dash.seq(x.v / max), text: format(x.v), title: t('parts.hmx.tip', { row: rows[r].label, col: columns[c].label, v: format(x.v), n: fmt.int(x.n) }) }
      } })
    return card(`${cls} hmx`, cardHead(title, null, info), matrix, h('p', { class: 'dcard-sub' }, t('parts.hmx.masked', { n: fmt.int(minN) })))
  }

  // The report frame: a standalone document inside the shell, under a bar with the back arrow, the title and a link that opens the document alone.
  // An iframe fires no error on a missing file, so a HEAD request comes first; a failure shows the error state with a retry.
  // The frame takes the height of its document, so the page has one scroll bar. It measures the box of the document, not its
  // scrollHeight, which never drops below the frame's own height, so the frame can shrink again after the window gets wider.
  function Frame ({ cls = 'c-12', src, title, back }) {
    const body = h('div', { class: 'frame-body' })
    const fit = (frame) => { try { const doc = frame.contentDocument; if (doc && doc.body) frame.style.height = `${Math.ceil(doc.documentElement.getBoundingClientRect().height)}px` } catch { /* another origin */ } }
    const load = () => {
      body.replaceChildren(cardState('loading'))
      fetch(src, { method: 'HEAD' }).then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        const frame = h('iframe', { class: 'frame-doc', src, title })
        frame.addEventListener('load', () => { fit(frame); try { new ResizeObserver(() => fit(frame)).observe(frame.contentDocument.body) } catch { /* another origin */ } })
        body.replaceChildren(frame)
      }).catch(() => body.replaceChildren(cardState('error', null, load)))
    }
    load()
    return card(`${cls} frame`,
      h('div', { class: 'frame-bar' },
        h('a', { class: 'back-button', href: back, 'aria-label': t('shell.back'), title: t('shell.back') }, Icon('arrow-left', 'icon icon-sm')),
        h('h2', { class: 'dcard-title frame-title' }, title),
        h('a', { class: 'dcard-link', href: src, target: '_blank', rel: 'noopener' }, t('parts.frame.open'), ' ↗')),
      body)
  }

  window.Parts = { Summary, Method, Quotes, Chips, DataSwitch, Period, Heatmap, Frame }
})()
