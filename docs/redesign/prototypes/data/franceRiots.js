// Γαλλία: ταραχές (#38). The figures of the shell of the live /france-riots page and of the KPI strip of its comparison report (21 Oct 2026).
// The six reports are copies of the live files in reports/france-riots/ (scripts/make-world-reports.py).
window.FIXTURES = window.FIXTURES || {}
window.FIXTURES.franceRiots = {
  window: ['2026-10-01', '2026-10-19'],
  press: { articles: 976, outlets: 28 },
  facebook: { posts: 998, inTopic: 933 },
  israel: { articles: 139 },
  glance: [
    { key: 'factual', a: 27, b: 49 },
    { key: 'migration', a: 14, b: 5 },
    { key: 'ownvoice', n: 120, of: 134 },
    { key: 'quoting', n: 40, of: 44 },
    { key: 'viral', a: 12 },
    { key: 'police', b: 8 }
  ],
  reports: [
    { key: 'compare', file: 'compare.html', cards: 5 },
    { key: 'press', file: 'press.html', cards: 11, n: 976 },
    { key: 'facebook', file: 'facebook.html', cards: 9, n: 998 },
    { key: 'israel', file: 'israel.html', cards: 6, n: 139 },
    { key: 'narrative', file: 'narrative.html', cards: 7 },
    { key: 'claim', file: 'claim.html', cards: 6 }
  ]
}
