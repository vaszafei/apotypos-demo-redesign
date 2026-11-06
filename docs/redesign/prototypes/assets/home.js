// The hero and the cards of Αρχική: the stories of a day, the calendar of a month, the topics of a day and the quick access.
// Load after dash.js. index.html draws the page.
(function () {
  const { t, fmt, h, Icon } = window.App
  const { card, cardHead, emptyText, groupColor } = Dash

  const name = (x) => x[App.locale] || x.el
  const sum = (arr) => arr.reduce((a, b) => a + b, 0)

  // The lookups of a day: the stories of stories.js ranked by articles for each day, and the rows of storyDetail.js with the articles of each outlet (it has every story). A generic story ("Άλλα διεθνή") is not a story, so it does not count.
  function index ({ stories, detail }) {
    const byDay = stories.dates.map(() => [])
    stories.stories.forEach((s) => {
      if (s.generic) return
      for (let j = 0; j < s.days.length; j += 2) byDay[s.days[j]].push({ s, n: s.days[j + 1] })
    })
    byDay.forEach((list) => list.sort((a, b) => b.n - a.n))
    const rowsOf = new Map(detail ? detail.stories.map((s) => [s.id, s.t]) : [])
    return { byDay, rowsOf, detail, dates: stories.dates, issues: stories.issues }
  }


  // Everything the card says about one story of a day: the story of that rank, the outlets that ran it, and the stories of the day.
  function dayInfo (ix, d, rank = 0) {
    const list = ix.byDay[d] || []
    const lead = list[rank]
    if (!lead) return null
    const { s, n } = lead
    const date = ix.dates[d]
    const perOutlet = new Map()
    const rows = ix.rowsOf.get(s.id)
    const day = ix.detail ? ix.detail.dates.indexOf(date) : -1
    if (rows) for (let j = 0; j < rows.length; j += 3) if (rows[j + 1] === day) perOutlet.set(rows[j], rows[j + 2])
    const outlets = [...perOutlet].map(([k, c]) => ({ ...ix.detail.outlets[k], k, n: c })).sort((a, b) => b.n - a.n)
    return { d, date, story: s, n, rank, topic: ix.issues[s.issue], outlets, list }
  }

  // The outlets that ran a story in the days i0 to i1, with their articles, the largest first.
  function outletsOf (ix, s, i0, i1) {
    const from = ix.detail ? ix.detail.dates.indexOf(ix.dates[i0]) : -1
    const to = ix.detail ? ix.detail.dates.indexOf(ix.dates[i1]) : -1
    const perOutlet = new Map()
    const rows = ix.rowsOf.get(s.id)
    if (rows && from >= 0 && to >= 0) for (let j = 0; j < rows.length; j += 3) if (rows[j + 1] >= from && rows[j + 1] <= to) perOutlet.set(rows[j], (perOutlet.get(rows[j]) || 0) + rows[j + 2])
    return [...perOutlet].map(([k, c]) => ({ ...ix.detail.outlets[k], k, n: c })).sort((a, b) => b.n - a.n)
  }

  // The same as dayInfo for a period (the days i0 to i1): the articles of a story and of its outlets are summed over the period, and the list has every story that ran in it.
  function rangeInfo (ix, i0, i1, rank = 0) {
    const totals = new Map()
    for (let d = i0; d <= i1; d++) for (const { s, n } of ix.byDay[d]) totals.set(s, (totals.get(s) || 0) + n)
    const list = [...totals].map(([s, n]) => ({ s, n })).sort((a, b) => b.n - a.n)
    const lead = list[rank]
    if (!lead) return null
    const { s, n } = lead
    const outlets = outletsOf(ix, s, i0, i1)
    return { d: `${i0}-${i1}`, date: ix.dates[i1], story: s, n, rank, topic: ix.issues[s.issue], outlets, list }
  }

  // A thin horizontal bar of the articles of the story: one part for each outlet, the largest from the left, in the color of its group.
  // The line under it says the total, and names the outlet of the part under the mouse (or in focus). A part opens the page of its outlet.
  function OutletStack (parts, { total, count }) {
    const panel = h('div', { class: 'home-stack-panel', 'aria-live': 'polite' })
    const rest = () => panel.replaceChildren(h('p', { class: 'home-stack-line' }, h('strong', { class: 'home-stack-total' }, fmt.int(total)), h('span', { class: 'home-stack-cap' }, t('home.day.ring', { n: count }))))
    const show = (s) => panel.replaceChildren(h('p', { class: 'home-stack-line' }, h('strong', { class: 'home-stack-name' }, s.name), s.slug ? h('span', { class: 'home-stack-cap' }, s.group || t('home.day.nogroup')) : null),
      h('p', { class: 'home-stack-cap' }, t('home.day.slice', { n: fmt.int(s.n), share: fmt.pct(s.n / total) })))
    rest()
    const bar = h('div', { class: 'home-stack', role: 'group', 'aria-label': t('home.day.outlets') })
    parts.forEach((s) => {
      const part = h(s.slug ? 'a' : 'span', { class: 'home-stack-part', style: `flex:${s.n} 1 0;background:${s.color}`, tabindex: s.slug ? null : 0,
        href: s.slug ? `outlet-v2.html?slug=${s.slug}` : null, 'aria-label': `${s.name}: ${fmt.int(s.n)}` })
      const on = () => { bar.classList.add('has-hover'); part.classList.add('is-on'); show(s) }
      const off = () => { bar.classList.remove('has-hover'); part.classList.remove('is-on'); rest() }
      part.addEventListener('pointerenter', on)
      part.addEventListener('pointerleave', off)
      part.addEventListener('focus', on)
      part.addEventListener('blur', off)
      bar.append(part)
    })
    return h('div', { class: 'home-stack-wrap' }, bar, panel)
  }

  let listDay = -1
  let listTop = 0
  let listShown = 0
  const LIST_PART = 100

  // The stories of a day: a story is picked to show it in the card, and its button opens its page. The card shows the story of the rank in info, and the picked day at the top right.
  // A page that shows a period (Μέσα › Ιστορίες) passes title, hint, dateText (false for none) and empty for its own words, and part ('story' or 'list') with span (a column class)
  // to draw the story and its list as two cards. With no part it is one card.
  function DayCard (info, { date, onStory, swap, title, hint, dateText, empty, part, span = 'c-5' }) {
    const head = cardHead(title || t('home.day.title'), dateText === false ? null : h('span', { class: 'home-date' }, dateText || fmt.date(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), hint || t('home.day.info'))
    if (!info) return card(`${span} home-day`, head, emptyText(empty || t('home.day.empty')))
    const { story, topic } = info
    const total = sum(info.outlets.map((o) => o.n))
    const slices = info.outlets.map((o) => ({ name: o.name, group: o.group, n: o.n, color: groupColor(o.group), slug: o.slug }))
    const outlets = slices.length ? h('div', { class: 'home-block' }, OutletStack(slices, { total, count: info.outlets.length })) : null

    const row = (o, r) => h('li', { class: r === info.rank ? 'is-current' : null },
      h('button', { type: 'button', class: 'home-story-pick', 'aria-pressed': String(r === info.rank), onClick: () => onStory(r) },
        h('span', { class: 'home-story-name' }, name(o.s)), h('span', { class: 'muted-text' }, fmt.int(o.n))),
      h('a', { class: 'button button-sm home-story-go', href: `story-v2.html?id=${o.s.id}`, 'aria-label': `${t('home.day.open')}: ${name(o.s)}` }, t('home.day.open'), Icon('chevron-right', 'icon icon-sm')))
    const listOf = () => {
      // The list has every story of the day and scrolls inside the card. A new day starts at the top; a pick on the same day keeps the place.
      // A period can have thousands of stories, so the list draws them in parts of LIST_PART: the next part comes when the scroll is near the end.
      const sameDay = info.d === listDay
      listDay = info.d
      if (!sameDay) { listTop = 0; listShown = LIST_PART }
      const stories = h('ul', { class: 'home-stories' })
      const more = () => {
        const from = stories.children.length
        if (from >= info.list.length) return
        stories.append(...info.list.slice(from, Math.min(info.list.length, from + LIST_PART)).map((o, k) => row(o, from + k)))
        listShown = stories.children.length
      }
      stories.append(...info.list.slice(0, Math.min(info.list.length, Math.max(LIST_PART, listShown))).map(row))
      stories.addEventListener('scroll', () => {
        listTop = stories.scrollTop
        if (stories.scrollTop + stories.clientHeight > stories.scrollHeight - 400) more()
      })
      requestAnimationFrame(() => { stories.scrollTop = listTop })
      return stories
    }

    // swap: 'day' draws the whole card in again, 'story' only the story, its topic and its outlets (the list keeps its place).
    const cls = `${span} home-day${swap ? ` is-swap is-swap-${swap}` : ''}`
    const lead = [
      h('h3', { class: 'home-day-story' }, name(story)),
      h('p', { class: 'home-day-meta' }, topic ? [h('span', { class: 'home-topic-label' }, t('home.day.topic')), ' ', UI.EntityLink({ type: 'topic', key: String(story.issue), label: name(topic) })] : null,
        info.outlets.length ? null : [topic ? ' · ' : null, t('home.day.meta', { n: fmt.int(info.n) })]),
      outlets
    ]
    if (part === 'story') return card(cls, head, ...lead)
    if (part === 'list') return card(cls, head, listOf())
    return card(cls, head, ...lead, listOf())
  }

  // The calendar of a month: a strip of tiles, one for each day, that scrolls sideways. A tile has the day, the articles of all the outlets and the change against the day before.
  // The arrows and the name of the month are at the top right of the card, and a tile picks the day.
  function Calendar ({ dates, totals, selected, onPick }) {
    const at = new Map(dates.map((d, i) => [d, i]))
    const months = [...new Set(dates.map((d) => d.slice(0, 7)))]
    let month = dates[selected].slice(0, 7)
    let current = selected
    const list = h('ul', { class: 'home-days' })
    const label = h('span', { class: 'home-month-name', 'aria-live': 'polite' })
    const step = (dir) => h('button', { type: 'button', class: 'icon-button', 'aria-label': t(dir < 0 ? 'home.month.prev' : 'home.month.next'),
      onClick: () => { month = months[months.indexOf(month) + dir]; paint() } }, Icon(dir < 0 ? 'chevron-left' : 'chevron-right', 'icon'))
    const prev = step(-1)
    const next = step(1)

    // The change against the day before: an arrow up or down and the size of the change.
    const delta = (i) => {
      if (i === 0 || totals[i] === null || !(totals[i - 1] > 0)) return '–'
      const v = ((totals[i] - totals[i - 1]) / totals[i - 1]) * 100
      const size = `${fmt.dec(Math.abs(v))}%`
      if (Number(fmt.dec(Math.abs(v))) === 0) return size
      return [h('span', { class: `home-arrow ${v > 0 ? 'is-up' : 'is-down'}`, 'aria-hidden': 'true' }, v > 0 ? '▲' : '▼'), ' ', size]
    }

    // The scroll position that puts a tile in the middle of the strip, from the boxes on screen.
    const centered = (tile) => tile.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - (list.clientWidth - tile.offsetWidth) / 2
    let shown = null
    const buttons = new Map()
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
    function paint () {
      // The same month: only the picked tile changes, and the strip slides to it.
      if (shown === month) {
        buttons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === current)))
        const tile = buttons.get(current)
        if (tile) list.scrollTo({ left: centered(tile), behavior: calm.matches ? 'auto' : 'smooth' })
        return
      }
      shown = month
      buttons.clear()
      const tiles = new Map()
      dates.forEach((iso, i) => {
        if (!iso.startsWith(month)) return
        const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
        tiles.set(i, h('li', {}, h('button', { type: 'button', class: weekday === 0 || weekday === 6 ? 'home-day-btn is-weekend' : 'home-day-btn', 'aria-pressed': String(i === current),
          'aria-label': t('home.days.aria', { date: fmt.date(iso), n: fmt.int(totals[i]) }), onClick: () => { current = i; paint(); onPick(i) } },
        h('span', { class: 'home-day-dow' }, fmt.date(iso, { weekday: 'short' })),
        h('span', { class: 'home-day-num' }, String(Number(iso.slice(8)))),
        h('span', { class: 'home-day-n' }, fmt.int(totals[i])),
        h('span', { class: 'home-day-delta' }, delta(i)))))
        buttons.set(i, tiles.get(i).firstChild)
      })
      label.textContent = fmt.date(`${month}-01`, { month: 'long', year: 'numeric' })
      prev.disabled = months.indexOf(month) === 0
      next.disabled = months.indexOf(month) === months.length - 1
      list.replaceChildren(...tiles.values())
      list.classList.remove('is-swap')
      void list.offsetWidth
      list.classList.add('is-swap')
      // The picked day is in the middle of the strip when it is in this month; any other month starts at its first day.
      const tile = tiles.get(current)?.firstChild
      requestAnimationFrame(() => { list.scrollLeft = tile ? centered(tile) : 0 })
    }
    paint()
    const node = card('home-calendar', cardHead(t('home.days.title'), h('div', { class: 'home-month-nav' }, prev, label, next), t('home.days.info')), list)
    return { node, select (i) { current = i; month = dates[i].slice(0, 7); paint() } }
  }

  // The topics of one day in the news, all of them in two columns, the first half on the left: the articles, the share of the day, and an arrow on the share when it is more (▲) or less (▼) than in the days before (the 7 before, fewer at the start of the data).
  function TopicsCard ({ home, day }) {
    const w = Math.min(7, day)
    const news = home.issues.map((x, k) => ({ x, k })).filter((r) => !r.x.soft)
    const on = (k) => home.issueDaily[k][day]
    const before = (k) => sum(home.issueDaily[k].slice(day - w, day))
    const dayTotal = sum(news.map((r) => on(r.k)))
    const beforeTotal = sum(news.map((r) => before(r.k)))
    const rows = news.map((r) => {
      const now = dayTotal ? on(r.k) / dayTotal : 0
      const was = beforeTotal ? before(r.k) / beforeTotal : 0
      return { ...r, n: on(r.k), now, was, diff: w && beforeTotal ? now - was : 0 }
    }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n)
    const head = cardHead(t('home.topics.title'), null, t('home.topics.note', { n: w }))
    // A day after the coded data has no topics (null), which is not the same as a day with no news.
    if (news.every((r) => on(r.k) === null)) return card('c-7 home-topics', head, emptyText(t('home.topics.nodata')))
    if (!rows.length) return card('c-7 home-topics', head, emptyText(t('home.topics.empty')))
    const points = (v) => fmt.dec(Math.abs(v * 100))
    const arrow = (r) => {
      if (!r.x || Number(points(r.diff)) === 0) return null
      const up = r.diff > 0
      const tip = t('home.topics.tip', { topic: name(r.x), now: fmt.pct(r.now), before: fmt.pct(r.was), diff: `${up ? '+' : '−'}${points(r.diff)}` })
      return h('span', { class: `home-arrow ${up ? 'is-up' : 'is-down'}`, title: tip, role: 'img', 'aria-label': tip }, up ? '▲' : '▼')
    }
    // A donut of the largest topics (the rest is one grey part), from the top, clockwise. The legend lists them with the share and the arrow; the rest opens under it.
    const TOP = 6
    const shown = rows.slice(0, TOP).map((r, i) => ({ ...r, color: Dash.SLOTS[i], label: name(r.x) }))
    const rest = rows.slice(TOP)
    const restN = sum(rest.map((r) => r.n))
    const parts = restN ? [...shown, { n: restN, now: restN / dayTotal, color: Dash.NO_GROUP, label: t('home.topics.other', { n: rest.length }) }] : shown
    const size = 220
    const c = size / 2
    const [r0, r1] = [72, 106]
    const pad = 0.012
    const arc = (a0, a1) => {
      a0 += pad / 2
      a1 = Math.max(a0 + 0.002, a1 - pad / 2)
      const p = (a, r) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`
      const large = a1 - a0 > Math.PI ? 1 : 0
      return `M${p(a0, r1)}A${r1} ${r1} 0 ${large} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z`
    }
    const svg = h('svg', { class: 'chart donut home-donut', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': parts.map((r) => `${r.label} ${fmt.pct(r.now)}`).join(', ') })
    const centerNum = h('text', { class: 'donut-num', x: c, y: c + 2, 'text-anchor': 'middle' }, fmt.int(dayTotal))
    const centerCap = h('text', { class: 'donut-cap', x: c, y: c + 20, 'text-anchor': 'middle' }, t('g2.donut.center'))
    svg.append(centerNum, centerCap)
    const slices = []
    const items = []
    const focus = (i) => {
      const r = i == null ? null : parts[i]
      slices.forEach((el, k) => el.classList.toggle('is-dim', i != null && k !== i))
      items.forEach((el, k) => el?.classList.toggle('is-on', k === i))
      centerNum.textContent = r ? fmt.pct(r.now) : fmt.int(dayTotal)
      centerCap.textContent = r ? (r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label) : t('g2.donut.center')
    }
    let a = 0
    parts.forEach((r, i) => {
      const span = dayTotal ? (r.n / dayTotal) * 2 * Math.PI : 0
      const slice = h('path', { class: 'slice', d: arc(a, a + span), fill: r.color, tabindex: 0, 'aria-label': `${r.label}: ${fmt.int(r.n)} (${fmt.pct(r.now)})` })
      slice.addEventListener('pointerenter', () => focus(i))
      slice.addEventListener('pointerleave', () => focus(null))
      slice.addEventListener('focus', () => focus(i))
      slice.addEventListener('blur', () => focus(null))
      slices.push(slice)
      svg.insertBefore(slice, centerNum)
      a += span
    })
    const legendRow = (r, i, label) => {
      const li = h('li', { class: 'home-topic-row' },
        h('span', { class: 'dot', style: `--dot:${r.color}`, 'aria-hidden': 'true' }),
        h('span', { class: 'row-name' }, label),
        h('span', { class: 'row-value home-share' }, arrow(r), fmt.pct(r.now)))
      li.addEventListener('pointerenter', () => focus(i))
      li.addEventListener('pointerleave', () => focus(null))
      items[i] = li
      return li
    }
    const legend = h('ul', { class: 'rows home-topic-legend' }, shown.map((r, i) => legendRow(r, i, UI.EntityLink({ type: 'topic', key: String(r.k), label: r.label }))))
    if (restN) {
      const o = parts[parts.length - 1]
      legend.append(legendRow(o, parts.length - 1, o.label))
    }
    const more = restN ? h('details', { class: 'home-topic-more' }, h('summary', {}, t('home.topics.all', { n: rest.length })),
      h('ul', { class: 'rows' }, rest.map((r) => h('li', { class: 'home-topic-row' },
        h('span', { class: 'row-name' }, UI.EntityLink({ type: 'topic', key: String(r.k), label: name(r.x) })),
        h('span', { class: 'row-value home-share' }, arrow(r), fmt.pct(r.now))))) ) : null
    return card('c-7 home-topics', head, h('div', { class: 'donut-wrap home-topics-wrap' }, svg, h('div', { class: 'home-topic-side' }, legend, more)))
  }

  // The quick access: four buttons in a 2×2 grid, each with the name of the page, a short line (not every page has one) and an arrow. The card ends where the buttons end.
  const QUICK = [['speeches', '/speeches', 'tab.world.speeches', true], ['pi', '/narrative', 'tab.world.pi', true], ['politics', '/elections', 'nav.politics', false], ['file', '/contradictions', 'tab.people.file', true]]
  function QuickCard () {
    return card('c-5 home-quick', cardHead(t('home.quick.title')),
      h('ul', { class: 'home-links' }, QUICK.map(([key, route, label, line]) => h('li', {},
        h('a', { href: Shell.hrefOf(route) }, h('span', { class: 'home-link-main' }, h('strong', {}, t(label)), line ? h('span', { class: 'muted-text' }, t(`home.quick.${key}`)) : null), Icon('chevron-right', 'icon icon-sm'))))))
  }

  // The hero of Αρχική: the masthead, the large search and the topics of the last day to search for,
  // the size of the data in one strip, and behind it all a faint silhouette of the articles per day. A link under it scrolls to the news.
  function Hero ({ home, totals, i0, i1, stories }) {
    const search = Shell.Search({ hero: true })
    const last = i1
    // The chips: the news topics with the most articles on the last day. The catch-all topics ("Άλλα", "Άλλα διεθνή") are not something to search for.
    const chips = home.issues.map((x, k) => ({ x, n: home.issueDaily[k][last] }))
      .filter((r) => !r.x.soft && !r.x.catchAll && !/^Άλλα(\s|$)/.test(r.x.el) && r.n > 0)
      .sort((a, b) => b.n - a.n).slice(0, 4)
    // The label comes first for the list; CSS puts the number above it.
    const stat = (value, label) => h('div', { class: 'home-hero-stat' }, h('dt', {}, label), h('dd', { class: 'kpi-value' }, value))
    const collected = sum(totals.slice(i0, i1 + 1))
    const period = t('home.hero.period', { from: fmt.date(home.dates[i0], { day: 'numeric', month: 'long' }), to: fmt.date(home.dates[i1], { day: 'numeric', month: 'long', year: 'numeric' }) })
    return h('section', { class: 'home-hero', 'aria-labelledby': 'home-hero-title' },
      Wave(totals.slice(i0, i1 + 1)),
      h('div', { class: 'home-hero-inner' },
        Masthead(),
        h('div', { class: 'home-hero-search' }, search),
        chips.length ? h('div', { class: 'home-hero-try' }, h('span', { class: 'home-hero-try-label' }, t('home.hero.try')),
          chips.map((r) => h('button', { type: 'button', class: 'home-chip', onClick: () => search.open(name(r.x)) }, name(r.x)))) : null,
        h('div', { class: 'kpi-tile home-hero-stats' },
          h('dl', { 'aria-label': period },
            stat(fmt.int(collected), t('home.hero.articles')),
            stat(fmt.int(home.outlets.length), t('home.hero.outlets')),
            stories != null ? stat(fmt.int(stories), t('home.hero.stories')) : null,
            stat(fmt.int(i1 - i0 + 1), t('home.hero.days'))),
          h('p', { class: 'home-hero-period' }, period))),
      h('a', { class: 'home-hero-more', href: '#home-today' }, t('home.hero.more'), Icon('chevron-down', 'icon icon-sm')))
  }

  // The masthead of the hero: "ΑΠΟΤΥΠΟΣ / ΠΑΡΑΤΗΡΗΤΗΡΙΟ ΕΛΛΗΝΙΚΩΝ ΜΜΕ". On each visit the name rises in, the "/" draws from the top and the line after it follows (CSS).
  function Masthead () {
    const brand = t('site.name').toLocaleUpperCase('el')
    const tail = t('home.hero.eyebrow').toLocaleUpperCase(App.locale)
    return h('h1', { class: 'home-mast', id: 'home-hero-title', 'aria-label': `${t('site.name')} / ${t('home.hero.eyebrow')}` },
      h('span', { class: 'mast-part mast-name', 'aria-hidden': 'true' }, brand),
      h('span', { class: 'mast-slash', 'aria-hidden': 'true' }, '/'),
      h('span', { class: 'mast-part mast-tail', 'aria-hidden': 'true' }, tail))
  }

  // The silhouette of the hero: the articles of each day as a smooth area along the bottom. It only decorates.
  // The line is the mean of the week around each day, so the weekend dips read as a slow swell, not as teeth.
  function Wave (daily) {
    const W = 1200
    const H = 160
    const values = daily.map((_, i) => { const part = daily.slice(Math.max(0, i - 3), i + 4); return sum(part) / part.length })
    const max = Math.max(...values, 1)
    const step = W / Math.max(values.length - 1, 1)
    const pts = values.map((v, i) => [i * step, H - (v / max) * (H - 12)])
    let d = `M0 ${H} L${pts[0][0]} ${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      const mx = (x0 + x1) / 2
      d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`
    }
    const svg = h('svg', { class: 'home-hero-wave', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' })
    svg.innerHTML = `<path class="home-hero-wave-fill" d="${d} L${W} ${H} Z"/><path class="home-hero-wave-line" d="${d.replace(/^M0 \d+ L/, 'M')}"/>`
    return svg
  }

  window.Home = { index, dayInfo, rangeInfo, outletsOf, DayCard, Calendar, TopicsCard, QuickCard, Hero }
})()
