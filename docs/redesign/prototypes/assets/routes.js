// The clean addresses of the site. One table: the browser (this file), the local server (scripts/serve.mjs) and the Netlify rewrites (web/scripts/sync-prototype.mjs) all read it.
// A page is still one html file: the address names the file and the parameters it reads (tab, slug and so on).
(function (root) {
  // [address, file, parameters]. The first row of a file and its parameters is the address that a link gets. A part with ":" is a value.
  const TABLE = [
    ['/', 'index.html'],
    ['/media', 'media-v2.html'],
    ['/media/writing', 'media-v2.html', { tab: 'writing' }],
    ['/media/ownership', 'groups-v2.html'],
    ['/media/similarity', 'similarity-v2.html'],
    ['/media/topics', 'topics-v2.html'],
    ['/media/topics/one/:topic', 'topics-v2.html', { tab: 'topic' }],
    ['/media/topics/one', 'topics-v2.html', { tab: 'topic' }],
    ['/media/topics/agenda', 'topics-v2.html', { tab: 'agenda' }],
    ['/media/topics/shifts', 'overton-v2.html'],
    ['/stories', 'stories-v2.html'],
    ['/stories/outlets', 'stories-v2.html', { tab: 'outlets' }],
    ['/stories/cases', 'cases-v2.html'],
    ['/stories/patterns', 'campaigns-v2.html'],
    ['/people', 'fingerprints-v2.html'],
    ['/people/spread', 'fingerprints-v2.html', { tab: 'spread' }],
    ['/people/statements', 'statements-v2.html'],
    ['/people/file', 'persons-v2.html'],
    ['/people/file/pairs', 'persons-v2.html', { tab: 'pairs' }],
    ['/people/file/checks', 'persons-v2.html', { tab: 'checks' }],
    ['/politics', 'elections-v2.html'],
    ['/politics/outlets', 'elections-v2.html', { tab: 'outlets' }],
    ['/politics/owners', 'elections-v2.html', { tab: 'owners' }],
    ['/politics/topics', 'elections-v2.html', { tab: 'topics' }],
    ['/politics/attacks', 'elections-v2.html', { tab: 'bylines' }],
    ['/analysis/speeches', 'speeches-v2.html'],
    ['/analysis/speeches/palestine', 'un-israel-v2.html'],
    ['/analysis/palestine', 'narrative-v2.html'],
    ['/analysis/palestine/gaza', 'gaza-v2.html'],
    ['/analysis/palestine/israel', 'israel-v2.html'],
    ['/analysis/palestine/language', 'language-v2.html'],
    ['/analysis/greek-turkish', 'war-v2.html'],
    ['/analysis/coverage', 'coverage-v2.html'],
    ['/analysis/france', 'france-v2.html'],
    ['/analysis/france/seven-stories', 'seven-stories-v2.html'],
    ['/outlet/:slug', 'outlet-v2.html'],
    ['/group/:g', 'group-v2.html'],
    ['/topic/:i', 'topic-v2.html'],
    ['/story/:id', 'story-v2.html'],
    ['/speech/:id', 'speech-v2.html'],
    ['/methodology', 'methodology.html'],
    ['/pages', 'pages.html']
  ]
  // The addresses of the live site lead to the same pages.
  const ALIASES = { '/topics': '/media/topics', '/elections': '/politics', '/seven-stories': '/analysis/france/seven-stories', '/speeches': '/analysis/speeches', '/france-riots': '/analysis/france' }
  const partsOf = (path) => path.split('/').filter(Boolean)

  // The file and the parameters of an address, or null.
  function resolve (pathname) {
    const path = ALIASES[pathname.replace(/\/$/, '')] || pathname
    const parts = partsOf(path)
    for (const [address, file, query] of TABLE) {
      const want = partsOf(address)
      if (want.length !== parts.length) continue
      const values = {}
      if (want.every((part, i) => { if (part.startsWith(':')) { values[part.slice(1)] = decodeURIComponent(parts[i]); return true } return part === parts[i] })) return { file, query: { ...query, ...values } }
    }
    return null
  }

  // The clean address of a link to a file. Any other link stays as it is. Parameters that the address does not hold stay in the query.
  function clean (href) {
    const match = /^(?:\.?\/)?([a-z0-9-]+\.html)(\?[^#]*)?(#.*)?$/.exec(href)
    if (!match) return href
    const given = Object.fromEntries(new URLSearchParams(match[2] || ''))
    let best = null
    let score = -1
    for (const [address, file, query] of TABLE) {
      if (file !== match[1]) continue
      const fixed = Object.entries(query || {})
      const values = partsOf(address).filter((p) => p.startsWith(':')).map((p) => p.slice(1))
      if (!fixed.every(([k, v]) => given[k] === v) || !values.every((k) => given[k])) continue
      if (fixed.length + values.length > score) { score = fixed.length + values.length; best = { address, fixed, values } }
    }
    if (!best) return href
    const rest = { ...given }
    best.fixed.forEach(([k]) => delete rest[k])
    best.values.forEach((k) => delete rest[k])
    const path = best.address.split('/').map((p) => (p.startsWith(':') ? encodeURIComponent(given[p.slice(1)]) : p)).join('/') || '/'
    const query = new URLSearchParams(rest).toString()
    return `${path}${query ? `?${query}` : ''}${match[3] || ''}`
  }

  root.ROUTES = { TABLE, ALIASES, resolve, clean }
  if (!root.document) return

  const usable = location.protocol !== 'file:'
  const here = usable ? resolve(location.pathname) : null
  // The parameters of this page: those of its address and those of its query.
  const search = () => {
    const out = new URLSearchParams(location.search)
    Object.entries(here ? here.query : {}).forEach(([k, v]) => { if (!out.has(k)) out.set(k, v) })
    return out
  }
  // This page as a link to its file, as the links of the search index are written.
  const fileHref = () => { const q = search().toString(); return `${here ? here.file : location.pathname.split('/').pop()}${q ? `?${q}` : ''}` }
  // A link to a file gets its clean address. A link to a place or a query on this page keeps this page: the base of the page is the root.
  const href = (value) => {
    if (typeof value !== 'string' || !usable) return value
    if (value.startsWith('#')) return `${location.pathname}${location.search}${value}`
    if (value.startsWith('?')) return here ? clean(`${here.file}${value}`) : `${location.pathname}${value}`
    return clean(value)
  }
  Object.assign(root.ROUTES, { search, fileHref, href })
  // An old address (a file, or an address of the live site) shows its clean address.
  if (usable) {
    const canonical = here ? clean(fileHref()) : clean(`${location.pathname.slice(1)}${location.search}`)
    const now = location.pathname + location.search
    if (canonical !== now && canonical.startsWith('/') && !location.pathname.endsWith('404.html')) history.replaceState(null, '', canonical + location.hash)
  }
})(globalThis)

// The page zoom of tokens.css (--page-zoom). Under it the browser reports positions on the screen, but styles and drawings use page pixels.
// These three keep all the measuring code of the site in page pixels, so a chart fills its card and a tooltip sits at the pointer.
{
  const zoom = () => parseFloat(getComputedStyle(document.documentElement).zoom) || 1
  const rect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    const r = rect.call(this)
    const z = zoom()
    return z === 1 ? r : new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z)
  }
  for (const key of ['clientX', 'clientY']) {
    const d = Object.getOwnPropertyDescriptor(MouseEvent.prototype, key)
    Object.defineProperty(MouseEvent.prototype, key, { ...d, get () { return d.get.call(this) / zoom() } })
  }
  for (const key of ['innerWidth', 'innerHeight']) {
    const d = Object.getOwnPropertyDescriptor(window, key)
    Object.defineProperty(window, key, { ...d, get () { return d.get.call(window) / zoom() } })
  }
}
