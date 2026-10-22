// The cards from the live page ΜΜΕ & πρόσωπα (apotypos.org/media), on the data of data/mme.js. Load after dash.js.
// Μέσα › Επισκόπηση (media-v2) and the page of one outlet (outlet-v2) use them. Each sum is for a period of days i0..i1.
(function () {
  const { t, fmt, h } = window.App
  const { card, cardHead, emptyText, fit, tint, textOn } = Dash

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

  // The presets of a set: its whole window, each month in it, the last 2 weeks and the last week.
  function presets (set) {
    const d = set.dates
    const last = d.length - 1
    const months = [...new Set(d.map((x) => x.slice(0, 7)))]
    const monthKeys = { '2026-08': 'range.aug', '2026-09': 'range.sep' }
    return [
      { key: 'all', label: t('range.all'), from: d[0], to: d[last] },
      ...months.filter((m) => monthKeys[m]).map((m) => ({ key: m, label: t(monthKeys[m]), from: d.find((x) => x.startsWith(m)), to: [...d].reverse().find((x) => x.startsWith(m)) })),
      { key: 'last14', label: t('range.last14'), from: d[Math.max(0, last - 13)], to: d[last] },
      { key: 'last7', label: t('mme.range.last7'), from: d[Math.max(0, last - 6)], to: d[last] }
    ]
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
  const topIssues = (S, o, n) => S.set.issues.map((x, i) => ({ x, i, v: shareOf(o, i) })).filter((r) => S.hard[r.i] && r.v > 0).sort((a, b) => b.v - a.v).slice(0, n)
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

  // Three observations of the period.
  function HighlightsCard (S) {
    const lines = []
    // 1. The largest ratio of the share of a topic in an outlet to the average of the outlets. The topic needs 20 articles in the outlet.
    let best = null
    S.active.forEach((o) => S.set.issues.forEach((x, i) => {
      if (!S.hard[i] || x.catchAll || o.issues[i] < 20 || !S.avgShare[i]) return
      const ratio = shareOf(o, i) / S.avgShare[i]
      if (!best || ratio > best.ratio) best = { o, x, i, ratio }
    }))
    if (best && best.ratio >= 2) {
      lines.push(h('li', {}, t('mme.hl.topic', { outlet: best.o.name, topic: name(best.x), share: pctRound(shareOf(best.o, best.i)), ratio: fmt.dec(best.ratio), avg: pctRound(S.avgShare[best.i]) }), ' ', outletLink(S, best.o)))
    }
    // 2. The largest story that reached nearly every outlet but not all of them.
    const big = S.active.filter((o) => o.n >= 300)
    const missed = S.stories.filter((s) => !s.generic).map((s) => ({ s, missing: big.filter((o) => !s.per[o.k]) })).find((r) => r.missing.length > 0 && r.missing.length <= 3)
    if (missed) {
      lines.push(h('li', {}, t('mme.hl.story', { story: name(missed.s), reach: missed.s.reach, total: S.active.length, n: fmt.int(missed.s.n), missing: missed.missing.map((o) => o.name).join(', ') })))
    }
    // 3. The most critical and the least critical outlet, from 100 articles about the government.
    const ranked = S.active.filter((o) => sum(o.stance) >= 100).sort((a, b) => critShare(b.stance) - critShare(a.stance))
    if (ranked.length >= 2) {
      const a = ranked[0]
      const b = ranked[ranked.length - 1]
      lines.push(h('li', {}, t('mme.hl.stance', { a: a.name, pa: pctRound(critShare(a.stance)), b: b.name, pb: pctRound(critShare(b.stance)), sb: pctRound(b.stance[2] / sum(b.stance)) })))
    }
    return card('c-12 mme-hl', cardHead(t('mme.hl.title'), null, t('mme.hl.info')), lines.length ? h('ul', { class: 'mme-hl-list' }, lines) : emptyText(t('media2.empty.list')))
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
    const toggle = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: generic, onChange: (e) => onGeneric(e.target.checked) }), t('mme.stories.generic'))
    const table = h('table', { class: 'matrix matrix-turned mme-dots' },
      h('caption', { class: 'visually-hidden' }, t('mme.stories.title')),
      turnedHead(t('mme.stories.col'), ['n'], cols),
      h('tbody', {}, rows.map((s) => h('tr', {},
        h('th', { scope: 'row' }, h('span', { class: 'mme-story-name' }, name(s)), h('span', { class: 'muted-text mme-story-sub' }, t('mme.stories.reach', { issue: s.issue >= 0 ? name(S.set.issues[s.issue]) : '', reach: s.reach, total: S.active.length }))),
        h('td', { class: 'mme-num-col' }, fmt.int(s.n)),
        cols.map((o) => {
          const n = s.per[o.k]
          const title = n ? t('mme.stories.cell', { outlet: o.name, story: name(s), n: fmt.int(n), share: fmt.pct(n / o.n) }) : t('mme.stories.cell.none', { outlet: o.name, story: name(s) })
          const size = n ? 4 + 14 * Math.sqrt(n / o.n / maxShare) : 0
          return h('td', { title, 'aria-label': title }, n ? h('span', { class: 'mme-dot', style: { width: `${size}px`, height: `${size}px` } }) : h('span', { class: 'mme-dot-none' }))
        })))))
    return card('c-12', cardHead(t('mme.stories.title'), toggle, t('mme.stories.info')), rows.length ? matrixWrap(t('mme.stories.title'), table) : emptyText(t('media2.empty.list')))
  }

  // The color of a share in the agenda: a tint of the news blue, darker for a larger share. 20% or more is the full color.
  const shareColor = (v) => { const bg = tint('#2a78d6', 1 - Math.min(1, v / 0.2) * 0.9); return { background: bg, color: textOn(bg) } }

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

  // A diverging color for a net balance from −1 to +1: red for critical, blue for sympathetic, a warm gray in the middle.
  function netColor (net) {
    const k = Math.min(1, Math.abs(net) / 0.5)
    const end = net < 0 ? [0xc2, 0x3b, 0x3b] : [0x2a, 0x62, 0xc4]
    const mid = [0xe4, 0xe1, 0xda]
    const rgb = mid.map((v, i) => Math.round(v + (end[i] - v) * k))
    const hex = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
    return { background: hex, color: textOn(hex) }
  }
  const netOf = (tone) => { const n = sum(tone); return n ? (tone[2] - tone[0]) / n : 0 }

  // People × outlets: the tone of the articles about each person, or the statements of the person per 1,000 articles.
  function PeopleCard (S, { mode, onMode }) {
    const cols = columnsOf(S)
    const people = S.set.people.map((p, k) => ({ ...p, k, tone: [0, 1, 2].map((j) => sum(cols.map((o) => o.tone[k][j]))) }))
      .sort((a, b) => sum(b.tone) - sum(a.tone))
    const maxRate = Math.max(...people.flatMap((p) => cols.map((o) => (o.n ? (o.quotes[p.k] / o.n) * 1000 : 0))), 0.0001)
    const tools = UI.SegmentedControl({ label: t('mme.people.mode'), value: mode, onChange: onMode, options: ['tone', 'voice'].map((m) => ({ value: m, label: t(`mme.people.mode.${m}`) })) })
    const cell = (p, o) => {
      if (mode === 'voice') {
        const n = o.quotes[p.k]
        const rate = o.n ? (n / o.n) * 1000 : 0
        const title = t('mme.people.cell.voice', { outlet: o.name, person: p.name, n: fmt.int(n), rate: fmt.dec(rate) })
        const bg = n ? tint('#2a78d6', 1 - Math.min(1, rate / maxRate) * 0.9) : 'transparent'
        return h('td', { style: { background: bg, color: n ? textOn(bg) : 'var(--text-secondary)' }, title, 'aria-label': title }, n ? (rate < 10 ? fmt.dec(rate) : fmt.int(Math.round(rate))) : '')
      }
      const tone = o.tone[p.k]
      const n = sum(tone)
      if (n < 5) {
        const title = t('mme.people.cell.few', { outlet: o.name, person: p.name, n: fmt.int(n) })
        return h('td', { class: 'mme-few', title, 'aria-label': title }, n ? String(n) : '')
      }
      const net = netOf(tone)
      const title = t('mme.people.cell.tone', { outlet: o.name, person: p.name, n: fmt.int(n), net: signed(net) })
      return h('td', { style: netColor(net), title, 'aria-label': title }, fmt.int(n))
    }
    const totalCell = (p) => (mode === 'voice'
      ? h('td', { class: 'mme-num-col' }, fmt.int(S.personQuotes[p.k]))
      : h('td', { class: 'mme-num-col' }, h('span', { class: 'mme-total' }, fmt.int(sum(p.tone))), h('span', { class: 'mme-net', style: netColor(netOf(p.tone)) }, signed(netOf(p.tone)))))
    const table = h('table', { class: 'matrix matrix-turned mme-people' },
      h('caption', { class: 'visually-hidden' }, t('mme.people.title')),
      turnedHead(t('media.col.person'), [t('mme.people.total')], cols),
      h('tbody', {}, people.map((p) => h('tr', {}, h('th', { scope: 'row' }, p.name), totalCell(p), cols.map((o) => cell(p, o))))))
    const legend = mode === 'voice'
      ? h('p', { class: 'dcard-sub' }, t('mme.people.key.voice'))
      : h('div', { class: 'scale-legend' }, h('span', {}, t('mme.people.key.neg')),
        h('ol', { class: 'scale-steps' }, [-0.5, -0.3, -0.1, 0, 0.1, 0.3, 0.5].map((v) => { const c = netColor(v); return h('li', { style: c }, signed(v)) })),
        h('span', {}, t('mme.people.key.pos')))
    return card('c-12', cardHead(t('mme.people.title'), tools, t('mme.people.info')), people.length ? [matrixWrap(t('mme.people.title'), table), legend] : emptyText(t('media2.empty.list')))
  }

  const STANCE_COLORS = ['var(--stance-critical)', 'var(--stance-neutral)', 'var(--stance-supportive)']
  const STANCE_CODES = ['critical', 'neutral', 'supportive']
  function StanceBar (st, label) {
    const n = sum(st) || 1
    return h('div', { class: 'stack mme-stack', role: 'img', 'aria-label': `${label ? label + ': ' : ''}${STANCE_CODES.map((c, i) => `${t(`stance.${c}`)} ${pct(st[i] / n)}`).join(', ')}` },
      st.map((v, i) => (v ? h('span', { style: `width:${(v / n) * 100}%;--seg:${STANCE_COLORS[i]}`, title: `${t(`stance.${STANCE_CODES[i]}`)}: ${pct(v / n)}` }) : null)))
  }
  const stanceKey = () => h('span', { class: 'legend-inline' }, STANCE_CODES.map((c, i) => h('span', {}, h('span', { class: 'swatch', style: { background: STANCE_COLORS[i] } }), t(`stance.${c}`))))

  // The stance to the government in each outlet: critical, neutral, supportive.
  function GovCard (S) {
    const rows = S.active.filter((o) => sum(o.stance) > 0).sort((a, b) => (sum(b.stance) >= 30) - (sum(a.stance) >= 30) || critShare(b.stance) - critShare(a.stance))
    const title = S.set.country === 'GR' ? t('mme.gov.title') : t('mme.gov.title.il')
    return card('', cardHead(title, null, t('mme.gov.info')),
      h('div', { class: 'mme-key-row' }, stanceKey()),
      rows.length
        ? h('ul', { class: 'mme-gov' }, rows.map((o) => h('li', { class: sum(o.stance) < 30 ? 'is-few' : null },
          h('span', { class: 'mme-gov-name' }, outletLink(S, o)),
          h('span', { class: 'muted-text mme-gov-n' }, t('mme.n', { n: fmt.int(sum(o.stance)) })),
          StanceBar(o.stance, o.name),
          h('span', { class: 'row-value' }, pctRound(critShare(o.stance))))))
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
    const sharePanel = h('div', { class: 'mme-panel' }, h('h3', { class: 'rows-caption' }, t('mme.topic.share')),
      h('ul', { class: 'rows rows-share mme-share' }, shares.map((r) => h('li', {},
        h('span', { class: 'row-name' }, outletLink(S, r.o)), h('span', { class: 'row-value' }, pct(r.v)),
        h('span', { class: 'share', role: 'img', 'aria-label': `${r.o.name}: ${pct(r.v)}, ${t('mme.avg')} ${pct(S.avgShare[i])}` },
          h('span', { class: 'share-fill', style: { display: 'block', width: `${(r.v / max) * 100}%` } }),
          h('span', { class: 'share-tick', style: { left: `${(S.avgShare[i] / max) * 100}%` } }))))))
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
      sum(st) ? [StanceBar(st, name(x)), h('ul', { class: 'legend' }, STANCE_CODES.map((c, j) => h('li', {}, h('span', { class: 'swatch', style: { background: STANCE_COLORS[j] } }), `${t(`stance.${c}`)} ${pctRound(st[j] / sum(st))}`)))] : emptyText(t('media2.empty.list')),
      h('h3', { class: 'rows-caption mme-gap' }, t('mme.topic.voices')),
      voices.length
        ? h('ul', { class: 'rows' }, voices.map((r) => h('li', {}, h('span', { class: 'row-name' }, r.p.name), h('span', { class: 'row-value' }, fmt.int(r.n)), UI.HBar(r.n, voiceMax))))
        : emptyText(t('mme.topic.voices.empty')))
    return card('c-12', cardHead(t('mme.topic.title'), pick, t('mme.topic.info')),
      h('p', { class: 'dcard-sub' }, h('strong', {}, name(x)), ' · ', t('mme.topic.lead', { n: fmt.int(S.issueN[i]), share: pct(S.newsN ? S.issueN[i] / S.newsN : 0) })),
      h('div', { class: 'mme-topic-grid' }, sharePanel, storyPanel, sidePanel))
  }

  // The people with the most quoted statements, and their two largest topics.
  function PersonsCard (S) {
    const people = S.set.people.map((p, k) => ({ p, k, n: S.personQuotes[k] })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n)
    return card('c-12', cardHead(t('mme.persons.title'), null, t('mme.persons.info')),
      people.length
        ? h('ul', { class: 'mme-persons' }, people.map((r) => {
          const tops = S.set.issues.map((x, i) => ({ x, n: S.quotesByIssue[i][r.k] })).filter((q) => q.n > 0).sort((a, b) => b.n - a.n).slice(0, 2)
          const all = sum(S.set.issues.map((_, i) => S.quotesByIssue[i][r.k])) || 1
          return h('li', { class: 'mme-person' },
            h('p', { class: 'mme-person-name' }, r.p.name),
            h('p', { class: 'mme-person-n' }, t('mme.persons.quotes', { n: fmt.int(r.n) })),
            h('p', { class: 'muted-text' }, [r.p.role, r.p.party].filter(Boolean).join(' · ')),
            h('p', { class: 'mme-person-topics' }, tops.map((q) => `${name(q.x)} ${pctRound(q.n / all)}`).join(' · ')))
        }))
        : emptyText(t('media2.empty.list')))
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

  function OutletStats (S, k) {
    const o = S.outlets[k]
    const st = sum(o.stance)
    const news = rankOf(S, k, (x) => x.news / x.n, (x) => x.n)
    const crit = rankOf(S, k, (x) => critShare(x.stance), (x) => sum(x.stance))
    const cb = rankOf(S, k, (x) => x.cbYes / x.cbKnown, (x) => x.cbKnown)
    const item = (label, value, sub) => h('div', { class: 'mme-ostat' }, h('p', { class: 'dstat-label' }, label), h('p', { class: 'mme-ostat-value' }, value), h('p', { class: 'muted-text' }, sub))
    return card('c-12', cardHead(t('mme.o.title'), null, t('mme.o.info')),
      h('div', { class: 'mme-ostats' },
        item(t('mme.o.posts'), fmt.int(o.n), t('mme.o.posts.sub')),
        item(t('mme.o.news'), pctRound(o.news / (o.n || 1)), news ? t('mme.o.rank', { rank: news.rank, n: news.n }) : ''),
        item(t('mme.o.critical'), st ? pctRound(o.stance[0] / st) : '—', crit ? t('mme.o.rank.critical', { rank: crit.rank, n: fmt.int(st) }) : t('mme.n', { n: fmt.int(st) })),
        item(t('mme.o.supportive'), st ? pctRound(o.stance[2] / st) : '—', t('mme.o.supportive.sub')),
        item(t('mme.o.clickbait'), o.cbKnown ? pctRound(o.cbYes / o.cbKnown) : '—', o.cbKnown ? (cb ? t('mme.o.rank', { rank: cb.rank, n: cb.n }) : t('mme.n', { n: fmt.int(o.cbKnown) })) : t('mme.o.none'))))
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
  const TOPIC_SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#008300']

  // The share of each topic in the articles of the outlet, week by week: 100% columns, the 7 largest topics and the rest.
  function WeeklyAgenda (set, k) {
    const weeks = weeksOf(set.dates).map((w) => ({ ...w, issues: set.oi[k].map((p, i) => (set.issues[i].soft ? 0 : sumPairs(p, w.i0, w.i1))) })).map((w) => ({ ...w, n: sum(w.issues) }))
    const totals = set.issues.map((_, i) => sum(weeks.map((w) => w.issues[i])))
    const top = totals.map((n, i) => ({ n, i })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, TOPIC_SLOTS.length).map((r) => r.i)
    const series = [...top.map((i, j) => ({ label: name(set.issues[i]), color: TOPIC_SLOTS[j], of: (w) => w.issues[i] })),
      { label: t('mme.o.weekly.rest'), color: 'var(--bar-muted)', of: (w) => w.n - sum(top.map((i) => w.issues[i])) }]
    const label = (w) => `${fmt.date(set.dates[w.i0], { day: 'numeric', month: 'short' })} – ${fmt.date(set.dates[w.i1], { day: 'numeric', month: 'short' })}`
    const chart = fit((holder, width) => {
      const height = 230
      const pad = { top: 6, bottom: 40, left: 36, right: 4 }
      const plotH = height - pad.top - pad.bottom
      const slot = (width - pad.left - pad.right) / weeks.length
      const bw = Math.min(56, slot * 0.72)
      const svg = h('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' })
      ;[0, 0.25, 0.5, 0.75, 1].forEach((v) => {
        const y = pad.top + plotH * (1 - v)
        svg.append(h('line', { class: 'grid-line', x1: pad.left, x2: width - pad.right, y1: y, y2: y }), h('text', { x: pad.left - 6, y: y + 4, 'text-anchor': 'end' }, `${v * 100}%`))
      })
      weeks.forEach((w, j) => {
        const x = pad.left + j * slot + (slot - bw) / 2
        let y = pad.top + plotH
        series.forEach((s) => {
          const v = w.n ? s.of(w) / w.n : 0
          if (v <= 0) return
          const hgt = v * plotH
          y -= hgt
          const r = h('rect', { x, y, width: bw, height: Math.max(0, hgt - 1), fill: s.color })
          const tip = (e) => UI.showTooltip(t('mme.o.weekly.tip', { week: label(w), topic: s.label, share: pct(v), n: fmt.int(s.of(w)) }), e.clientX, e.clientY)
          r.addEventListener('pointermove', tip)
          r.addEventListener('pointerleave', () => UI.hideTooltip())
          svg.append(r)
        })
        svg.append(h('text', { x: x + bw / 2, y: height - 22, 'text-anchor': 'middle' }, fmt.date(set.dates[w.i0], { day: 'numeric', month: 'short' })),
          h('text', { x: x + bw / 2, y: height - 8, 'text-anchor': 'middle', class: 'muted-text' }, `n=${fmt.int(w.n)}`))
      })
      const table = h('div', { class: 'visually-hidden' }, h('table', {}, h('caption', {}, t('mme.o.weekly.title')),
        h('thead', {}, h('tr', {}, h('th', {}, ''), series.map((s) => h('th', { scope: 'col' }, s.label)))),
        h('tbody', {}, weeks.map((w) => h('tr', {}, h('th', { scope: 'row' }, `${label(w)} (n=${w.n})`), series.map((s) => h('td', {}, pct(w.n ? s.of(w) / w.n : 0))))))))
      holder.replaceChildren(svg, table)
    })
    const legend = h('ul', { class: 'legend legend-wrap mme-legend' }, series.map((s) => h('li', {}, h('span', { class: 'swatch', style: { background: s.color } }), s.label)))
    return card('c-12', cardHead(t('mme.o.weekly.title'), null, t('mme.o.weekly.info')), legend, chart)
  }

  // The stories the outlet pushes (twice the average share of the others) and the big stories it did not run.
  function PushSkip (S, k) {
    const o = S.outlets[k]
    const others = S.active.filter((x) => x.k !== k)
    const news = (s) => !s.generic && s.issue >= 0 && S.hard[s.issue]
    const push = S.stories.filter((s) => news(s) && s.per[k] >= 5).map((s) => {
      const avg = sum(others.map((x) => s.per[x.k] / x.n)) / (others.length || 1)
      return { s, ratio: avg ? s.per[k] / o.n / avg : Infinity }
    }).filter((r) => r.ratio >= 2).sort((a, b) => b.ratio - a.ratio).slice(0, 8)
    const skip = S.stories.filter((s) => news(s) && !s.per[k] && s.reach >= S.active.length / 2).map((s) => {
      const covering = S.active.filter((x) => s.per[x.k])
      const expected = (sum(covering.map((x) => s.per[x.k] / x.n)) / covering.length) * o.n
      return { s, expected }
    }).sort((a, b) => b.expected - a.expected).slice(0, 10)
    const pushCard = card('c-12', cardHead(t('mme.o.push.title'), null, t('mme.o.push.info')),
      push.length ? h('ul', { class: 'rows-related mme-related' }, push.map((r) => h('li', {}, h('span', { class: 'related-main' }, h('span', {}, name(r.s)),
        h('span', { class: 'muted-text' }, t('mme.o.push.row', { n: fmt.int(r.s.per[k]), ratio: fmt.dec(r.ratio) }))), h('span', {}), h('span', {})))) : emptyText(t('mme.o.push.empty')))
    const skipCard = card('c-12', cardHead(t('mme.o.skip.title'), null, t('mme.o.skip.info')),
      skip.length ? h('ul', { class: 'rows-related mme-related' }, skip.map((r) => h('li', {}, h('span', { class: 'related-main' }, h('span', {}, name(r.s)),
        h('span', { class: 'muted-text' }, t('mme.o.skip.row', { reach: r.s.reach, n: fmt.int(r.s.n), expected: fmt.dec(r.expected) }))), h('span', {}), h('span', {})))) : emptyText(t('mme.o.skip.empty')))
    return [pushCard, skipCard]
  }

  // Critical articles to the left and supportive to the right, for each topic. The tick is the critical share of all outlets in the topic.
  function StanceByTopic (S, k) {
    const set = S.set
    const rows = set.issues.map((x, i) => {
      const mine = sumRows(set.os[k][i], 4, S.i0, S.i1)
      const all = [0, 1, 2].map((j) => sum(S.outlets.map((o) => sumRows(set.os[o.k][i], 4, S.i0, S.i1)[j])))
      return { x, mine, n: sum(mine), allCrit: critShare(all) }
    }).filter((r) => !r.x.soft && r.n >= 5).sort((a, b) => critShare(b.mine) - critShare(a.mine))
    return card('c-12', cardHead(t('mme.o.stance.title'), stanceKey(), t('mme.o.stance.info')),
      rows.length
        ? h('ul', { class: 'mme-diverge' }, rows.map((r) => {
          const c = r.mine[0] / r.n
          const s = r.mine[2] / r.n
          return h('li', { 'aria-label': t('mme.o.stance.row', { topic: name(r.x), crit: pct(c), sup: pct(s), n: r.n, all: pct(r.allCrit) }) },
            h('span', { class: 'mme-dv-name' }, name(r.x)),
            h('span', { class: 'mme-dv-left', 'aria-hidden': 'true' }, h('span', { class: 'mme-dv-crit', style: { width: `${c * 100}%` } }), h('span', { class: 'mme-dv-tick', style: { right: `${r.allCrit * 100}%` } })),
            h('span', { class: 'mme-dv-right', 'aria-hidden': 'true' }, h('span', { class: 'mme-dv-sup', style: { width: `${s * 100}%` } })),
            h('span', { class: 'row-value' }, fmt.int(r.n)))
        }))
        : emptyText(t('media2.empty.list')))
  }

  // The frames of the articles of the outlet against all outlets, and the sections.
  function FramesCard (S, k) {
    const set = S.set
    const mine = set.frames.map((_, f) => sumPairs(set.of[k][f], S.i0, S.i1))
    const all = set.frames.map((_, f) => sum(S.outlets.map((o) => sumPairs(set.of[o.k][f], S.i0, S.i1))))
    const nm = sum(mine) || 1
    const na = sum(all) || 1
    const rows = set.frames.map((code, f) => ({ label: t(`frame.${code}`), value: mine[f] / nm, usual: all[f] / na })).sort((a, b) => b.value - a.value)
    const scale = Entity.scaleOf(rows)
    const sec = set.osec[k]
    const ns = sum(sec) || 1
    const sections = set.sections.map((code, j) => ({ code, v: sec[j] / ns })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v)
    return card('c-12', cardHead(t('mme.o.frames.title'), Entity.diffKey(), t('mme.o.frames.info')),
      h('div', { class: 'how-grid how-grid-2' },
        h('div', { class: 'how-panel' }, h('ul', { class: 'diverge diverge-3' }, rows.slice(0, 4).map((r) => Entity.DiffRow({ ...r, scale })))),
        h('div', { class: 'how-panel' }, h('ul', { class: 'diverge diverge-3' }, rows.slice(4).map((r) => Entity.DiffRow({ ...r, scale }))))),
      h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.sections')),
      h('ul', { class: 'mme-chips' }, sections.map((r) => h('li', {}, h('span', { class: 'mme-chip is-static' }, t(`section.${r.code}`), h('span', { class: 'mme-chip-n' }, pctRound(r.v)))))))
  }

  // Whom the outlet quotes, its parties against all outlets, and who attacks whom.
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
      people.length ? h('ul', { class: 'rows' }, people.map((r) => h('li', {}, h('span', { class: 'row-name' }, r.p.name), h('span', { class: 'row-value' }, fmt.int(r.n)), UI.HBar(r.n, max)))) : emptyText(t('media2.empty.list')),
      parties.length ? [h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.parties')), h('p', { class: 'dcard-sub' }, t('mme.o.parties.n', { n: fmt.int(sum([...mine.values()])) })),
        h('ul', { class: 'rows rows-share mme-share' }, parties.map((r) => h('li', {}, h('span', { class: 'row-name' }, r.p), h('span', { class: 'row-value' }, `${pctRound(r.v)} / ${pctRound(r.usual)}`),
          h('span', { class: 'share', 'aria-hidden': 'true' }, h('span', { class: 'share-fill', style: { display: 'block', width: `${r.v * 100}%` } }), h('span', { class: 'share-tick', style: { left: `${r.usual * 100}%` } })))))] : null,
      attacks.length ? [h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.attacks')),
        h('ul', { class: 'rows mme-rows' }, attacks.map(([a, b, n]) => h('li', {}, h('span', { class: 'row-name' }, `${a} → ${b}`), h('span', { class: 'row-value' }, fmt.int(n)))))] : null)
  }

  // The tone of the outlet about each person, here and in the other outlets.
  function PortrayalCard (S, k) {
    const set = S.set
    const o = S.outlets[k]
    const rows = set.people.map((p, j) => {
      const here = o.tone[j]
      const other = [0, 1, 2].map((x) => sum(S.outlets.filter((y) => y.k !== k).map((y) => y.tone[j][x])))
      return { p, n: sum(here), here: netOf(here), else: netOf(other) }
    }).filter((r) => r.n >= 5).sort((a, b) => b.n - a.n)
    const val = (r) => t('mme.o.portray.row', { here: signed(r.here), else: signed(r.else) })
    const more = rows.filter((r) => r.here - r.else >= 0.1).sort((a, b) => (b.here - b.else) - (a.here - a.else))
    const less = rows.filter((r) => r.else - r.here >= 0.1).sort((a, b) => (b.else - b.here) - (a.else - a.here))
    const list = (items) => h('ul', { class: 'rows mme-rows' }, items.map((r) => h('li', {}, h('span', { class: 'row-name' }, r.p.name, ' ', h('span', { class: 'muted-text' }, fmt.int(r.n))),
      h('span', { class: 'row-value' }, h('span', { class: 'mme-net', style: netColor(r.here) }, signed(r.here)), ' / ', h('span', { class: 'mme-net', style: netColor(r.else) }, signed(r.else))))))
    return card('c-12', cardHead(t('mme.o.portray.title'), null, t('mme.o.portray.info')),
      rows.length ? list(rows) : emptyText(t('media2.empty.list')),
      more.length ? [h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.portray.more')), h('p', { class: 'dcard-sub' }, more.map((r) => `${r.p.name} ${val(r)}`).join(' · '))] : null,
      less.length ? [h('h3', { class: 'rows-caption mme-gap' }, t('mme.o.portray.less')), h('p', { class: 'dcard-sub' }, less.map((r) => `${r.p.name} ${val(r)}`).join(' · '))] : null)
  }

  // The newest headlines of the outlet: the title as a link, the day, the frame and the angle.
  function Headlines (set, k) {
    return (set.headlines[k] || []).map(([date, title, url, angle, frame, story]) => h('li', { class: 'mme-headline' },
      App.safeUrl(url) ? h('a', { href: App.safeUrl(url), rel: 'noopener', target: '_blank' }, title) : h('span', {}, title),
      h('span', { class: 'muted-text' }, [fmt.date(date, { day: 'numeric', month: 'short' }), frame >= 0 ? t(`frame.${set.frames[frame]}`) : null, story || null].filter(Boolean).join(' · ')),
      angle ? h('span', { class: 'mme-angle' }, angle) : null))
  }

  window.Mme = { presets, summary, sumPairs, ChipsCard, HighlightsCard, StoriesCard, AgendaCard, PeopleCard, GovCard, TopicCard, PersonsCard, MethodNote, OutletStats, WeeklyAgenda, PushSkip, StanceByTopic, FramesCard, VoicesCard, PortrayalCard, Headlines, topIssues, shareOf, StanceBar, critShare, outletLink }
})()
