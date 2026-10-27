// The cards of Αρχική: the stories of a day, the calendar of a month, the topics of a day and the quick access.
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

  const STORIES = 7

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
    return { d, date, story: s, n, rank, topic: ix.issues[s.issue], outlets, list: list.slice(0, STORIES) }
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

  // The stories of a day: a story is picked to show it in the card, and its button opens its page. The card shows the story of the rank in info, and the picked day at the top right.
  function DayCard (info, { date, onStory }) {
    const head = cardHead(t('home.day.title'), h('span', { class: 'pill home-pill' }, fmt.date(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), t('home.day.info'))
    if (!info) return card('c-5 home-day', head, emptyText(t('home.day.empty')))
    const { story, topic } = info
    const total = sum(info.outlets.map((o) => o.n))
    const slices = info.outlets.map((o) => ({ name: o.name, group: o.group, n: o.n, color: groupColor(o.group), slug: o.slug }))
    const outlets = slices.length
      ? h('div', { class: 'home-block' }, h('p', { class: 'home-label' }, t('home.day.outlets')), OutletStack(slices, { total, count: info.outlets.length }))
      : null

    const stories = h('ul', { class: 'home-stories' }, info.list.map((o, r) => h('li', { class: r === info.rank ? 'is-current' : null },
      h('button', { type: 'button', class: 'home-story-pick', 'aria-pressed': String(r === info.rank), onClick: () => onStory(r) },
        h('span', { class: 'home-story-name' }, name(o.s)), h('span', { class: 'muted-text' }, fmt.int(o.n))),
      h('a', { class: 'button home-story-go', href: `story-v2.html?id=${o.s.id}`, 'aria-label': `${t('home.day.open')}: ${name(o.s)}` }, t('home.day.open'), Icon('chevron-right', 'icon icon-sm')))))

    return card('c-5 home-day', head,
      h('h3', { class: 'home-day-story' }, name(story)),
      h('p', { class: 'home-day-meta' }, topic ? UI.EntityLink({ type: 'topic', key: String(story.issue), label: name(topic) }) : null,
        info.outlets.length ? null : [topic ? ' · ' : null, t('home.day.meta', { n: fmt.int(info.n) })]),
      outlets,
      stories)
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
      if (i === 0 || !(totals[i - 1] > 0)) return '–'
      const v = ((totals[i] - totals[i - 1]) / totals[i - 1]) * 100
      const size = `${fmt.dec(Math.abs(v))}%`
      if (Number(fmt.dec(Math.abs(v))) === 0) return size
      return [h('span', { class: `home-arrow ${v > 0 ? 'is-up' : 'is-down'}`, 'aria-hidden': 'true' }, v > 0 ? '▲' : '▼'), ' ', size]
    }

    function paint () {
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
      })
      label.textContent = fmt.date(`${month}-01`, { month: 'long', year: 'numeric' })
      prev.disabled = months.indexOf(month) === 0
      next.disabled = months.indexOf(month) === months.length - 1
      list.replaceChildren(...tiles.values())
      // The picked day is in the middle of the strip when it is in this month; any other month starts at its first day.
      const tile = tiles.get(current)?.firstChild
      requestAnimationFrame(() => { list.scrollLeft = tile ? tile.offsetLeft - (list.clientWidth - tile.offsetWidth) / 2 : 0 })
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
    if (!rows.length) return card('c-7 home-topics', head, emptyText(t('home.topics.empty')))
    const points = (v) => fmt.dec(Math.abs(v * 100))
    const arrow = (r) => {
      if (Number(points(r.diff)) === 0) return null
      const up = r.diff > 0
      const tip = t('home.topics.tip', { topic: name(r.x), now: fmt.pct(r.now), before: fmt.pct(r.was), diff: `${up ? '+' : '−'}${points(r.diff)}` })
      return h('span', { class: `home-arrow ${up ? 'is-up' : 'is-down'}`, title: tip, role: 'img', 'aria-label': tip }, up ? '▲' : '▼')
    }
    const table = (part) => UI.DataTable({
      emptyText: t('home.topics.empty'), pageSize: part.length,
      rows: part,
      columns: [
        { label: t('home.col.issue'), render: (r) => UI.EntityLink({ type: 'topic', key: String(r.k), label: name(r.x) }) },
        { label: t('home.col.articles'), num: true, render: (r) => fmt.int(r.n) },
        { label: t('home.col.share'), num: true, render: (r) => h('span', { class: 'home-share' }, arrow(r), fmt.pct(r.now)) }
      ]
    })
    const half = Math.ceil(rows.length / 2)
    return card('c-7 home-topics', head, h('div', { class: 'home-topics-cols' }, table(rows.slice(0, half)), table(rows.slice(half))))
  }

  // The quick access: four buttons in a 2×2 grid, each with the name of the page, a short line (not every page has one) and an arrow. The card ends where the buttons end.
  const QUICK = [['speeches', '/speeches', 'tab.world.speeches', true], ['pi', '/narrative', 'tab.world.pi', true], ['politics', '/elections', 'nav.politics', false], ['file', '/contradictions', 'tab.people.file', true]]
  function QuickCard () {
    return card('c-5 home-quick', cardHead(t('home.quick.title'), null, t('home.quick.info')),
      h('ul', { class: 'home-links' }, QUICK.map(([key, route, label, line]) => h('li', {},
        h('a', { href: Shell.hrefOf(route) }, h('span', { class: 'home-link-main' }, h('strong', {}, t(label)), line ? h('span', { class: 'muted-text' }, t(`home.quick.${key}`)) : null), Icon('chevron-right', 'icon icon-sm'))))))
  }

  window.Home = { index, dayInfo, DayCard, Calendar, TopicsCard, QuickCard }
})()
