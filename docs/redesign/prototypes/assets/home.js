// The cards of Αρχική: the stories of a day, the calendar of a month, the topics that rise and fall and the shortcuts to the analyses.
// Load after dash.js, mme.js and spread.js. index.html draws the page.
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

  const STORIES = 6

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
        h('span', { class: 'home-day-delta' }, i > 0 && totals[i - 1] > 0 ? `${fmt.signed(((totals[i] - totals[i - 1]) / totals[i - 1]) * 100)}%` : '–'))))
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

  // The topics whose share of the news changed the most: the last days of the period against the days before. The center line is the share before.
  function TrendsCard ({ home, i0, i1 }) {
    const len = i1 - i0 + 1
    const w = Math.min(7, Math.floor(len / 2))
    const head = (info, finding) => cardHead(t('home.trends.title'), null, `${finding ? `${finding}. ` : ''}${info}`)
    if (w < 2) return card('c-5', head(t('home.trends.info', { n: 7 })), emptyText(t('home.trends.empty')))
    const range = (a, b) => (k) => sum(home.issueDaily[k].slice(a, b + 1))
    const now = range(i1 - w + 1, i1)
    const before = range(i1 - 2 * w + 1, i1 - w)
    const news = home.issues.map((x, k) => ({ x, k })).filter((r) => !r.x.soft)
    const nowTotal = sum(news.map((r) => now(r.k)))
    const beforeTotal = sum(news.map((r) => before(r.k)))
    const rows = news.filter((r) => !r.x.catchAll && now(r.k) + before(r.k) >= 100 && nowTotal && beforeTotal)
      .map((r) => ({ ...r, now: now(r.k) / nowTotal, before: before(r.k) / beforeTotal })).map((r) => ({ ...r, diff: r.now - r.before }))
    const up = rows.filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 4)
    const down = rows.filter((r) => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 4)
    const shown = [...up, ...down]
    const day = (i) => fmt.date(home.dates[i], { day: 'numeric', month: 'short' })
    const sub = t('home.trends.sub', { cur: `${day(i1 - w + 1)} – ${day(i1)}`, prev: `${day(i1 - 2 * w + 1)} – ${day(i1 - w)}` })
    if (!shown.length) return card('c-5', head(t('home.trends.info', { n: w })), h('p', { class: 'dcard-sub' }, sub), emptyText(t('home.trends.empty')))
    const scale = Math.max(0.01, ...shown.map((r) => Math.abs(r.diff)))
    const points = (v) => fmt.dec(Math.abs(v * 100))
    const finding = up.length ? t('home.trends.finding', { topic: name(up[0].x), diff: points(up[0].diff) }) : null
    const barRows = shown.map((r) => ({
      label: UI.EntityLink({ type: 'topic', key: String(r.k), label: name(r.x) }),
      text: fmt.pct(r.now),
      bar: Spread.DiffTrack(r.diff, scale, t('home.trends.tip', { topic: name(r.x), now: fmt.pct(r.now), before: fmt.pct(r.before), diff: `${r.diff >= 0 ? '+' : '−'}${points(r.diff)}` }))
    }))
    return card('c-5', head(t('home.trends.info', { n: w }), finding), h('p', { class: 'dcard-sub' }, sub), UI.BarList(barRows),
      UI.Legend([{ label: t('home.trends.more'), color: 'var(--emph-more)' }, { label: t('home.trends.less'), color: 'var(--emph-less)' }]))
  }

  // The shortcuts to the analyses: the name, one line about it and an arrow.
  const ANALYSES = [['speeches', '/speeches'], ['pi', '/narrative'], ['greekturkish', '/war'], ['coverage', '/coverage'], ['france', '/france-riots']]
  function AnalysesCard () {
    return card('c-12 home-analyses', cardHead(t('home.analyses.title'), null, t('home.analyses.info')),
      h('ul', { class: 'home-links' }, ANALYSES.map(([key, route]) => h('li', {},
        h('a', { href: Shell.hrefOf(route) }, h('span', { class: 'home-link-main' }, h('strong', {}, t(`tab.world.${key}`)), h('span', { class: 'muted-text' }, t(`home.analyses.${key}`))), Icon('chevron-right', 'icon icon-sm'))))))
  }

  window.Home = { index, dayInfo, DayCard, Calendar, TrendsCard, AnalysesCard }
})()
