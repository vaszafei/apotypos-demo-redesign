import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { mmeProfile } from '../app/utils/mme.ts'
import { outletPairs } from '../app/utils/profiles.ts'
import { outletFacts, weeklyAgenda, coverageOf, stanceByTopic, emphasisOf, voicesOf, portrayalOf, headlinesOf, relatedOutlets } from '../app/utils/outlet-detail.ts'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const set = read('mme').sets.gr
const dd = read('storyDetail')
const plain = v => JSON.parse(JSON.stringify(v))
// Arrays made inside the vm have another prototype, so both sides are compared as JSON.
const eq = (a, b) => assert.deepEqual(plain(a), plain(b))
const prototypes = name => readFileSync(new URL(`../../docs/redesign/prototypes/assets/${name}`, import.meta.url), 'utf8')

// The static code is the reference. mme.js runs with stubs that record what the cards would draw: h() keeps its tree, Dash.card and UI.* keep their arguments.
const text = (key, params) => (params ? `${key}${JSON.stringify(params)}` : key)
const fmt = { int: String, pct: v => `${(v * 100).toFixed(1)}%`, dec: v => v.toFixed(1), date: (d, o) => (o ? `${d}~` : d) }
const h = (tag, attrs, ...children) => ({ tag, attrs, children: children.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false) })
const Dash = {
  card: (cls, ...children) => ({ card: cls, children: children.flat(Infinity) }),
  cardHead: (title, aside, info) => ({ head: title, aside, info }),
  emptyText: s => ({ empty: s })
}
const UI = {
  BarList: (rows, opts) => ({ list: rows, opts }),
  DivergingBar: o => ({ bar: o }),
  Legend: items => ({ legend: items })
}
const Politics = { LineChart: args => ({ lines: args }) }
const staticMme = () => {
  const window = { App: { t: text, fmt, h, locale: 'el', safeUrl: u => u } }
  runInNewContext(prototypes('mme.js'), { window, App: window.App, Dash, UI, Politics })
  return window.Mme
}
// Every recorded node of a kind, in the order of the page.
const walk = (node, key, out = []) => {
  if (Array.isArray(node)) node.forEach(n => walk(n, key, out))
  else if (node && typeof node === 'object') {
    if (key in node) out.push(node)
    Object.values(node).forEach(v => { if (v && typeof v === 'object') walk(v, key, out) })
  }
  return out
}
const last = set.dates.length - 1
const outletsOf = [0, 7, 12, 20, 28]
const P = mmeProfile(set)
const Mme = staticMme()
const S = Mme.summary(set, 0, last)
const name = x => x.el
const pct = v => `${Math.round(v * 100)}%`

test('the pairs of outlets are those of Spread.pairs', () => {
  const window = {}
  runInNewContext(prototypes('spread.js'), { window })
  eq(plain(outletPairs(dd)), plain(window.Spread.pairs(dd)))
})

test('the profile of the whole window is the static summary with its stories, quotes and tone', () => {
  assert.equal(P.total, S.total)
  eq(P.personQuotes, S.personQuotes)
  eq(P.active.map(o => o.k), S.active.map(o => o.k))
  for (const o of P.outlets) eq({ quotes: o.quotes, tone: o.tone }, { quotes: plain(S.outlets[o.k].quotes), tone: plain(S.outlets[o.k].tone) })
  assert.equal(P.stories.length, S.stories.length)
  P.stories.forEach((s, i) => {
    const r = S.stories[i]
    eq({ el: s.el, issue: s.issue, per: s.per, n: s.n, reach: s.reach, generic: s.generic }, { el: r.el, issue: r.issue, per: plain(r.per), n: r.n, reach: r.reach, generic: Boolean(r.generic) })
  })
})

test('the numbers and ranks of an outlet are those of outletFacts', () => {
  for (const k of outletsOf) {
    const f = outletFacts(P, k)
    const r = Mme.outletFacts(S, k)
    assert.equal(`${Math.round(f.news.share * 100)}%`, r.news.value)
    assert.equal(f.news.rank ? text('mme.o.rank', { rank: f.news.rank.rank, n: f.news.rank.n }) : '', r.news.sub)
    assert.equal(f.clickbait.known ? `${Math.round(f.clickbait.share * 100)}%` : '—', r.clickbait.value)
    const rank = f.clickbait.rank ? text('mme.o.rank', { rank: f.clickbait.rank.rank, n: f.clickbait.rank.n }) : text('mme.n', { n: String(f.clickbait.known) })
    assert.equal(f.clickbait.known ? rank : text('mme.o.none'), r.clickbait.sub)
  }
})

test('the weekly agenda has the lines, the weeks and the counts of WeeklyAgenda', () => {
  for (const k of outletsOf) {
    const { lines } = walk(Mme.WeeklyAgenda(set, k), 'lines')[0]
    const mine = weeklyAgenda(set, k)
    eq(mine.series.map(s => name(set.issues[s.issue])), lines.series.map(s => s.label))
    eq(mine.series.map(s => s.values), lines.series.map(s => plain(s.values)))
    eq(mine.weeks.map(w => `${fmt.date(set.dates[w.i0], {})} – ${fmt.date(set.dates[w.i1], {})} (n=${w.n})`), lines.tips)
  }
})

test('the stories an outlet pushes and skips are those of CoverageCard', () => {
  for (const k of outletsOf) {
    const rows = walk(Mme.CoverageCard(S, k), 'tag').filter(n => n.tag === 'li').map(li => ({ name: li.children[0].children[0].children[0], line: li.children[0].children[1].children[0] }))
    const { push, skip } = coverageOf(P, k)
    const mine = [
      ...push.map(r => ({ name: name(r.s), line: text('mme.o.push.row', { n: String(r.s.per[k]), ratio: fmt.dec(r.ratio) }) })),
      ...skip.map(r => ({ name: name(r.s), line: text('mme.o.skip.row', { reach: r.s.reach, n: String(r.s.n), expected: fmt.dec(r.expected) }) }))
    ]
    eq(mine, rows)
  }
})

test('the stance by topic has the rows and the bars of StanceByTopic', () => {
  for (const k of outletsOf) for (const limit of [20, undefined]) {
    const card = Mme.StanceByTopic(S, k, limit)
    const list = walk(card, 'list')[0]?.list ?? []
    const rows = stanceByTopic(P, k, limit)
    assert.equal(rows.length, list.length)
    rows.forEach((r, i) => {
      const [here, others] = list[i].bar.children.map(b => b.bar)
      assert.equal(name(r.issue), list[i].label)
      assert.equal(String(r.n), list[i].text)
      eq([r.mine[0] / r.n, r.mine[2] / r.n, r.allCrit, r.allSup], [here.left, here.right, others.left, others.right])
    })
  }
})

test('what the outlet stresses more or less is that of EmphasisCard', () => {
  const labels = { frame: c => text('frame', c), section: c => text('section', c) }
  for (const k of outletsOf) {
    const topics = set.issues.map((issue, i) => ({ label: name(issue), value: ((i * 7 + k) % 11) / 40 + 0.01, usual: ((i * 5 + 3) % 13) / 40 + 0.021 }))
    const card = Mme.EmphasisCard(S, k, topics, 100)
    // The static card builds its labels from t(`frame.${code}`), so the stub t is compared through the same key.
    const panels = walk(card, 'list')
    const mine = emphasisOf(P, k, topics, { frame: c => text(`frame.${c}`), section: c => text(`section.${c}`) })
    for (const [panel, rows] of [[panels[0], mine.more], [panels[1], mine.less]]) {
      eq(rows.map(r => [r.label, Math.abs(r.ratio - 1), `×${fmt.dec(r.ratio)}`]), panel.list.map(r => [r.label, r.value, r.text]))
      assert.equal(panel.opts.max, mine.top)
    }
  }
  void labels
})

test('whom the outlet quotes is that of VoicesCard', () => {
  for (const k of outletsOf) {
    const lists = walk(Mme.VoicesCard(S, k), 'list')
    const mine = voicesOf(P, k)
    eq(mine.people.map(r => [r.p.name, r.n]), lists[0].list.map(r => [r.label, r.value]))
    eq(mine.parties.map(r => [r.p, `${pct(r.v)} / ${pct(r.usual)}`, r.v, r.usual]), lists[1].list.map(r => [r.label, r.text, r.value, r.marker]))
    if (mine.attacks.length) eq(mine.attacks.map(([a, b, n]) => [`${a.split(' ').pop()} → ${b.split(' ').pop()}`, n]), lists[2].list.map(r => [r.label.children[0], r.value]))
  }
})

test('how the outlet presents the people is that of PortrayalCard', () => {
  for (const k of outletsOf) {
    const list = walk(Mme.PortrayalCard(S, k), 'list')[0]?.list ?? []
    const { rows, scale } = portrayalOf(P, k)
    assert.equal(rows.length, list.length)
    rows.forEach((r, i) => {
      const [here, other] = list[i].bar.children.map(b => b.bar)
      eq([r.p.name, r.n, Math.max(0, -r.here), Math.max(0, r.here), Math.max(0, -r.other), Math.max(0, r.other), scale], [list[i].label[0], Number(list[i].label[2].children[0]), here.left, here.right, other.left, other.right, here.scale])
    })
  }
})

test('the headlines are the newest first', () => {
  for (const k of outletsOf) {
    const mine = headlinesOf(set, k)
    const items = Mme.Headlines(set, k)
    assert.equal(mine.length, items.length)
    mine.forEach((x, i) => assert.equal(x[1], items[i].children[0].children[0]))
    eq(mine.map(x => x[0]), [...mine.map(x => x[0])].sort().reverse())
  }
})

test('the related outlets have 10 shared stories for a score, the peers of the group have a dash', () => {
  const groups = read('groups').groups
  const kd = dd.outlets.findIndex(o => o.group === groups[0].name)
  const o = dd.outlets[kd]
  const { related, slices, unscored } = relatedOutlets(dd, kd, o.slug, o.group, groups[0])
  assert.ok(slices.length <= 12 && slices.every(r => r.score !== null && r.shared >= 10))
  assert.ok(unscored.every(r => r.score === null))
  assert.equal(related.length, slices.length + unscored.length + related.filter(r => r.score !== null).length - slices.length)
  const scores = related.map(r => r.score ?? -1)
  eq(scores, [...scores].sort((a, b) => b - a))
  assert.ok(groups[0].outlets.filter(x => x.slug !== o.slug).every(x => related.some(r => r.slug === x.slug)))
})
