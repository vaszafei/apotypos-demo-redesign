// The hero and the cards of Αρχική: the stories of a day, the topics of a day and the quick access.
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

  // The stories of a day: a story is picked to show it in the card, and its button opens its page. The card shows the story of the rank in info, and the picked day at the top right.
  function DayCard (info, { date, onStory, swap }) {
    const head = cardHead(t('home.day.title'), h('span', { class: 'home-date' }, fmt.date(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), t('home.day.info'))
    if (!info) return card('c-5 home-day', head, emptyText(t('home.day.empty')))
    const { story, topic } = info
    const total = sum(info.outlets.map((o) => o.n))
    const slices = info.outlets.map((o) => ({ name: o.name, group: o.group, n: o.n, color: groupColor(o.group), slug: o.slug }))
    const outlets = slices.length ? h('div', { class: 'home-block' }, OutletStack(slices, { total, count: info.outlets.length })) : null

    const stories = h('ul', { class: 'home-stories' }, info.list.map((o, r) => h('li', { class: r === info.rank ? 'is-current' : null },
      h('button', { type: 'button', class: 'home-story-pick', 'aria-pressed': String(r === info.rank), onClick: () => onStory(r) },
        h('span', { class: 'home-story-name' }, name(o.s)), h('span', { class: 'muted-text' }, fmt.int(o.n))),
      h('a', { class: 'button button-sm home-story-go', href: `story-v2.html?id=${o.s.id}`, 'aria-label': `${t('home.day.open')}: ${name(o.s)}` }, t('home.day.open'), Icon('chevron-right', 'icon icon-sm')))))
    // The list has every story of the day and scrolls inside the card. A new day starts at the top; a pick on the same day keeps the place.
    const sameDay = info.d === listDay
    listDay = info.d
    if (!sameDay) listTop = 0
    stories.addEventListener('scroll', () => { listTop = stories.scrollTop })
    requestAnimationFrame(() => { stories.scrollTop = listTop })

    // swap: 'day' draws the whole card in again, 'story' only the story, its topic and its outlets (the list keeps its place).
    return card(`c-5 home-day${swap ? ` is-swap is-swap-${swap}` : ''}`, head,
      h('h3', { class: 'home-day-story' }, name(story)),
      h('p', { class: 'home-day-meta' }, topic ? [h('span', { class: 'home-topic-label' }, t('home.day.topic')), ' ', UI.EntityLink({ type: 'topic', key: String(story.issue), label: name(topic) })] : null,
        info.outlets.length ? null : [topic ? ' · ' : null, t('home.day.meta', { n: fmt.int(info.n) })]),
      outlets,
      stories)
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
  const QUICK = [['topics', '/trends', 'tab.media.topics', false], ['media', '/media', 'nav.media', false], ['politics', '/elections', 'nav.politics', false], ['france', '/france-riots', 'tab.world.france', false]]
  function QuickCard () {
    return card('c-5 home-quick', cardHead(t('home.quick.title')),
      h('ul', { class: 'home-links' }, QUICK.filter(([, route]) => !Shell.isHidden(route)).map(([key, route, label, line]) => h('li', {},
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
    const collected = sum(totals.slice(i0, i1 + 1))
    const period = t('home.hero.period', { from: fmt.date(home.dates[i0], { day: 'numeric', month: 'long' }), to: fmt.date(home.dates[i1], { day: 'numeric', month: 'long', year: 'numeric' }) })
    // What the field shows now, in words. It only decorates: the same numbers are on the page below.
    const caption = h('p', { class: 'home-hero-caption', 'aria-hidden': 'true' })
    const field = window.HeroField({
      shapes: heroShapes({ home, totals, i0, i1 }),
      still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onShape: (shape) => { caption.textContent = shape.caption; caption.classList.toggle('is-empty', !shape.caption) }
    })
    return h('section', { class: 'home-hero', 'aria-labelledby': 'home-hero-title' },
      field, caption,
      h('div', { class: 'home-hero-inner' },
        Masthead(),
        h('div', { class: 'home-hero-search' }, search),
        chips.length ? h('div', { class: 'home-hero-try' }, h('span', { class: 'home-hero-try-label' }, t('home.hero.try')),
          chips.map((r) => h('button', { type: 'button', class: 'home-chip', onClick: () => search.open(name(r.x)) }, name(r.x)))) : null,
        // The same stat cards as the tabs of the site.
        h('div', { class: 'home-hero-stats' },
          Dash.Stat({ variant: 'compact', label: t('home.hero.articles'), value: fmt.int(collected), icon: 'document-text', tone: 'var(--cat-1)' }),
          Dash.Stat({ variant: 'compact', label: t('home.hero.outlets'), value: fmt.int(home.outlets.length), icon: 'newspaper', tone: 'var(--cat-3)' }),
          stories != null ? Dash.Stat({ variant: 'compact', label: t('home.hero.stories'), value: fmt.int(stories), icon: 'chart-bar', tone: 'var(--cat-4)' }) : null,
          Dash.Stat({ variant: 'compact', label: t('home.hero.days'), value: fmt.int(i1 - i0 + 1), icon: 'chart-pie', tone: 'var(--cat-5)' })),
        h('p', { class: 'home-hero-period' }, period)),
      h('a', { class: 'home-hero-more', href: '#home-today' }, t('home.hero.more'), Icon('chevron-down', 'icon icon-sm')))
  }

  // The masthead of the hero: the name as a small line, and the promise of the site as the headline. On each visit the name rises in, the "/" draws from the top (CSS).
  function Masthead () {
    const brand = t('site.name')
    const tail = t('home.hero.eyebrow')
    return h('div', { class: 'home-mast-block' },
      h('p', { class: 'home-mast', 'aria-label': `${t('site.name')} / ${t('home.hero.eyebrow')}` },
        h('span', { class: 'mast-part mast-name', 'aria-hidden': 'true' }, brand),
        h('span', { class: 'mast-slash', 'aria-hidden': 'true' }, '/'),
        h('span', { class: 'mast-part mast-tail', 'aria-hidden': 'true' }, tail)),
      h('h1', { class: 'home-headline', id: 'home-hero-title' }, t('home.hero.headline')))
  }

  // The pictures of the moving field: the "/" of the logo, then the data itself: the articles of each day, the agenda and the outlets.
  function heroShapes ({ home, totals, i0, i1 }) {
    const { color, SLOTS } = Dash
    const slash = {
      caption: '',
      draw (c, W, H) {
        const top = -H * 0.02; const bottom = H * 1.02; const lean = H * 0.42; const band = H * 0.14; const x = W / 2
        c.fillStyle = color('--accent')
        c.beginPath()
        c.moveTo(x + lean - band, top); c.lineTo(x + lean + band, top); c.lineTo(x - lean + band, bottom); c.lineTo(x - lean - band, bottom)
        c.fill()
      }
    }
    const daily = totals.slice(i0, i1 + 1)
    const days = {
      caption: t('home.hero.shape.days', { n: fmt.int(daily.length) }),
      draw (c, W, H) {
        const max = Math.max(...daily, 1)
        const slot = (W * 0.94) / daily.length
        c.fillStyle = color('--series-1')
        daily.forEach((v, i) => { const y = (v / max) * H * 0.82; c.fillRect(W * 0.03 + i * slot, H - y, slot * 0.72, y) })
      }
    }
    const issues = home.issues.map((x, k) => ({ x, n: sum(home.issueDaily[k].slice(i0, i1 + 1)) })).filter((r) => !r.x.soft && r.n > 0).sort((a, b) => b.n - a.n)
    const issueTotal = sum(issues.map((r) => r.n)) || 1
    const agenda = {
      caption: t('home.hero.shape.agenda', { n: fmt.int(issues.length) }),
      draw (c, W, H) {
        const R = H * 0.66
        let a = -Math.PI / 2
        issues.forEach((r, i) => {
          const end = a + (r.n / issueTotal) * Math.PI * 2
          c.fillStyle = i < SLOTS.length ? SLOTS[i] : color('--bar-muted')
          c.beginPath(); c.arc(W / 2, H / 2, R, a, end); c.arc(W / 2, H / 2, R * 0.74, end, a, true); c.fill()
          a = end
        })
      }
    }
    const outlets = home.outlets.map((o) => ({ n: sum(o.daily.slice(i0, i1 + 1)) })).sort((a, b) => b.n - a.n)
    const bubbles = {
      caption: t('home.hero.shape.outlets', { n: fmt.int(outlets.length) }),
      draw (c, W, H) {
        const max = outlets[0]?.n || 1
        const big = H * 0.13
        outlets.forEach((o, i) => {
          const turn = i * 2.39996
          const far = big * 0.92 * Math.sqrt(i)
          // The largest outlets have the colors of the charts, the others stay quiet.
          c.fillStyle = i < SLOTS.length ? SLOTS[i] : color('--bar-muted')
          c.beginPath()
          c.arc(W / 2 + far * Math.cos(turn) * 1.9, H / 2 + far * Math.sin(turn) * 0.82, big * Math.sqrt(o.n / max), 0, Math.PI * 2)
          c.fill()
        })
      }
    }
    return [slash, days, agenda, bubbles]
  }

  window.Home = { index, dayInfo, DayCard, TopicsCard, QuickCard, Hero }
})()
