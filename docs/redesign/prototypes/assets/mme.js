// The cards from the live page ΜΜΕ & πρόσωπα (apotypos.org/media), on the data of data/mme.js. Load after dash.js.
// Μέσα › Επισκόπηση (media-v2) and the page of one outlet (outlet-v2) use them. Each sum is for a period of days i0..i1.
(function () {
  const { t, fmt, h } = window.App
  const { card, cardHead, emptyText, textOn, color, seq } = Dash

  const name = (x) => x[App.locale] || x.el
  const sum = (arr) => arr.reduce((a, b) => a + b, 0)
  // Flat pairs [day, n, ...] summed over the period.
  function sumPairs (p, i0, i1) { let s = 0; for (let j = 0; j < p.length; j += 2) if (p[j] >= i0 && p[j] <= i1) s += p[j + 1]; return s }
  // Flat rows [day, a, b, c, ...] of width w: the sum of each value over the period.
  function sumRows (p, w, i0, i1) {
    const s = new Array(w - 1).fill(0)
    for (let j = 0; j < p.length; j += w) if (p[j] >= i0 && p[j] <= i1) for (let k = 1; k < w; k++) s[k - 1] += p[j + k]
    return s
  }
  const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}`
  const pct = (v) => fmt.pct(v)
  const pctRound = (v) => `${Math.round(v * 100)}%`

  // The presets of a set: those of its days (UI.periodPresets) and the last week.
  function presets (set) {
    const d = set.dates
    return [...UI.periodPresets(d), { key: 'last7', label: t('mme.range.last7'), from: d[Math.max(0, d.length - 7)], to: d[d.length - 1] }]
  }

  // All the sums of one period. The shares of a topic use the news (the topics with soft: false) as the base.
  function summary (set, i0, i1) {
    const nP = set.people.length
    const hard = set.issues.map((x) => !x.soft)
    const outlets = set.outlets.map((o, k) => {
      const c = [0, 0, 0, 0, 0, 0, 0]
      const row = set.od[k]
      for (let d = i0; d <= i1; d++) for (let j = 0; j < 7; j++) c[j] += row[d * 7 + j]
      const issues = set.oi[k].map((p) => sumPairs(p, i0, i1))
      const quotes = set.q[k].map((p) => sumPairs(p, i0, i1))
      const tone = set.mt[k].map((p) => sumRows(p, 4, i0, i1))
      return { ...o, k, n: c[0], news: c[1], cbKnown: c[2], cbYes: c[3], stance: [c[4], c[5], c[6]], issues, quotes, tone }
    })
    const active = outlets.filter((o) => o.n > 0)
    const issueN = set.issues.map((_, i) => sum(outlets.map((o) => o.issues[i])))
    const newsN = sum(issueN.filter((_, i) => hard[i]))
    const total = sum(outlets.map((o) => o.n))
    // The average of the outlets: the mean of the shares of the outlets with news, each outlet counts once.
    const withNews = active.filter((o) => o.news > 0)
    const avgShare = set.issues.map((_, i) => (withNews.length ? sum(withNews.map((o) => o.issues[i] / o.news)) / withNews.length : 0))
    const stories = set.stories.map((s, id) => {
      const per = new Array(outlets.length).fill(0)
      for (let j = 0; j < s.t.length; j += 3) if (s.t[j + 1] >= i0 && s.t[j + 1] <= i1) per[s.t[j]] += s.t[j + 2]
      const n = sum(per)
      return { ...s, id, per, n, reach: per.filter((v) => v > 0).length }
    }).filter((s) => s.n > 0)
    // Over the whole window, the smaller stories (rows per outlet only) join the list.
    if (i0 === 0 && i1 === set.dates.length - 1) {
      (set.lite || []).forEach((s) => {
        const per = new Array(outlets.length).fill(0)
        for (let j = 0; j < s.o.length; j += 2) per[s.o[j]] = s.o[j + 1]
        stories.push({ ...s, generic: false, per, n: sum(per), reach: per.filter((v) => v > 0).length })
      })
    }
    stories.sort((a, b) => b.n - a.n)
    const storyCount = set.sd.filter((p) => sumPairs(p, i0, i1) >= 3).length
    const quotesByIssue = set.qi.map((row) => row.map((p) => sumPairs(p, i0, i1)))
    const personQuotes = set.people.map((_, p) => sum(outlets.map((o) => o.quotes[p])))
    return { set, i0, i1, outlets, active, issueN, newsN, total, avgShare, stories, storyCount, quotesByIssue, personQuotes, nP, hard }
  }

  // A share of an issue in the news of an outlet.
  const shareOf = (o, i) => (o.news ? o.issues[i] / o.news : 0)
  const critShare = (st) => (sum(st) ? st[0] / sum(st) : 0)

  // The link to the page of an outlet. Only the outlets of the Greek set have a page.
  function outletLink (S, o) {
    return S.set.country === 'GR' ? UI.EntityLink({ type: 'outlet', key: o.slug, label: o.name }) : h('span', {}, o.name)
  }

  // The topics as chips with their share of the news. A chip opens its topic in the card «Ένα θέμα, όλα τα μέσα».
  function ChipsCard (S, { onPick, picked }) {
    const rows = S.set.issues.map((x, i) => ({ x, i, v: S.newsN ? S.issueN[i] / S.newsN : 0 })).filter((r) => S.hard[r.i] && !r.x.catchAll && S.issueN[r.i] > 0).sort((a, b) => b.v - a.v)
    return card('c-12', cardHead(t('mme.chips.title'), null, t('mme.chips.info')),
      rows.length
        ? h('ul', { class: 'mme-chips' }, rows.map((r) => h('li', {}, h('button', { type: 'button', class: 'mme-chip', 'aria-pressed': String(r.i === picked), onClick: () => onPick(r.i) },
          name(r.x), h('span', { class: 'mme-chip-n' }, pctRound(r.v))))))
        : emptyText(t('media2.empty.list')))
  }

  // The columns of the outlets of a matrix: from the largest outlet to the smallest.
  const columnsOf = (S) => S.active.slice().sort((a, b) => b.n - a.n)
  const turnedHead = (first, extra, cols) => h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, first), extra.map((x) => h('th', { scope: 'col', class: 'mme-num-col' }, x)), cols.map((o) => h('th', { scope: 'col' }, o.name))))
  const matrixWrap = (caption, table) => h('div', { class: 'matrix-wrap', tabindex: '0', role: 'region', 'aria-label': caption }, table)

  // Stories × outlets. The dot is the share of the story in the articles of the outlet.
  function StoriesCard (S, { generic, onGeneric }) {
    const cols = columnsOf(S)
    // The stories of the soft topics (weather, sports, lifestyle) are left out, as on the live page.
    const rows = S.stories.filter((s) => (generic || !s.generic) && s.issue >= 0 && S.hard[s.issue]).slice(0, 25)
    const shares = rows.flatMap((s) => cols.map((o) => s.per[o.k] / o.n))
    const maxShare = Math.max(...shares, 0.0001)
    const lowest = Math.min(...shares.filter((v) => v > 0), maxShare)
    // The dot grows with the square root of the share. The key shows the smallest and the largest dot of the card.
    const dotSize = (share) => 3 + 11 * Math.sqrt(share / maxShare)
    const dotKey = h('p', { class: 'dcard-sub mme-dot-key' }, h('span', { class: 'mme-dot', style: { width: `${dotSize(lowest)}px`, height: `${dotSize(lowest)}px` } }), ` ${t('mme.stories.key.low', { share: fmt.pct(lowest) })} · `,
      h('span', { class: 'mme-dot', style: { width: `${dotSize(maxShare)}px`, height: `${dotSize(maxShare)}px` } }), ` ${t('mme.stories.key.high', { share: fmt.pct(maxShare) })}`)
    const toggle = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: generic, onChange: (e) => onGeneric(e.target.checked) }), t('mme.stories.generic'))
    // The header is as tall as the longest outlet name, so the names never overlap or clip.
    const head = Math.ceil(Math.max(...cols.map((o) => o.name.length), 0) * 6.4) + 14
    const table = h('table', { class: 'matrix matrix-turned mme-dots', style: { '--mme-head': `${head}px` } },
      h('caption', { class: 'visually-hidden' }, t('mme.stories.title')),
      turnedHead(t('mme.stories.col'), ['n'], cols),
      h('tbody', {}, rows.map((s) => h('tr', {},
        h('th', { scope: 'row' }, h('span', { class: 'mme-story-name' }, name(s)), h('span', { class: 'muted-text mme-story-sub' }, t('mme.stories.reach', { issue: s.issue >= 0 ? name(S.set.issues[s.issue]) : '', reach: s.reach, total: S.active.length }))),
        h('td', { class: 'mme-num-col' }, fmt.int(s.n)),
        cols.map((o) => {
          const n = s.per[o.k]
          const title = n ? t('mme.stories.cell', { outlet: o.name, story: name(s), n: fmt.int(n), share: fmt.pct(n / o.n) }) : t('mme.stories.cell.none', { outlet: o.name, story: name(s) })
          const size = n ? dotSize(n / o.n) : 0
          return h('td', { title, 'aria-label': title }, n ? h('span', { class: 'mme-dot', style: { width: `${size}px`, height: `${size}px` } }) : h('span', { class: 'mme-dot-none' }))
        })))))
    return card('c-12', cardHead(t('mme.stories.title'), toggle, t('mme.stories.info')), rows.length ? [matrixWrap(t('mme.stories.title'), table), dotKey] : emptyText(t('media2.empty.list')))
  }

  // The color of a share in the agenda: a step of the sequential ramp, darker for a larger share. 20% or more is the darkest step.
  const shareColor = (v) => seq(Math.min(1, v / 0.2))

  // Outlets × topics: the share of each topic in the news of each outlet.
  function AgendaCard (S) {
    const cols = S.set.issues.map((x, i) => ({ x, i })).filter((c) => S.hard[c.i] && !c.x.catchAll && S.avgShare[c.i] >= 0.01).sort((a, b) => S.avgShare[b.i] - S.avgShare[a.i])
    const rows = columnsOf(S).filter((o) => o.news > 0)
    const cell = (o, c, avgRow) => {
      const v = avgRow ? S.avgShare[c.i] : shareOf(o, c.i)
      const strong = !avgRow && v >= 0.02 && v >= 1.75 * S.avgShare[c.i]
      const title = avgRow ? `${t('mme.avg')} · ${name(c.x)}: ${pct(v)}` : t('mme.agenda.cell', { outlet: o.name, topic: name(c.x), share: pct(v), avg: pct(S.avgShare[c.i]) })
      const colors = v ? shareColor(v) : { background: 'transparent', color: 'var(--text-secondary)' }
      return h('td', { class: strong ? 'mme-strong' : null, style: colors, title, 'aria-label': title }, v >= 0.005 ? String(Math.round(v * 100)) : '')
    }
    const table = h('table', { class: 'matrix matrix-turned mme-heat' },
      h('caption', { class: 'visually-hidden' }, t('mme.agenda.title')),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('media.col.outlet')), cols.map((c) => h('th', { scope: 'col' }, name(c.x))))),
      h('tbody', {},
        h('tr', { class: 'mme-avg-row' }, h('th', { scope: 'row' }, t('mme.avg')), cols.map((c) => cell(null, c, true))),
        rows.map((o) => h('tr', {}, h('th', { scope: 'row' }, outletLink(S, o)), cols.map((c) => cell(o, c, false))))))
    const key = h('span', { class: 'legend-inline' }, h('span', {}, h('span', { class: 'mme-key-strong', 'aria-hidden': 'true' }), t('mme.agenda.key')))
    return card('c-12', cardHead(t('mme.agenda.title'), key, t('mme.agenda.info')), rows.length && cols.length ? matrixWrap(t('mme.agenda.title'), table) : emptyText(t('media2.empty.list')))
  }

  // A diverging color for a net balance from −1 to +1: red for critical, violet for sympathetic, a warm gray in the middle (tokens.css).
  function netColor (net) {
    // The step eases in, so small values stay pale.
    const k = Math.min(1, Math.abs(net) / 0.5) ** 1.3 * 0.85
    const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const end = rgbOf(color(net < 0 ? '--stance-critical' : '--stance-supportive'))
    const mid = rgbOf(color('--div-mid'))
    const rgb = mid.map((v, i) => Math.round(v + (end[i] - v) * k))
    const hex = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
    return { background: hex, color: textOn(hex) }
  }
  const netOf = (tone) => { const n = sum(tone); return n ? (tone[2] - tone[0]) / n : 0 }

  const STANCE_COLORS = ['var(--stance-critical)', 'var(--stance-neutral)', 'var(--stance-supportive)']
  const STANCE_CODES = ['critical', 'neutral', 'supportive']
  const stanceSegments = (st) => STANCE_CODES.map((c, i) => ({ label: t(`stance.${c}`), value: st[i], color: STANCE_COLORS[i] }))
  // The stance shares of an outlet or a topic in one UI.StackedBar.
  function StanceBar (st, label, marker) {
    const n = sum(st) || 1
    return UI.StackedBar(stanceSegments(st), { legend: false, marker, label: `${label ? label + ': ' : ''}${STANCE_CODES.map((c, i) => `${t(`stance.${c}`)} ${pct(st[i] / n)}`).join(', ')}` })
  }
  const stanceKey = () => UI.Legend(STANCE_CODES.map((c, i) => ({ label: t(`stance.${c}`), color: STANCE_COLORS[i] })))

  // The stance to the government in each outlet: critical, neutral, supportive.
  // The info says which outlets are the most and the least critical. The tick on each bar is the critical share of all the articles,
  // and the long list runs in two columns.
  function GovCard (S) {
    const rows = S.active.filter((o) => sum(o.stance) > 0).sort((a, b) => (sum(b.stance) >= 30) - (sum(a.stance) >= 30) || critShare(b.stance) - critShare(a.stance))
    const topic = S.set.country === 'GR' ? t('mme.gov.title') : t('mme.gov.title.il')
    const all = [0, 1, 2].map((j) => sum(rows.map((o) => o.stance[j])))
    const avg = critShare(all)
    const scored = rows.filter((o) => sum(o.stance) >= 30)
    const finding = scored.length > 1
      ? t('mme.gov.finding', { most: scored[0].name, a: pctRound(critShare(scored[0].stance)), least: scored[scored.length - 1].name, b: pctRound(critShare(scored[scored.length - 1].stance)) })
      : null
    return card('', cardHead(topic, null, `${finding ? `${finding}. ` : ''}${t('mme.gov.info')}`),
      h('div', { class: 'mme-key-row' }, UI.Legend([...STANCE_CODES.map((c, i) => ({ label: t(`stance.${c}`), color: STANCE_COLORS[i] })), { label: t('mme.gov.avg', { v: pctRound(avg) }), tick: true }])),
      rows.length
        ? UI.BarList(rows.map((o) => ({ cls: sum(o.stance) < 30 ? 'is-faint' : null, label: outletLink(S, o), text: `${pctRound(critShare(o.stance))} · ${t('mme.n', { n: fmt.int(sum(o.stance)) })}`, bar: StanceBar(o.stance, o.name, avg) })), { columns: 2 })
        : emptyText(t('media2.empty.list')))
  }

  // One topic, all outlets: the share in each outlet, the stories, the stance and the people who speak.
  function TopicCard (S, { topic, onTopic }) {
    const options = S.set.issues.map((x, i) => ({ x, i })).filter((r) => S.hard[r.i] && S.issueN[r.i] > 0).sort((a, b) => S.issueN[b.i] - S.issueN[a.i])
    const first = options.find((r) => !r.x.catchAll) || options[0]
    const i = options.some((r) => r.i === topic) ? topic : (first ? first.i : -1)
    const pick = Dash.select(t('mme.topic.pick'), i, options.map((r) => ({ value: r.i, label: name(r.x) })), (v) => onTopic(Number(v)))
    if (i < 0) return card('c-12', cardHead(t('mme.topic.title'), pick, t('mme.topic.info')), emptyText(t('media2.empty.list')))
    const x = S.set.issues[i]
    const shares = S.active.filter((o) => o.news > 0).map((o) => ({ o, v: shareOf(o, i), n: o.issues[i] })).sort((a, b) => b.v - a.v)
    const max = Math.max(...shares.map((r) => r.v), S.avgShare[i], 0.0001)
    // The key of the tick (the average of the outlets) is on the line of the caption.
    const sharePanel = h('div', { class: 'mme-panel' }, h('h3', { class: 'rows-caption' }, t('mme.topic.share'), ' · ', h('span', { class: 'swatch-tick', 'aria-hidden': 'true' }), ` ${t('find.avg', { n: pct(S.avgShare[i]) })}`),
      UI.BarList(shares.map((r) => ({ label: outletLink(S, r.o), text: pct(r.v), value: r.v, tip: `${r.o.name}: ${pct(r.v)}, ${t('mme.avg')} ${pct(S.avgShare[i])}` })), { max, cls: 'mme-share', reference: { value: S.avgShare[i] } }))
    const stories = S.stories.filter((s) => s.issue === i && !s.generic).slice(0, 10)
    const storyPanel = h('div', { class: 'mme-panel' }, h('h3', { class: 'rows-caption' }, t('mme.topic.stories')),
      stories.length
        ? h('ul', { class: 'rows mme-rows' }, stories.map((s) => h('li', {}, h('span', { class: 'row-name' }, name(s)), h('span', { class: 'row-value' }, t('mme.topic.story.row', { n: fmt.int(s.n), reach: s.reach, total: S.active.length })))))
        : emptyText(t('mme.topic.empty')))
    const st = [0, 1, 2].map((j) => sum(S.outlets.map((o) => sumRows(S.set.os[o.k][i], 4, S.i0, S.i1)[j])))
    const voices = S.set.people.map((p, k) => ({ p, n: S.quotesByIssue[i][k] })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n)
    const voiceMax = Math.max(...voices.map((r) => r.n), 1)
    const sidePanel = h('div', { class: 'mme-panel' },
      h('h3', { class: 'rows-caption' }, t('mme.topic.stance', { n: fmt.int(sum(st)) })),
      sum(st) ? UI.StackedBar(stanceSegments(st)) : emptyText(t('media2.empty.list')),
      h('h3', { class: 'rows-caption mme-gap' }, t('mme.topic.voices')),
      voices.length
        ? UI.BarList(voices.map((r) => ({ label: r.p.name, value: r.n })), { max: voiceMax })
        : emptyText(t('mme.topic.voices.empty')))
    // #60: the title names the outlet that gives the topic the largest share, against the average of the outlets.
    // An outlet with fewer than 100 news articles in the period does not lead the title: its share is too noisy.
    const lead = shares.find((r) => r.o.news >= 100) || shares[0]
    const title = lead ? t('mme.topic.finding', { outlet: lead.o.name, v: pct(lead.v), avg: pct(S.avgShare[i]) }) : t('mme.topic.title')
    return card('c-12', cardHead(title, pick, `${t('mme.topic.title')}. ${t('mme.topic.info')}`),
      h('p', { class: 'dcard-sub' }, h('strong', {}, name(x)), ' · ', t('mme.topic.lead', { n: fmt.int(S.issueN[i]), share: pct(S.newsN ? S.issueN[i] / S.newsN : 0) })),
      h('div', { class: 'mme-topic-grid' }, sharePanel, storyPanel, sidePanel))
  }

  // The people who have a page of their own (the key of the entity /person/<slug>).
  const PERSON_KEYS = { 'Άδωνις Γεωργιάδης': 'adonis' }

  // ———— Πρόσωπα › Επισκόπηση: all the people in a column on the left, and one chart of all of them on the right. ————

  // The people of the set with statements, the most quoted first.
  // Βενιαμίν Νετανιάχου, Μαρία Καρυστιανού and Ζωή Κωνσταντοπούλου are not on the page (decision of 2026-11-09).
  const HIDDEN_PEOPLE = ['Βενιαμίν Νετανιάχου', 'Μαρία Καρυστιανού', 'Ζωή Κωνσταντοπούλου']
  const peopleOf = (S) => S.set.people.map((p, k) => ({ p, k, n: S.personQuotes[k] })).filter((r) => r.n > 0 && !HIDDEN_PEOPLE.includes(r.p.name)).sort((a, b) => b.n - a.n)
  // A person over all the outlets: the articles by tone, the net balance, and the statements per 1,000 articles of all the outlets.
  const overallOf = (S, k) => {
    const tone = [0, 1, 2].map((j) => sum(S.active.map((o) => o.tone[k][j])))
    return { tone, n: sum(tone), net: netOf(tone), quotes: S.personQuotes[k], rate: S.total ? (S.personQuotes[k] / S.total) * 1000 : 0 }
  }
  const dotStyle = 'stroke: var(--text-secondary); stroke-opacity: 0.55; stroke-width: 1'
  const tipOn = (el, text) => {
    el.addEventListener('pointerenter', (e) => UI.showTooltip(text, e.clientX, e.clientY))
    el.addEventListener('pointermove', (e) => UI.showTooltip(text, e.clientX, e.clientY))
    el.addEventListener('pointerleave', () => UI.hideTooltip())
    return el
  }

  // The list of the people: one compact row for each person, with the tone over all the outlets, the role and the statements.
  function PeopleListCard (S) {
    const people = peopleOf(S)
    return card('c-3 fp-list-card', cardHead(t('mme.who.title'), null, t('mme.who.info')),
      people.length
        ? h('ul', { class: 'fp-list' }, people.map((r) => {
          const o = overallOf(S, r.k)
          const net = signed(o.net)
          return h('li', { class: 'fp-person' },
            h('span', { class: 'fp-person-head' },
              h('strong', {}, PERSON_KEYS[r.p.name] ? UI.EntityLink({ type: 'person', key: PERSON_KEYS[r.p.name], label: r.p.name }) : r.p.name),
              o.n >= 5 ? h('span', { class: 'fp-net', style: netColor(o.net), title: t('mme.people.cell.tone', { outlet: t('mme.people.total'), person: r.p.name, n: fmt.int(o.n), net }) }, t('mme.who.net', { net })) : null),
            h('span', { class: 'muted-text' }, [[r.p.role, r.p.party].filter(Boolean).join(' · '), t('mme.persons.quotes', { n: fmt.int(r.n) })].filter(Boolean).join(' · ')))
        }))
        : emptyText(t('media2.empty.list')))
  }

  // One dot for each person: the tone across, the statements up, the size is the articles about the person. Every dot has its name.
  function PeopleScatter (S) {
    const pts = peopleOf(S).map((r) => ({ r, o: overallOf(S, r.k) })).filter((x) => x.o.n >= 5)
    const xmax = Math.max(25, Math.ceil(Math.max(...pts.map((x) => Math.abs(x.o.net * 100)), 0) / 25) * 25)
    const ymax = Math.max(10, Math.ceil((Math.max(...pts.map((x) => x.o.rate), 0) * 1.2) / 10) * 10)
    const nmax = Math.max(...pts.map((x) => x.o.n), 1)
    return Dash.fit((holder, width) => {
      const pad = { l: 40, r: 14, t: 30, b: 40 }
      const height = 392
      const sx = (v) => pad.l + ((v + xmax) / (2 * xmax)) * (width - pad.l - pad.r)
      const sy = (v) => height - pad.b - (v / ymax) * (height - pad.t - pad.b)
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' })
      ;[-xmax, -xmax / 2, 0, xmax / 2, xmax].forEach((v) => svg.append(h('line', { class: v === 0 ? 'zero-line' : 'grid-line', x1: sx(v), x2: sx(v), y1: pad.t, y2: height - pad.b }), h('text', { x: sx(v), y: height - pad.b + 16, 'text-anchor': 'middle' }, v === 0 ? '0' : signed(v / 100))))
      ;[0, ymax / 2, ymax].forEach((v) => svg.append(h('line', { class: 'grid-line', x1: pad.l, x2: width - pad.r, y1: sy(v), y2: sy(v) }), h('text', { x: pad.l - 6, y: sy(v) + 4, 'text-anchor': 'end' }, fmt.dec(v))))
      svg.append(h('text', { class: 'pt-label', x: (pad.l + width - pad.r) / 2, y: height - 6, 'text-anchor': 'middle' }, t('mme.panel.axis.tone')))
      svg.append(h('text', { class: 'q-label', x: pad.l, y: 14, 'text-anchor': 'start' }, t('mme.panel.axis.voice')))
      const corner = (text, x, y, anchor) => svg.append(h('text', { class: 'q-label', x, y, 'text-anchor': anchor }, text))
      corner(t('mme.panel.q.ll'), pad.l + 6, height - pad.b - 8, 'start')
      corner(t('mme.panel.q.lr'), width - pad.r - 6, height - pad.b - 8, 'end')
      const placed = [{ x0: pad.l, x1: pad.l + 240, y0: height - pad.b - 24, y1: height - pad.b }, { x0: width - pad.r - 240, x1: width - pad.r, y0: height - pad.b - 24, y1: height - pad.b }]
      const free = (b) => b.x0 >= 0 && b.x1 <= width && !placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)
      const radOf = (o) => 5 + 11 * Math.sqrt(o.n / nmax)
      pts.forEach(({ o }) => placed.push({ x0: sx(o.net * 100) - radOf(o), x1: sx(o.net * 100) + radOf(o), y0: sy(o.rate) - radOf(o), y1: sy(o.rate) + radOf(o) }))
      pts.slice().sort((a, b) => b.o.n - a.o.n).forEach(({ r, o }) => {
        const rad = radOf(o)
        const cx = sx(o.net * 100)
        const cy = sy(o.rate)
        svg.append(tipOn(h('circle', { class: 'pt', cx, cy, r: rad, fill: netColor(o.net).background, 'fill-opacity': 0.92, style: dotStyle }), t('mme.panel.both.row', { outlet: r.p.name, net: signed(o.net), rate: fmt.dec(o.rate), n: fmt.int(o.n) })))
        const w = r.p.name.length * 6.4
        const spots = [
          { x: cx + rad + 6, y: cy + 4, anchor: 'start', b: { x0: cx + rad + 4, x1: cx + rad + 8 + w, y0: cy - 8, y1: cy + 8 } },
          { x: cx - rad - 6, y: cy + 4, anchor: 'end', b: { x0: cx - rad - 8 - w, x1: cx - rad - 4, y0: cy - 8, y1: cy + 8 } },
          { x: cx, y: cy - rad - 6, anchor: 'middle', b: { x0: cx - w / 2, x1: cx + w / 2, y0: cy - rad - 18, y1: cy - rad - 4 } },
          { x: cx, y: cy + rad + 14, anchor: 'middle', b: { x0: cx - w / 2, x1: cx + w / 2, y0: cy + rad + 2, y1: cy + rad + 16 } }
        ]
        const spot = spots.find((q) => free(q.b)) || spots[0]
        placed.push(spot.b)
        svg.append(h('text', { class: 'pt-label', x: spot.x, y: spot.y, 'text-anchor': spot.anchor }, r.p.name))
      })
      holder.replaceChildren(svg)
    })
  }

  // The articles about each person for each day, from the tone rows of all the outlets, as the 7-day average of the day (as the lines of Θέματα).
  function PeopleTimeCard (S) {
    const dates = S.set.dates
    const ROLL = 7
    const people = peopleOf(S).map((r) => {
      const daily = new Array(dates.length).fill(0)
      S.set.mt.forEach((perPerson) => { const rows = perPerson[r.k]; for (let j = 0; j < rows.length; j += 4) daily[rows[j]] += rows[j + 1] + rows[j + 2] + rows[j + 3] })
      return { r, daily, total: sum(daily) }
    }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total).slice(0, Dash.SLOTS.length)
    const series = people.map(({ r, daily }, i) => ({
      key: PERSON_KEYS[r.p.name] || String(r.k), name: r.p.name, color: Dash.SLOTS[i],
      values: daily.map((_, j) => { const from = Math.max(0, j - ROLL + 1); return sum(daily.slice(from, j + 1)) / (j - from + 1) })
    }))
    return card('c-9', cardHead(t('mme.time.title'), null, `${t('mme.time.title')}. ${t('mme.time.info')}`),
      series.length ? Dash.LinesChart({ dates, series, caption: t('mme.time.title'), href: (s) => UI.EntityLink({ type: 'person', key: s.key, label: '' }).getAttribute('href') }) : emptyText(t('media2.empty.list')))
  }

  // Tone and voice of all the people in one chart, the full width of the second row.
  function ToneVoiceCard (S) {
    const withTone = peopleOf(S).filter((r) => overallOf(S, r.k).n >= 5)
    return card('c-12', cardHead(t('mme.both.title')),
      h('p', { class: 'dcard-sub fp-what' }, t('mme.panel.both.what')),
      withTone.length ? PeopleScatter(S) : emptyText(t('mme.panel.none')))
  }

  function MethodNote (S) {
    return h('p', { class: 'proto-note' }, t('mme.method', { from: fmt.date(S.set.dates[S.i0]), to: fmt.date(S.set.dates[S.i1]), n: fmt.int(S.total), date: fmt.date(window.FIXTURES.mme.updatedAt) }))
  }

  // ———— The page of one outlet. The cards use the whole window of the Greek set. ————

  // The rank of a value among the outlets with at least 100 articles in the measure: 1 is the largest.
  function rankOf (S, k, value, base) {
    const list = S.active.filter((o) => base(o) >= 100)
    if (!list.some((o) => o.k === k)) return null
    const mine = value(S.outlets[k])
    return { rank: 1 + list.filter((o) => value(o) > mine).length, n: list.length }
  }

  // The numbers of an outlet with its ranks: { label, value, sub }. The outlet page shows them in its title card.
  function outletFacts (S, k) {
    const o = S.outlets[k]
    const st = sum(o.stance)
    const news = rankOf(S, k, (x) => x.news / x.n, (x) => x.n)
    const crit = rankOf(S, k, (x) => critShare(x.stance), (x) => sum(x.stance))
    const cb = rankOf(S, k, (x) => x.cbYes / x.cbKnown, (x) => x.cbKnown)
    return {
      posts: { label: t('mme.o.posts'), value: fmt.int(o.n), sub: t('mme.o.posts.sub') },
      news: { label: t('mme.o.news'), value: pctRound(o.news / (o.n || 1)), sub: news ? t('mme.o.rank', { rank: news.rank, n: news.n }) : '' },
      critical: { label: t('mme.o.critical'), value: st ? pctRound(o.stance[0] / st) : '—', sub: crit ? t('mme.o.rank.critical', { rank: crit.rank, n: fmt.int(st) }) : t('mme.n', { n: fmt.int(st) }) },
      supportive: { label: t('mme.o.supportive'), value: st ? pctRound(o.stance[2] / st) : '—', sub: t('mme.o.supportive.sub') },
      clickbait: { label: t('mme.o.clickbait'), value: o.cbKnown ? pctRound(o.cbYes / o.cbKnown) : '—', sub: o.cbKnown ? (cb ? t('mme.o.rank', { rank: cb.rank, n: cb.n }) : t('mme.n', { n: fmt.int(o.cbKnown) })) : t('mme.o.none') }
    }
  }

  // The weeks of a set, Monday to Sunday. The first and the last week can be short.
  function weeksOf (dates) {
    const weeks = []
    dates.forEach((d, i) => {
      const monday = new Date(d + 'T00:00:00Z').getUTCDay() === 1
      if (!weeks.length || monday) weeks.push({ i0: i, i1: i })
      else weeks[weeks.length - 1].i1 = i
    })
    return weeks
  }
  const TOPIC_SLOTS = [1, 2, 3, 4, 5, 7, 6].map((i) => `var(--cat-${i})`)

  // The share of each topic in the news of the outlet, week by week: one line for each of the 7 largest topics of the outlet. A week with no news is a gap in the line.
  function WeeklyAgenda (set, k) {
    const weeks = weeksOf(set.dates).map((w) => ({ ...w, issues: set.oi[k].map((p, i) => (set.issues[i].soft ? 0 : sumPairs(p, w.i0, w.i1))) })).map((w) => ({ ...w, n: sum(w.issues) }))
    const totals = set.issues.map((_, i) => sum(weeks.map((w) => w.issues[i])))
    const top = totals.map((n, i) => ({ n, i })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, TOPIC_SLOTS.length).map((r) => r.i)
    const day = (i) => fmt.date(set.dates[i], { day: 'numeric', month: 'short' })
    const series = top.map((i, j) => ({ label: name(set.issues[i]), color: TOPIC_SLOTS[j], values: weeks.map((w) => (w.n ? w.issues[i] / w.n : null)) }))
    const chart = Politics.LineChart({
      labels: weeks.map((w) => day(w.i0)), tips: weeks.map((w) => `${day(w.i0)} – ${day(w.i1)} (n=${fmt.int(w.n)})`),
      series, height: 260, zero: true, yFormat: pctRound, endLabels: false, aria: t('mme.o.weekly.title')
    })
    const legend = UI.Legend(series.map((s) => ({ label: s.label, color: s.color })))
    return card('c-12', cardHead(t('mme.o.weekly.title'), null, t('mme.o.weekly.info')), legend, chart)
  }

  // The stories the outlet pushes (twice the average share of the others) and the big stories it did not run, in one card: two lists of 5, the first over-covered, the second missing.
  const COVERAGE = 5
  function CoverageCard (S, k) {
    const o = S.outlets[k]
    const others = S.active.filter((x) => x.k !== k)
    const news = (s) => !s.generic && s.issue >= 0 && S.hard[s.issue]
    const push = S.stories.filter((s) => news(s) && s.per[k] >= 5).map((s) => {
      const avg = sum(others.map((x) => s.per[x.k] / x.n)) / (others.length || 1)
      return { s, ratio: avg ? s.per[k] / o.n / avg : Infinity }
    }).filter((r) => r.ratio >= 2).sort((a, b) => b.ratio - a.ratio).slice(0, COVERAGE)
    const skip = S.stories.filter((s) => news(s) && !s.per[k] && s.reach >= S.active.length / 2).map((s) => {
      const covering = S.active.filter((x) => s.per[x.k])
      const expected = (sum(covering.map((x) => s.per[x.k] / x.n)) / covering.length) * o.n
      return { s, expected }
    }).sort((a, b) => b.expected - a.expected).slice(0, COVERAGE)
    const list = (rows, line) => h('ul', { class: 'rows-related mme-related' }, rows.map((r) => h('li', {}, h('span', { class: 'related-main' }, h('span', {}, name(r.s)), h('span', { class: 'muted-text' }, line(r))))))
    return card('c-12', cardHead(t('mme.o.cover.title'), null, t('mme.o.cover.info')),
      h('h3', { class: 'rows-caption' }, t('mme.o.push.title')),
      push.length ? list(push, (r) => t('mme.o.push.row', { n: fmt.int(r.s.per[k]), ratio: fmt.dec(r.ratio) })) : emptyText(t('mme.o.push.empty')),
      h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.skip.title')),
      skip.length ? list(skip, (r) => t('mme.o.skip.row', { reach: r.s.reach, n: fmt.int(r.s.n), expected: fmt.dec(r.expected) })) : emptyText(t('mme.o.skip.empty')))
  }

  // Critical articles to the left and supportive to the right, for each topic. The tick is the critical share of all outlets in the topic.
  // Two bars, one under the other, on one center line: the outlet (red to the left, violet to the right) and, thin and gray, all the other articles to compare with.
  const ALL_GRAY = 'var(--cat-0)'
  function PairBars (here, others, scale, label) {
    return h('div', { class: 'pair-dbar' },
      UI.DivergingBar({ left: here.left, right: here.right, scale, colors: [STANCE_COLORS[0], null, STANCE_COLORS[2]], label }),
      UI.DivergingBar({ left: others.left, right: others.right, scale, colors: [ALL_GRAY, null, ALL_GRAY] }))
  }

  function StanceByTopic (S, k, limit) {
    const set = S.set
    const rows = set.issues.map((x, i) => {
      const mine = sumRows(set.os[k][i], 4, S.i0, S.i1)
      const all = [0, 1, 2].map((j) => sum(S.outlets.map((o) => sumRows(set.os[o.k][i], 4, S.i0, S.i1)[j])))
      return { x, mine, n: sum(mine), allCrit: critShare(all), allSup: sum(all) ? all[2] / sum(all) : 0 }
    }).filter((r) => !r.x.soft && r.n >= 5).sort((a, b) => (limit ? b.n - a.n : 0)).slice(0, limit || Infinity).sort((a, b) => critShare(b.mine) - critShare(a.mine))
    return card('c-12', cardHead(t('mme.o.stance.title'), UI.Legend([{ label: t('stance.critical'), color: STANCE_COLORS[0] }, { label: t('stance.supportive'), color: STANCE_COLORS[2] }, { label: t('mme.o.stance.all'), color: ALL_GRAY }]), limit ? `${t('mme.o.stance.info')} ${t('mme.o.stance.limit', { n: limit })}` : t('mme.o.stance.info')),
      rows.length
        ? UI.BarList(rows.map((r) => {
          const c = r.mine[0] / r.n
          const s = r.mine[2] / r.n
          return { label: name(r.x), text: fmt.int(r.n), bar: PairBars({ left: c, right: s }, { left: r.allCrit, right: r.allSup }, 1, t('mme.o.stance.row', { topic: name(r.x), crit: pct(c), sup: pct(s), n: r.n, all: pct(r.allCrit) })) }
        }), { columns: limit ? 1 : 2 })
        : emptyText(t('media2.empty.list')))
  }

  // What the outlet stresses more or less than all outlets: topics, frames and sections in one list, by how many times its share is the share of all outlets (x1,3 is 30% more often).
  // topics: [{ label, value, usual }] are the shares of the topics in its stories, from the page. S is null for an outlet that is not in ΜΜΕ & πρόσωπα: it has no frames and no sections.
  const EMPHASIS = 5
  function EmphasisCard (S, k, topics, topicN) {
    const rows = topics.map((r) => ({ kind: 'topic', ...r }))
    if (S) {
      const set = S.set
      const frames = set.frames.map((_, f) => sumPairs(set.of[k][f], S.i0, S.i1))
      const framesAll = set.frames.map((_, f) => sum(S.outlets.map((o) => sumPairs(set.of[o.k][f], S.i0, S.i1))))
      set.frames.forEach((code, f) => rows.push({ kind: 'frame', label: t(`frame.${code}`), value: frames[f] / (sum(frames) || 1), usual: framesAll[f] / (sum(framesAll) || 1) }))
      const sections = set.osec[k]
      const sectionsAll = set.sections.map((_, j) => sum(S.outlets.map((o) => set.osec[o.k][j])))
      set.sections.forEach((code, j) => rows.push({ kind: 'section', label: t(`section.${code}`), value: sections[j] / (sum(sections) || 1), usual: sectionsAll[j] / (sum(sectionsAll) || 1) }))
    }
    const rated = rows.filter((r) => r.usual >= 0.02).map((r) => ({ ...r, ratio: r.value / r.usual }))
    const more = rated.filter((r) => r.ratio > 1).sort((a, b) => b.ratio - a.ratio).slice(0, EMPHASIS)
    const less = rated.filter((r) => r.ratio < 1).sort((a, b) => a.ratio - b.ratio).slice(0, EMPHASIS)
    const top = Math.max(...[...more, ...less].map((r) => Math.abs(r.ratio - 1)), 0.01)
    const panel = (list, key, color) => h('div', { class: 'how-panel' }, h('h3', { class: 'rows-caption' }, t(`mme.o.emph.${key}`)),
      list.length
        ? UI.BarList(list.map((r) => ({ label: r.label, sub: t('mme.o.emph.row', { kind: t(`mme.o.kind.${r.kind}`), value: pct(r.value), usual: pct(r.usual) }), value: Math.abs(r.ratio - 1), text: `×${fmt.dec(r.ratio)}`, color })), { max: top })
        : emptyText(t('media2.empty.list')))
    return card('c-12', cardHead(t('mme.o.emph.title'), null, t('mme.o.emph.info')),
      topics.length || S ? [h('div', { class: 'how-grid how-grid-2' }, panel(more, 'more', 'var(--emph-more)'), panel(less, 'less', 'var(--emph-less)')),
        h('p', { class: 'dcard-sub' }, t('mme.o.emph.sub', { n: fmt.int(topicN) }))] : emptyText(t('outlet2.topics.empty')))
  }

  // Whom the outlet quotes, its parties against all outlets, and who attacks whom (the 6 pairs with the most statements).
  const ATTACKS = 6
  function VoicesCard (S, k) {
    const set = S.set
    const o = S.outlets[k]
    const people = set.people.map((p, j) => ({ p, n: o.quotes[j] })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n)
    const max = Math.max(...people.map((r) => r.n), 1)
    const partyOf = (quotes) => { const m = new Map(); set.people.forEach((p, j) => { if (p.party) m.set(p.party, (m.get(p.party) || 0) + quotes[j]) }); return m }
    const mine = partyOf(o.quotes)
    const all = partyOf(set.people.map((_, j) => S.personQuotes[j]))
    const nm = sum([...mine.values()]) || 1
    const na = sum([...all.values()]) || 1
    const parties = [...all.keys()].map((p) => ({ p, v: (mine.get(p) || 0) / nm, usual: all.get(p) / na })).sort((a, b) => b.v - a.v)
    const attacks = set.attacks[k] || []
    return card('c-12', cardHead(t('mme.o.voices.title'), null, t('mme.o.voices.info')),
      people.length ? UI.BarList(people.map((r) => ({ label: r.p.name, value: r.n })), { max }) : emptyText(t('media2.empty.list')),
      parties.length ? [h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.parties')), h('p', { class: 'dcard-sub' }, t('mme.o.parties.n', { n: fmt.int(sum([...mine.values()])) })),
        UI.BarList(parties.map((r) => ({ label: r.p, text: `${pctRound(r.v)} / ${pctRound(r.usual)}`, value: r.v, marker: r.usual })), { max: 1, cls: 'mme-share' })] : null,
      attacks.length ? [h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.attacks')),
        UI.BarList(attacks.slice(0, ATTACKS).map(([a, b, n]) => ({ label: h('span', { title: `${a} → ${b}` }, `${a.split(' ').pop()} → ${b.split(' ').pop()}`), value: n })), { max: Math.max(...attacks.slice(0, ATTACKS).map((r) => r[2]), 1), cls: 'mme-attacks' })] : null)
  }

  // The tone of the outlet about each person: the bar goes left (critical, red) or right (supportive, blue) from the center line, and the thin gray bar under it is the tone in the other outlets.
  function PortrayalCard (S, k) {
    const set = S.set
    const o = S.outlets[k]
    const rows = set.people.map((p, j) => {
      const here = o.tone[j]
      const other = [0, 1, 2].map((x) => sum(S.outlets.filter((y) => y.k !== k).map((y) => y.tone[j][x])))
      return { p, n: sum(here), here: netOf(here), else: netOf(other) }
    }).filter((r) => r.n >= 5).sort((a, b) => b.n - a.n)
    const scale = Math.max(0.3, ...rows.map((r) => Math.max(Math.abs(r.here), Math.abs(r.else))))
    const key = UI.Legend([{ label: t('stance.critical'), color: STANCE_COLORS[0] }, { label: t('stance.supportive'), color: STANCE_COLORS[2] }, { label: t('mme.o.portray.else'), color: ALL_GRAY }])
    return card('c-12', cardHead(t('mme.o.portray.title'), null, t('mme.o.portray.info')),
      rows.length
        ? [h('div', { class: 'mme-key-row' }, key),
          UI.BarList(rows.map((r) => ({
            label: [r.p.name, ' ', h('span', { class: 'muted-text' }, fmt.int(r.n))], text: signed(r.here),
            bar: PairBars({ left: Math.max(0, -r.here), right: Math.max(0, r.here) }, { left: Math.max(0, -r.else), right: Math.max(0, r.else) }, scale, `${r.p.name}: ${t('mme.o.portray.row', { here: signed(r.here), else: signed(r.else) })}`)
          })))]
        : emptyText(t('media2.empty.list')))
  }

  // The newest headlines of the outlet: the title as a link, the day, the frame and the angle.
  function Headlines (set, k) {
    return (set.headlines[k] || []).slice().sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([date, title, url, angle, frame, story]) => h('li', { class: 'mme-headline' },
      App.safeUrl(url) ? h('a', { href: App.safeUrl(url), rel: 'noopener', target: '_blank' }, title) : h('span', {}, title),
      h('span', { class: 'muted-text' }, [fmt.date(date, { day: 'numeric', month: 'short' }), frame >= 0 ? t(`frame.${set.frames[frame]}`) : null, story || null].filter(Boolean).join(' · ')),
      angle ? h('span', { class: 'mme-angle' }, angle) : null))
  }

  window.Mme = { presets, summary, ChipsCard, StoriesCard, AgendaCard, GovCard, TopicCard, PeopleListCard, ToneVoiceCard, PeopleTimeCard, MethodNote, outletFacts, WeeklyAgenda, CoverageCard, StanceByTopic, EmphasisCard, VoicesCard, PortrayalCard, Headlines, outletLink }
})()
