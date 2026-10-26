// The cards of Αρχική: the top story of a day, the calendar of days, the topics that rise and fall and the shortcuts to the analyses.
// Load after dash.js, mme.js and spread.js. index.html draws the page.
(function () {
  const { t, fmt, h, Icon, safeUrl } = window.App
  const { card, cardHead, emptyText, groupColor } = Dash

  const name = (x) => x[App.locale] || x.el
  const sum = (arr) => arr.reduce((a, b) => a + b, 0)

  // The lookups of a day: the stories of stories.js ranked by articles for each day, the story of the media set with the same name (it has the articles of each outlet),
  // and the headlines of the set for each date. A generic story ("Άλλα διεθνή") is not a story, so it does not count.
  function index ({ stories, set, groups }) {
    const byDay = stories.dates.map(() => [])
    stories.stories.forEach((s) => {
      if (s.generic) return
      for (let j = 0; j < s.days.length; j += 2) byDay[s.days[j]].push({ s, n: s.days[j + 1] })
    })
    byDay.forEach((list) => list.sort((a, b) => b.n - a.n))
    const mmeOf = new Map(set ? set.stories.map((s, i) => [s.el, i]) : [])
    const headlines = new Map()
    if (set) {
      set.headlines.forEach((rows, k) => rows.forEach(([date, title, url, angle, , story]) => {
        if (!headlines.has(date)) headlines.set(date, [])
        headlines.get(date).push({ k, title, url, angle, story })
      }))
    }
    return { byDay, mmeOf, headlines, set, dates: stories.dates, issues: stories.issues, groupSlug: new Map((groups || []).map((g) => [g.name, g.slug])) }
  }

  // Everything the card says about one day: its top story, the outlets and groups that ran it, a few headlines and the next stories.
  function dayInfo (ix, d) {
    const lead = ix.byDay[d]?.[0]
    if (!lead) return null
    const { s, n } = lead
    const date = ix.dates[d]
    const perOutlet = new Map()
    const m = ix.mmeOf.get(s.el)
    if (m !== undefined) {
      const rows = ix.set.stories[m].t
      for (let j = 0; j < rows.length; j += 3) if (rows[j + 1] === d) perOutlet.set(rows[j], rows[j + 2])
    }
    const outlets = [...perOutlet].map(([k, c]) => ({ ...ix.set.outlets[k], k, n: c })).sort((a, b) => b.n - a.n)
    const groups = new Map()
    outlets.filter((o) => o.group).forEach((o) => {
      const g = groups.get(o.group) || { name: o.group, count: 0, n: 0 }
      g.count++
      g.n += o.n
      groups.set(o.group, g)
    })
    const seen = new Set()
    const articles = (ix.headlines.get(date) || []).filter((x) => x.story === s.el && !seen.has(x.k) && seen.add(x.k)).slice(0, 3)
      .map((x) => ({ ...x, outlet: ix.set.outlets[x.k].name }))
    return { d, date, story: s, n, topic: ix.issues[s.issue], outlets, groups: [...groups.values()].sort((a, b) => b.count - a.count || b.n - a.n),
      noGroup: outlets.filter((o) => !o.group).length, articles, others: ix.byDay[d].slice(1, 6), known: m !== undefined }
  }

  const arrow = (v) => `${v >= 0 ? '▲' : '▼'} ${fmt.dec(Math.abs(v * 100))}%`
  const chipLink = (href, label, color, extra) => h('a', { class: 'chip home-chip', href },
    color ? h('span', { class: 'dot', style: `--dot:${color}`, 'aria-hidden': 'true' }) : null, label, extra ? h('span', { class: 'home-chip-n' }, extra) : null)
  const CHIPS = 8

  // The top story of a day. The totals are the articles of all the outlets for each day, to compare the day with the day before and with the same day a week earlier.
  function DayCard (info, { totals, isLast, groupSlug }) {
    if (!info) return card('c-5 home-day', cardHead(t('home.day.title'), null, t('home.day.info')), emptyText(t('home.day.empty')))
    const { d, story, topic } = info
    const ref = (i) => (i >= 0 && totals[i] > 0 ? (totals[d] - totals[i]) / totals[i] : null)
    const fact = (label, value) => h('div', { class: 'home-fact' }, h('dt', {}, label), h('dd', {}, value))
    const compare = h('dl', { class: 'home-compare' },
      fact(t('home.day.total'), fmt.int(totals[d])),
      ...[[t('home.day.vsPrev'), ref(d - 1)], [t('home.day.vsWeek'), ref(d - 7)]].map(([label, v]) => fact(label, v === null ? '–' : arrow(v))))

    const list = (label, items) => (items.length ? h('div', { class: 'home-block' }, h('p', { class: 'home-label' }, label), h('div', { class: 'home-chips' }, items)) : null)
    const outletChips = info.outlets.slice(0, CHIPS).map((o) => chipLink(`outlet-v2.html?slug=${o.slug}`, o.name, groupColor(o.group)))
    if (info.outlets.length > CHIPS) outletChips.push(h('span', { class: 'chip chip-quiet' }, `+${info.outlets.length - CHIPS}`))
    const groupChips = info.groups.map((g) => chipLink(groupSlug.get(g.name) ? `group-v2.html?g=${encodeURIComponent(groupSlug.get(g.name))}` : '404.html', g.name, groupColor(g.name), fmt.int(g.count)))
    if (info.noGroup) groupChips.push(h('span', { class: 'chip chip-quiet' }, t('home.day.nogroup', { n: info.noGroup })))

    const articles = info.articles.length
      ? h('div', { class: 'home-block' }, h('p', { class: 'home-label' }, t('home.day.articles')),
        h('ul', { class: 'home-articles' }, info.articles.map((a) => h('li', {},
          safeUrl(a.url) ? h('a', { href: safeUrl(a.url), rel: 'noopener', target: '_blank' }, a.title) : h('span', {}, a.title),
          h('span', { class: 'muted-text' }, a.outlet)))))
      : null
    const others = info.others.length
      ? h('div', { class: 'home-block' }, h('p', { class: 'home-label' }, t('home.day.others')),
        h('ul', { class: 'home-others' }, info.others.map((o) => h('li', {}, UI.EntityLink({ type: 'story', key: String(o.s.id), label: name(o.s) }), h('span', { class: 'muted-text' }, fmt.int(o.n))))))
      : null

    const meta = info.outlets.length ? t('home.day.meta.outlets', { n: fmt.int(info.n), m: info.outlets.length }) : t('home.day.meta', { n: fmt.int(info.n) })
    return card('c-5 home-day',
      cardHead(t('home.day.title'), isLast ? h('span', { class: 'pill home-pill' }, t('home.day.latest')) : null, t('home.day.info')),
      h('p', { class: 'home-day-date' }, fmt.date(info.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
      h('h3', { class: 'home-day-story' }, name(story)),
      h('p', { class: 'home-day-meta' }, topic ? [h('strong', {}, name(topic)), ' · '] : null, meta),
      compare,
      list(t('home.day.outlets'), outletChips),
      list(t('home.day.groups'), groupChips),
      articles,
      others,
      h('div', { class: 'home-actions' },
        h('a', { class: 'button is-primary', href: `story-v2.html?id=${story.id}` }, t('home.day.story'), Icon('chevron-right', 'icon icon-sm')),
        topic ? h('a', { class: 'button', href: `topic-v2.html?i=${story.issue}` }, t('home.day.topic'), Icon('chevron-right', 'icon icon-sm')) : null,
        h('a', { class: 'button', href: 'stories-v2.html' }, t('home.day.stories'), Icon('chevron-right', 'icon icon-sm'))))
  }

  // The calendar: one tile for each day of the period, with the number of articles and a bar of the same number. It scrolls sideways and a tile picks the day.
  function DayStrip ({ dates, totals, i0, i1, selected, onPick }) {
    const max = Math.max(...totals.slice(i0, i1 + 1), 1)
    const list = h('ul', { class: 'home-days' })
    const buttons = new Map()
    for (let i = i0; i <= i1; i++) {
      const iso = dates[i]
      const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
      const btn = h('button', { type: 'button', class: weekday === 0 || weekday === 6 ? 'home-day-btn is-weekend' : 'home-day-btn', 'aria-pressed': String(i === selected),
        'aria-label': t('home.days.aria', { date: fmt.date(iso), n: fmt.int(totals[i]) }), onClick: () => onPick(i) },
      h('span', { class: 'home-day-dow' }, fmt.date(iso, { weekday: 'short' })),
      h('span', { class: 'home-day-num' }, String(Number(iso.slice(8)))),
      h('span', { class: 'home-day-bar', 'aria-hidden': 'true' }, h('i', { style: `height:${Math.max(4, Math.round((totals[i] / max) * 100))}%` })),
      h('span', { class: 'home-day-n' }, fmt.int(totals[i])))
      buttons.set(i, btn)
      list.append(h('li', {}, h('span', { class: 'home-day-month' }, i === i0 || iso.endsWith('-01') ? fmt.date(iso, { month: 'long' }) : ''), btn))
    }
    const center = (i) => {
      const b = buttons.get(i)
      if (b) list.scrollLeft = b.offsetLeft - (list.clientWidth - b.offsetWidth) / 2
    }
    const step = (dir) => h('button', { type: 'button', class: 'icon-button', 'aria-label': t(dir < 0 ? 'home.days.prev' : 'home.days.next'),
      onClick: () => list.scrollBy({ left: dir * list.clientWidth * 0.8, behavior: 'smooth' }) }, Icon(dir < 0 ? 'chevron-left' : 'chevron-right', 'icon'))
    const node = card('home-calendar', cardHead(t('home.days.title'), h('div', { class: 'home-steps' }, step(-1), step(1)), t('home.days.info')), list)
    requestAnimationFrame(() => center(selected))
    return {
      node,
      select (i) {
        buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
        const b = buttons.get(i)
        if (b && (b.offsetLeft < list.scrollLeft || b.offsetLeft + b.offsetWidth > list.scrollLeft + list.clientWidth)) center(i)
      }
    }
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
    return card('', cardHead(t('home.analyses.title'), null, t('home.analyses.info')),
      h('ul', { class: 'home-links' }, ANALYSES.map(([key, route]) => h('li', {},
        h('a', { href: Shell.hrefOf(route) }, h('span', { class: 'home-link-main' }, h('strong', {}, t(`tab.world.${key}`)), h('span', { class: 'muted-text' }, t(`home.analyses.${key}`))), Icon('chevron-right', 'icon icon-sm'))))))
  }

  window.Home = { index, dayInfo, DayCard, DayStrip, TrendsCard, AnalysesCard }
})()
