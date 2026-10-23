// Numbers of the pages Ιστορίες and Ομοιότητα και πρωτοτυπία, from the fixture storyDetail. Load after dash.js.
// Echo: a story that many ownership groups carried on the same day. Similarity: the shared stories of two outlets.
(function () {
  // An echo is a story that this many ownership groups wrote on the same day. 2 groups give 78 percent of the stories, so the page uses 4 (28 percent).
  const ECHO_MIN = 4

  // The profile of every story. A row of the fixture has the flat triples [outlet, day, rows, ...]. The outlet has an index of dd.outlets and its group is a name or null.
  // reach: the most groups that wrote the story on one day (0 when no outlet with a group wrote it). peakGroups: the groups of that day (the latest day wins a tie).
  // type: how the story started. together: 2 or more groups on the first day with a group. follow: one group first and the others later.
  // single: one group wrote the story on all days. none: no outlet with a group wrote it.
  function profiles (dd) {
    const groupNames = [...new Set(dd.outlets.map((o) => o.group).filter(Boolean))]
    const groupIndex = new Map(groupNames.map((g, i) => [g, i]))
    const list = dd.stories.map((s) => {
      const byDay = new Map()
      let articles = 0
      for (let i = 0; i < s.t.length; i += 3) {
        articles += s.t[i + 2]
        const g = dd.outlets[s.t[i]].group
        if (!g) continue
        const day = s.t[i + 1]
        const rec = byDay.get(day) || new Set()
        rec.add(groupIndex.get(g))
        byDay.set(day, rec)
      }
      const days = [...byDay.keys()].sort((a, b) => a - b)
      let peak = -1
      let reach = 0
      for (const day of days) {
        const size = byDay.get(day).size
        if (size >= reach) { reach = size; peak = day }
      }
      const all = new Set()
      byDay.forEach((set) => set.forEach((g) => all.add(g)))
      const firstGroups = days.length ? [...byDay.get(days[0])] : []
      const type = all.size === 0 ? 'none' : all.size === 1 ? 'single' : firstGroups.length >= 2 ? 'together' : 'follow'
      return { id: s.id, articles, reach, peak, peakGroups: peak < 0 ? [] : [...byDay.get(peak)], firstGroups, groupsAll: [...all], type }
    })
    return { groups: groupNames, list }
  }

  // Pairs of outlets with at least one shared story. The score is the shared stories divided by the stories of either outlet.
  function pairs (dd) {
    const per = new Array(dd.outlets.length).fill(0)
    const shared = new Map()
    for (const s of dd.stories) {
      const members = [...new Set(s.t.filter((_, i) => i % 3 === 0))].sort((a, b) => a - b)
      members.forEach((o) => { per[o]++ })
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = members[i] * 100 + members[j]
          shared.set(key, (shared.get(key) || 0) + 1)
        }
      }
    }
    const list = []
    for (const [key, n] of shared) {
      const a = Math.floor(key / 100)
      const b = key % 100
      const ga = dd.outlets[a].group
      const gb = dd.outlets[b].group
      list.push({ a, b, shared: n, score: n / (per[a] + per[b] - n), sameGroup: Boolean(ga) && ga === gb, grouped: Boolean(ga) && Boolean(gb) })
    }
    return { per, list }
  }

  // The matrix of the outlets with at least minStories stories. The cell (a, b) is the share of the stories of a that b also wrote, so it is not symmetric.
  // The order comes from an average-linkage clustering of the shared stories, so outlets with the same stories stand together.
  function matrix (dd, minStories) {
    const { per, list } = pairs(dd)
    const sharedBy = new Map(list.map((p) => [p.a * 100 + p.b, p.shared]))
    const shared = (a, b) => sharedBy.get(Math.min(a, b) * 100 + Math.max(a, b)) || 0
    const ids = per.map((n, i) => ({ n, i })).filter((x) => x.n >= minStories).sort((a, b) => b.n - a.n).map((x) => x.i)
    const jaccard = (a, b) => shared(a, b) / (per[a] + per[b] - shared(a, b))
    let clusters = ids.map((i) => [i])
    while (clusters.length > 1) {
      let best = [-1, 0, 0]
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          let sum = 0
          clusters[i].forEach((a) => clusters[j].forEach((b) => { sum += jaccard(a, b) }))
          const mean = sum / (clusters[i].length * clusters[j].length)
          if (mean > best[0]) best = [mean, i, j]
        }
      }
      const [, i, j] = best
      const joined = clusters[i].concat(clusters[j])
      clusters = clusters.filter((_, k) => k !== i && k !== j).concat([joined])
    }
    const cover = (a, b) => shared(a, b) / per[a]
    // The lift is the cover divided by the share of all stories that b wrote. A value of 1 is the level of chance, so the size of b does not count.
    const lift = (a, b) => cover(a, b) / (per[b] / dd.stories.length)
    return { per, ids, order: clusters[0] || [], left: per.map((_, i) => i).filter((i) => !ids.includes(i)), shared, cover, lift }
  }

  // A ring: one arc for each item { name, n, color }. The arcs share the sum of n. The center has a number and a caption. A small gap separates the arcs.
  // tip(item) gives the text of the tooltip of an arc.
  function Ring (items, { center, caption, aria, tip }) {
    const { h } = window.App
    const sum = items.reduce((s, it) => s + it.n, 0) || 1
    const size = 172
    const r = 66
    const sw = 26
    const c = size / 2
    const point = (a) => [c + r * Math.cos(a), c + r * Math.sin(a)]
    const svg = h('svg', { class: 'chart ring', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': aria })
    let a0 = -Math.PI / 2
    items.filter((it) => it.n > 0).forEach((it, k, shown) => {
      const span = (it.n / sum) * Math.PI * 2
      const gap = shown.length > 1 ? Math.min(0.03, span * 0.3) : 0
      const [x0, y0] = point(a0 + gap / 2)
      const [x1, y1] = point(a0 + span - gap / 2 - (shown.length === 1 ? 0.0001 : 0))
      const arc = h('path', { class: 'ring-arc', d: `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`, stroke: it.color, 'stroke-width': sw })
      const text = tip(it)
      arc.addEventListener('pointermove', (e) => UI.showTooltip(text, e.clientX, e.clientY))
      arc.addEventListener('pointerleave', () => UI.hideTooltip())
      svg.append(arc)
      a0 += span
    })
    svg.append(h('text', { class: 'ring-total', x: c, y: c + 4, 'text-anchor': 'middle' }, center), h('text', { class: 'ring-cap', x: c, y: c + 20, 'text-anchor': 'middle' }, caption))
    return svg
  }

  // A difference bar (UI.DivergingBar). The center line is the usual value. The bar goes right (teal) when the value is more, left (orange) when it is less.
  // diff is the value minus the usual value, scale is the diff that fills half of the track.
  function DiffTrack (diff, scale, tip) {
    return UI.DivergingBar({ left: -diff, right: diff, scale, colors: ['var(--emph-less)', null, 'var(--emph-more)'], label: tip })
  }

  window.Spread = { ECHO_MIN, profiles, pairs, matrix, Ring, DiffTrack }
})()
