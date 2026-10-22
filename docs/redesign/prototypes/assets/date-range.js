// DateRangePicker: one button with the period, and a popover with the presets on the left and two months of days on the right.
// A first click on a day starts the period and a second click ends it. Only the days of the data can be picked. Load after components.js.
(function () {
  const { t, fmt, h, Icon } = window.App

  const iso = (d) => d.toISOString().slice(0, 10)
  const utc = (s) => new Date(s + 'T00:00:00Z')
  const addMonths = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  const monthStart = (s) => { const d = utc(s); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)) }
  const label = (from, to) => (from === to ? fmt.date(from) : `${fmt.date(from, { day: 'numeric', month: 'short' })} – ${fmt.date(to)}`)
  const dayCount = (from, to) => Math.round((utc(to) - utc(from)) / 86400000) + 1

  let openPicker = null
  document.addEventListener('pointerdown', (e) => { if (openPicker && !openPicker.root.contains(e.target)) openPicker.close() })

  function DateRangePicker ({ dates, from, to, presets, onChange }) {
    const first = dates[0]
    const last = dates[dates.length - 1]
    const has = new Set(dates)
    // The draft is the period in the popover until Apply. start alone means the first click is done.
    let draft = { from, to }
    let start = null
    let hover = null
    let view = monthStart(from)
    if (iso(addMonths(view, 1)) > last) view = addMonths(monthStart(last), -1)
    if (iso(view) < iso(monthStart(first))) view = monthStart(first)

    const trigger = h('button', { type: 'button', class: 'dr-trigger', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      Icon('calendar', 'icon dr-icon'), h('span', { class: 'dr-text' }, label(from, to)), h('span', { class: 'dr-days' }, t('dr.days', { n: dayCount(from, to) })), Icon('chevron-down', 'icon icon-sm dr-chev'))
    const pop = h('div', { class: 'dr-pop', role: 'dialog', 'aria-label': t('dr.title'), hidden: true })
    const root = h('div', { class: 'dr' }, trigger, pop)

    const inDraft = (d) => {
      if (start) { const end = hover || start; const [a, b] = start <= end ? [start, end] : [end, start]; return d >= a && d <= b }
      return d >= draft.from && d <= draft.to
    }
    const edges = () => {
      if (start) { const end = hover || start; return start <= end ? [start, end] : [end, start] }
      return [draft.from, draft.to]
    }

    function month (m) {
      const y = m.getUTCFullYear()
      const mo = m.getUTCMonth()
      const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
      const lead = (m.getUTCDay() + 6) % 7
      const [a, b] = edges()
      const cells = []
      for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'dr-cell is-blank', 'aria-hidden': 'true' }))
      for (let d = 1; d <= days; d++) {
        const key = iso(new Date(Date.UTC(y, mo, d)))
        const ok = has.has(key)
        const cls = ['dr-cell', 'dr-day', inDraft(key) && 'in-range', key === a && 'is-start', key === b && 'is-end', !ok && 'is-off'].filter(Boolean).join(' ')
        const btn = h('button', { type: 'button', class: cls, 'data-day': key, disabled: !ok, 'aria-pressed': String(key === a || key === b), 'aria-label': fmt.date(key) }, String(d))
        if (ok) {
          btn.addEventListener('click', () => pick(key))
          btn.addEventListener('pointerenter', () => { if (start && hover !== key) { hover = key; mark() } })
        }
        cells.push(btn)
      }
      const week = [0, 1, 2, 3, 4, 5, 6].map((i) => fmt.date(iso(new Date(Date.UTC(2026, 7, 3 + i))), { weekday: 'narrow' }))
      return h('div', { class: 'dr-month' },
        h('p', { class: 'dr-month-title' }, fmt.date(iso(m), { month: 'long', year: 'numeric' })),
        h('div', { class: 'dr-grid' }, week.map((w) => h('span', { class: 'dr-cell dr-wd', 'aria-hidden': 'true' }, w)), cells))
    }

    // A hover while the end is open moves only the marks of the days. It never draws the popover again, so the day under the pointer stays.
    function mark () {
      const [a, b] = edges()
      pop.querySelectorAll('.dr-day').forEach((el) => {
        const d = el.dataset.day
        el.classList.toggle('in-range', inDraft(d))
        el.classList.toggle('is-start', d === a)
        el.classList.toggle('is-end', d === b)
      })
    }

    function pick (key) {
      if (!start) { start = key; hover = key } else { draft = start <= key ? { from: start, to: key } : { from: key, to: start }; start = null; hover = null }
      paint()
    }

    function paint () {
      const canPrev = iso(view) > iso(monthStart(first))
      const canNext = iso(addMonths(view, 2)) <= last
      const current = presets.find((p) => !start && p.from === draft.from && p.to === draft.to)
      const [a, b] = edges()
      pop.replaceChildren(
        h('ul', { class: 'dr-presets', 'aria-label': t('dr.presets') }, presets.map((p) => h('li', {},
          h('button', { type: 'button', class: 'dr-preset', 'aria-pressed': String(current === p), onClick: () => { draft = { from: p.from, to: p.to }; start = null; hover = null; view = monthStart(p.from); if (iso(addMonths(view, 1)) > last) view = addMonths(monthStart(last), -1); paint() } }, p.label)))),
        h('div', { class: 'dr-main' },
          h('div', { class: 'dr-nav' },
            h('button', { type: 'button', class: 'icon-button dr-step', disabled: !canPrev, 'aria-label': t('dr.prev'), onClick: () => { view = addMonths(view, -1); paint() } }, Icon('chevron-left', 'icon icon-sm')),
            h('button', { type: 'button', class: 'icon-button dr-step', disabled: !canNext, 'aria-label': t('dr.next'), onClick: () => { view = addMonths(view, 1); paint() } }, Icon('chevron-right', 'icon icon-sm'))),
          h('div', { class: 'dr-months' }, month(view), month(addMonths(view, 1))),
          h('div', { class: 'dr-foot' },
            h('p', { class: 'dr-summary', 'aria-live': 'polite' }, start ? t('dr.pick.end') : `${label(a, b)} · ${t('dr.days', { n: dayCount(a, b) })}`),
            h('button', { type: 'button', class: 'button', onClick: close }, t('dr.cancel')),
            h('button', { type: 'button', class: 'button button-primary', disabled: Boolean(start), onClick: apply }, t('dr.apply')))))
    }

    function open () {
      if (openPicker && openPicker !== api) openPicker.close()
      draft = { from, to }
      start = null
      hover = null
      paint()
      pop.hidden = false
      trigger.setAttribute('aria-expanded', 'true')
      openPicker = api
      const focus = pop.querySelector('.dr-day.is-start') || pop.querySelector('.dr-preset')
      if (focus) focus.focus()
    }
    function close () {
      pop.hidden = true
      trigger.setAttribute('aria-expanded', 'false')
      if (openPicker === api) openPicker = null
    }
    function apply () { close(); if (draft.from !== from || draft.to !== to) onChange({ ...draft }) }
    const api = { root, close }

    trigger.addEventListener('click', () => (pop.hidden ? open() : close()))
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); close(); trigger.focus() } })
    return root
  }

  UI.DateRangePicker = DateRangePicker
})()
