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

  // The masthead of the hero, played once on each visit: it types "ΑΠΟΤΥΠΩΜΑ ΤΥΠΟΥ", a "/" cuts in and the letters change to the logo "ΑΠΟΤ/ΥΠΟΣ",
  // then the "/" moves right, the name closes up and the line ends "ΑΠΟΤΥΠΟΣ / ΠΑΡΑΤΗΡΗΤΗΡΙΟ ΕΛΛΗΝΙΚΩΝ ΜΜΕ".
  // Each letter is a span with a key: a letter that stays slides to its new place (FLIP), a new one types in, an old one fades out.
  // An invisible copy of the last line keeps the height, so the page under it does not move. With reduced motion the last line shows at once.
  const MAST_FROM = 'ΑΠΟΤΥΠΩΜΑ ΤΥΠΟΥ'
  const MAST_GLYPHS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'
  function Masthead () {
    const tail = t('home.hero.eyebrow').toLocaleUpperCase(App.locale)
    const keyed = (text, prefix) => [...text].map((c, i) => ({ k: `${prefix}${i}`, c }))
    const name = [['a0', 'Α'], ['a1', 'Π'], ['a2', 'Ο'], ['a3', 'Τ'], ['a4', 'Υ'], ['a5', 'Π'], ['a6', 'Ο'], ['a7', 'Σ']].map(([k, c]) => ({ k, c }))
    const slash = { k: 'sl', c: '/' }
    const steps = [
      keyed(MAST_FROM, 'a'),
      [...name.slice(0, 4), slash, ...name.slice(4)],
      [...name, { k: 's1', c: ' ' }, slash, { k: 's2', c: ' ' }, ...keyed(tail, 't')]
    ]
    const last = steps[steps.length - 1]
    const line = h('span', { class: 'mast-line', 'aria-hidden': 'true' })
    const sizer = h('span', { class: 'mast-line mast-sizer', 'aria-hidden': 'true' })
    const caret = h('span', { class: 'mast-caret', 'aria-hidden': 'true' })
    const spans = new Map()
    const node = h('h1', { class: 'home-mast', id: 'home-hero-title' }, h('span', { class: 'visually-hidden' }, `${t('site.name')} / ${t('home.hero.eyebrow')}`), sizer, line)

    const span = (x) => {
      if (!spans.has(x.k)) spans.set(x.k, h('span', { class: x.c === '/' ? 'mast-ch mast-slash' : 'mast-ch' }, x.c))
      return spans.get(x.k)
    }
    // The words do not break inside; the line breaks only at the spaces.
    function words (tokens, make) {
      const out = []
      let word = []
      const close = () => { if (word.length) { if (out.length) out.push(' '); out.push(h('span', { class: 'mast-word' }, word)) } word = [] }
      tokens.forEach((x) => { if (x.c === ' ') close(); else word.push(make(x)) })
      close()
      return out
    }
    sizer.append(...words(last, (x) => h('span', { class: x.c === '/' ? 'mast-ch mast-slash' : 'mast-ch' }, x.c)))

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      line.append(...words(last, span))
      return node
    }

    const ease = 'cubic-bezier(0.2, 0.7, 0.2, 1)'
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const caretTo = (el) => {
      const box = line.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      caret.style.transform = `translate(${r.right - box.left + 2}px, ${r.top - box.top}px)`
    }
    // A letter that changes runs through a few letters first.
    function scramble (el, to, ms = 420) {
      const end = performance.now() + ms
      const tick = () => {
        if (performance.now() >= end) { el.textContent = to; return }
        el.textContent = MAST_GLYPHS[Math.floor(Math.random() * MAST_GLYPHS.length)]
        setTimeout(tick, 60)
      }
      tick()
    }

    async function to (tokens, { type = 55 } = {}) {
      const keys = new Set(tokens.map((x) => x.k))
      const gone = [...spans].filter(([k]) => !keys.has(k))
      if (gone.length) {
        await Promise.all(gone.map(([, el], i) => el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-0.18em)' }],
          { duration: 220, delay: (gone.length - 1 - i) * 22, easing: 'ease-in', fill: 'forwards' }).finished))
        gone.forEach(([k]) => spans.delete(k))
      }
      const before = new Map([...spans].map(([k, el]) => [k, el.getBoundingClientRect()]))
      const fresh = tokens.filter((x) => x.c !== ' ' && !spans.has(x.k))
      fresh.forEach((x) => { span(x).style.opacity = '0' })
      line.replaceChildren(...words(tokens, span), caret)
      before.forEach((r, k) => {
        const el = spans.get(k)
        const n = el.getBoundingClientRect()
        const dx = r.left - n.left
        const dy = r.top - n.top
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 620, easing: ease })
      })
      tokens.forEach((x) => { const el = spans.get(x.k); if (before.has(x.k) && el.textContent !== x.c) scramble(el, x.c) })
      // The "/" cuts in from the top, like a stroke of the pen. The letters type in from the left.
      for (const x of fresh) {
        const el = spans.get(x.k)
        el.style.opacity = ''
        if (x.c === '/') {
          el.animate([{ clipPath: 'inset(0 0 100% 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 380, easing: ease })
          await sleep(160)
          continue
        }
        el.animate([{ opacity: 0, transform: 'translateY(0.22em)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: ease })
        caretTo(el)
        await sleep(type)
      }
      const end = [...line.querySelectorAll('.mast-ch')].pop()
      if (end) caretTo(end)
    }

    requestAnimationFrame(async () => {
      line.append(caret)
      await sleep(350)
      await to(steps[0], { type: 70 })
      await sleep(750)
      await to(steps[1])
      await sleep(1300)
      await to(steps[2], { type: 32 })
      await sleep(900)
      caret.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => caret.remove())
    })
    return node
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

  // The head of a section of Αρχική: the title with the "/" of the site and a line under it.
  function SectionHead ({ id, title, lead }) {
    return h('header', { class: 'home-section-head', id },
      h('h2', { class: 'home-section-title' }, title), lead ? h('p', { class: 'home-section-lead' }, lead) : null)
  }

  window.Home = { index, dayInfo, DayCard, Calendar, TopicsCard, QuickCard, Hero, SectionHead }
})()
