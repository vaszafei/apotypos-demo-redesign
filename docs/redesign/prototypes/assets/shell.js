// AppShell, SidebarNav, HeaderBar and PageFooter. Source: knowledge_base/redesign/shell-spec.md.
(function () {
  const { t, h, Icon } = window.App

  // The pages with a prototype. Each other sidebar item opens its row in the table of pages.
  const PROTOTYPES = {
    '/': 'index.html',
    '/trends': 'topics-v2.html',
    '/trends/time': 'topics-v2.html',
    '/trends/topic': 'topics-v2.html?tab=topic',
    '/trends/agenda': 'topics-v2.html?tab=agenda',
    '/overton': 'overton-v2.html',
    '/stories': 'stories-v2.html',
    '/stories/outlets': 'stories-v2.html?tab=outlets',
    '/echoes': 'stories-v2.html',
    '/similarity': 'similarity-v2.html',
    '/originality': 'similarity-v2.html#originality',
    '/campaigns': 'campaigns-v2.html',
    '/media': 'media-v2.html',
    '/media/writing': 'media-v2.html?tab=writing',
    '/fingerprints': 'fingerprints-v2.html',
    '/fingerprints/spread': 'fingerprints-v2.html?tab=spread',
    '/groups': 'groups-v2.html',
    '/analyze': 'groups-v2.html',
    '/elections': 'elections-v2.html',
    '/elections/outlets': 'elections-v2.html?tab=outlets',
    '/elections/owners': 'elections-v2.html?tab=owners',
    '/elections/topics': 'elections-v2.html?tab=topics',
    '/elections/bylines': 'elections-v2.html?tab=bylines',
    '/speeches': 'speeches-v2.html',
    '/contradictions': 'persons-v2.html',
    '/contradictions/pairs': 'persons-v2.html?tab=pairs',
    '/contradictions/checks': 'persons-v2.html?tab=checks',
    '/track': 'statements-v2.html',
    '/cases': 'cases-v2.html',
    '/war': 'war-v2.html',
    '/narrative': 'narrative-v2.html',
    '/coverage': 'coverage-v2.html',
    '/france-riots': 'france-v2.html',
    '/gaza': 'gaza-v2.html',
    '/israel': 'israel-v2.html',
    '/gaza-language': 'language-v2.html',
    '/un-israel-palestine': 'un-israel-v2.html',
    '/methodology': 'methodology.html'
  }

  // The sidebar has 6 items (APO-161: Media and Ownership are one item). The sub-pages of an item are tabs inside the page (shell-spec.md, "Navigation").
  // The item "world" is Αναλύσεις. Πολεμική ρητορική is Αναλύσεις › Ελληνοτουρκικά (/war, it left Πολιτική) and Παράθυρο is Μέσα › Μετατοπίσεις.
  // A tab can have sub-tabs (a third item of the tab). Its first sub-tab is its page. Ομιλίες ΟΗΕ holds the Israel–Palestine part of the speeches,
  // Παλαιστίνη–Ισραήλ holds the Gaza and Israel pages.
  // Αναλύσεις & Ιδιοκτησία (/analyze) is not there: ownership is only Μέσα › Ιδιοκτησία, so /analyze opens that tab.
  // ΜΜΕ & πρόσωπα (/media) is not there: its content is Μέσα › Επισκόπηση. Θέματα (/trends) is a tab of Μέσα, not an item of its own.
  // Πρόσωπα is an item: its overview (/fingerprints), Δηλώσεις (/track, from Πολιτική) and Φάκελος προσώπου (/contradictions), which left Αναλύσεις.
  // Ιστορίες has Υποθέσεις (/cases) and Μοτίβα διάδοσης (/campaigns), both from Πολιτική.
  // #62: each tab answers one question (question.<item>.<tab>), listed in the table of pages. A new tab is a view of the file of its section (?tab=), so every old route opens the same file.
  // Θέματα holds the topic pages as sub-tabs, Μετατοπίσεις (/overton) among them. Πολιτική splits the elections page into 5 tabs.
  // A detail route names the tab that lists it: the back button and the trail of the page go there.
  const NAV = [
    { key: 'home', tabs: [['home', '/']] },
    { key: 'media', tabs: [['overview', '/media'], ['ownership', '/groups'],
      ['topics', '/trends', [['topics.overview', '/trends'], ['topics.topic', '/trends/topic'], ['topics.agenda', '/trends/agenda'], ['shifts', '/overton']]],
      ['writing', '/media/writing'], ['similarity', '/similarity']], details: [['/outlet', '/media'], ['/group', '/groups'], ['/topic', '/trends']] },
    { key: 'spread', tabs: [['overview', '/stories'], ['outlets', '/stories/outlets'], ['cases', '/cases'], ['campaigns', '/campaigns']], details: [['/story', '/stories']] },
    { key: 'people', tabs: [['overview', '/fingerprints'], ['spread', '/fingerprints/spread'], ['statements', '/track'],
      ['file', '/contradictions', [['file.overview', '/contradictions'], ['file.pairs', '/contradictions/pairs'], ['file.checks', '/contradictions/checks']]]] },
    { key: 'politics', tabs: [['reach', '/elections'], ['outlets', '/elections/outlets'], ['owners', '/elections/owners'], ['topics', '/elections/topics'], ['bylines', '/elections/bylines']] },
    { key: 'world', tabs: [['speeches', '/speeches', [['speeches.all', '/speeches'], ['speeches.pi', '/un-israel-palestine']]],
      ['pi', '/narrative', [['pi.overview', '/narrative'], ['gaza', '/gaza'], ['israel', '/israel'], ['language', '/gaza-language']]],
      ['greekturkish', '/war'], ['coverage', '/coverage'], ['france', '/france-riots']] }
  ]
  const FOOTER = [['methodology', '/methodology'], ['about', '/about']]

  const hasText = (key) => key in window.MESSAGES.el
  const under = (route, base) => route === base || (base !== '/' && route.startsWith(base + '/'))
  // The pages of an item: each tab, or the sub-tabs of a tab with sub-tabs. Each page is [key, route, parent tab].
  const pagesOf = (item) => item.tabs.flatMap((tab) => (tab[2] ? tab[2].map(([key, r]) => [key, r, tab]) : [[tab[0], tab[1], null]]))
  function itemOf (route) {
    return NAV.find((item) => pagesOf(item).some(([, r]) => under(route, r)) || (item.details || []).some(([r]) => under(route, r)))
  }
  // The label of a page of an item: "Item › Tab" or "Item › Tab › Sub-tab". An item with one tab is "Item".
  function pageLabel (item, [key, , parent]) {
    if (item.tabs.length < 2) return t(`nav.${item.key}`)
    return [t(`nav.${item.key}`), parent && t(`tab.${item.key}.${parent[0]}`), t(`tab.${item.key}.${key}`)].filter(Boolean).join(' › ')
  }
  // The label of the place of a route. It is null for a route with no sidebar item.
  function placeOf (route) {
    const item = itemOf(route)
    if (!item) return null
    const pages = pagesOf(item)
    const page = pages.find(([, r]) => r === route) || pages.find(([, r]) => under(route, r))
    return page ? pageLabel(item, page) : t(`nav.${item.key}`)
  }

  function routeAnchor (route) {
    return 'r-' + (encodeURI(route).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home')
  }
  function hrefOf (route) {
    return PROTOTYPES[route] || `pages.html#${routeAnchor(route)}`
  }

  const smallScreen = window.matchMedia('(max-width: 1023px)')

  // Prototype only: the accounts are fixed, and the check runs in the browser, so it keeps nobody out of the files of the prototype.
  const ACCOUNTS = { lolovios: 'typosapo', odpein: 'typosapo', npizza: 'typosapo' }
  const USER_KEY = 'proto-user'
  function currentUser () {
    try { const user = localStorage.getItem(USER_KEY); return user && Object.hasOwn(ACCOUNTS, user) ? user : null } catch { return null }
  }
  const signedIn = () => currentUser() !== null
  function signIn (name, password) {
    const user = name.trim().toLowerCase()
    if (!Object.hasOwn(ACCOUNTS, user) || ACCOUNTS[user] !== password) return false
    try { localStorage.setItem(USER_KEY, user) } catch { return false }
    return true
  }
  function signOut () { try { localStorage.removeItem(USER_KEY) } catch {} }

  // The drawer of log in and sign up: it slides in from the right over a scrim. The page behind it is inert while it is open.
  // After a log in the page draws again (remount), so the lock of Αναλύσεις opens without leaving the page.
  let remount = () => {}
  let authDrawer = null
  function openAuth (view = 'login') {
    if (authDrawer) authDrawer.close(false)
    const app = document.getElementById('app')
    const opener = document.activeElement
    const title = h('h2', { class: 'auth-title', id: 'auth-title' })
    const text = h('p', { class: 'auth-text' })
    const body = h('div', { class: 'auth-body' })
    const views = ['login', 'register']
    const switchButtons = views.map((v) => h('button', { type: 'button', onClick: () => show(v, true) }, t(`shell.${v}`)))
    const closeButton = h('button', { type: 'button', class: 'icon-button auth-close', 'aria-label': t('auth.close'), onClick: () => close() }, Icon('x-mark'))
    const panel = h('aside', { class: 'auth-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'auth-title' },
      h('div', { class: 'auth-head' }, h('div', { class: 'auth-switch', role: 'group', 'aria-label': t('auth.switch') }, switchButtons), closeButton),
      h('span', { class: 'gate-icon' }, Icon('lock-closed', 'icon')), title, text, body)
    const scrim = h('div', { class: 'auth-scrim', onClick: () => close() })

    const field = (id, label, attrs) => {
      const input = h('input', { id, ...attrs })
      return [h('label', { for: id }, label, input), input]
    }
    function loginForm () {
      const [userLabel, user] = field('auth-user', t('login.user'), { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true })
      const [passwordLabel, password] = field('auth-password', t('login.password'), { type: 'password', autocomplete: 'current-password', required: true })
      const error = h('p', { class: 'login-error', role: 'alert', hidden: true }, t('login.error'))
      const form = h('form', { class: 'login-form', onSubmit: (e) => {
        e.preventDefault()
        if (signIn(user.value, password.value)) { close(false); remount(); return }
        error.hidden = false
        password.value = ''
        password.focus()
      } }, userLabel, passwordLabel, error, h('button', { type: 'submit', class: 'button button-primary' }, t('login.submit')))
      return form
    }
    // Sign up has no accounts behind it in the prototype: the form shows that when it is sent.
    function registerForm () {
      const [nameLabel] = field('auth-name', t('register.name'), { type: 'text', autocomplete: 'name', required: true })
      const [emailLabel] = field('auth-email', t('register.email'), { type: 'email', autocomplete: 'email', required: true })
      const [passwordLabel] = field('auth-new-password', t('login.password'), { type: 'password', autocomplete: 'new-password', required: true })
      const notice = h('p', { class: 'login-notice', role: 'status', hidden: true }, t('register.soon'))
      return h('form', { class: 'login-form', onSubmit: (e) => { e.preventDefault(); notice.hidden = false } },
        nameLabel, emailLabel, passwordLabel, notice, h('button', { type: 'submit', class: 'button button-primary' }, t('register.submit')))
    }
    function show (v, focus) {
      switchButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(views[i] === v)))
      title.textContent = t(`${v}.title`)
      text.textContent = t(`${v}.text`)
      body.replaceChildren(v === 'login' ? loginForm() : registerForm())
      if (focus) body.querySelector('input').focus()
    }

    function onKey (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll('button, input, a[href]')].filter((el) => !el.hidden && !el.disabled)
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    function close (restore = true) {
      if (authDrawer?.panel !== panel) return
      authDrawer = null
      document.removeEventListener('keydown', onKey)
      app.inert = false
      panel.classList.remove('is-open')
      scrim.classList.remove('is-open')
      setTimeout(() => { panel.remove(); scrim.remove() }, reduceMotion.matches ? 0 : 220)
      if (restore && opener?.isConnected) opener.focus({ preventScroll: true })
    }

    show(view, false)
    document.body.append(scrim, panel)
    app.inert = true
    document.addEventListener('keydown', onKey)
    authDrawer = { panel, close }
    panel.getBoundingClientRect()
    panel.classList.add('is-open')
    scrim.classList.add('is-open')
    body.querySelector('input').focus()
  }

  // Αναλύσεις needs a log in. Its pages show the page head and a card: the lock, what is behind it, log in, sign up.
  function SignInGate () {
    return h('section', { class: 'gate', 'aria-labelledby': 'gate-title' },
      h('div', { class: 'gate-card' },
        h('span', { class: 'gate-icon' }, Icon('lock-closed', 'icon')),
        h('h2', { class: 'gate-title', id: 'gate-title' }, t('gate.title')),
        h('p', { class: 'gate-text' }, t('gate.text')),
        h('button', { type: 'button', class: 'button button-primary gate-login', onClick: () => openAuth('login') }, t('shell.login')),
        h('p', { class: 'gate-register' }, t('gate.register'), ' ', h('button', { type: 'button', class: 'link-button', onClick: () => openAuth('register') }, t('shell.register')))))
  }

  // Prototype only: the font candidates for the decision of the project lead. ?font= or the last choice sets the font.
  const FONTS = [['plex', 'IBM Plex Sans'], ['manrope', 'Manrope'], ['commissioner', 'Commissioner'], ['inter', 'Inter + Source Serif 4'], ['dejavu', 'DejaVu Sans (λογότυπο)'], ['ubuntu', 'Ubuntu'], ['noto', 'Noto Sans'], ['sourcesans', 'Source Sans 3'], ['geologica', 'Geologica'], ['sofia', 'Sofia Sans'], ['literata', 'Source Sans 3 + Literata']]
  function readFont () {
    const asked = new URLSearchParams(location.search).get('font')
    let saved = null
    try { saved = localStorage.getItem('proto-font') } catch {}
    return [asked, saved].find((f) => FONTS.some(([k]) => k === f)) || 'plex'
  }
  function setFont (key) {
    document.documentElement.dataset.font = key
    try { localStorage.setItem('proto-font', key) } catch {}
  }
  setFont(readFont())

  // Prototype only: the themes for the decision of the project lead (tokens.css). ?theme= or the last choice sets it.
  const THEMES = ['paper', 'fog', 'terra', 'night', 'midnight']
  function readTheme () {
    const asked = new URLSearchParams(location.search).get('theme')
    let saved = null
    try { saved = localStorage.getItem('proto-theme') } catch {}
    return [asked, saved].find((k) => THEMES.includes(k)) || 'paper'
  }
  function setTheme (key) {
    document.documentElement.dataset.theme = key
    try { localStorage.setItem('proto-theme', key) } catch {}
  }
  setTheme(readTheme())

  // The unified header (v2) is the default. ?header=v1 shows the old header for comparison; ?header= or the last choice sets it.
  // v2: the top bar holds only the back button and the search. The page head under it holds the tabs, the page actions and the sub-tabs.
  function readHeader () {
    const asked = new URLSearchParams(location.search).get('header')
    let saved = null
    try { if (asked) localStorage.setItem('proto-header', asked); saved = localStorage.getItem('proto-header') } catch {}
    return (asked || saved) === 'v1' ? 'v1' : 'v2'
  }
  const headerV2 = readHeader() === 'v2'
  document.documentElement.dataset.header = headerV2 ? 'v2' : 'v1'

  // The global search (#61): a compact button in the top bar that grows into a search over the whole site.
  // It finds the pages and tabs, the outlets, groups and topics, the stories, cases and spread patterns, the people and statements,
  // the parties and bylines of Πολιτική and the UN speeches. data/search.js (scripts/make-search.mjs) holds all but the pages: it loads on the first open.
  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ς/g, 'σ')
  // Most outlet and group names are in Latin letters, so a Greek query also matches in Latin letters ("πολιτ" finds "Politis"),
  // and a Latin query matches a Greek name in Latin letters ("tsipras" finds "Τσίπρας").
  const LATIN = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' }
  const latin = (s) => s.replace(/[α-ω]/g, (c) => LATIN[c] ?? c)
  function loadFixture (key) {
    if (window.FIXTURES?.[key]) return Promise.resolve(window.FIXTURES[key])
    return new Promise((resolve) => {
      const script = h('script', { src: `data/${key}.js?v=1` })
      script.onload = () => resolve(window.FIXTURES?.[key] || null)
      script.onerror = () => resolve(null)
      document.head.append(script)
    })
  }
  // The kinds in the order of the results. Each shows its best 3 to 6 and "Εμφάνιση όλων" for the rest.
  const KINDS = ['pages', 'outlets', 'groups', 'topics', 'stories', 'cases', 'campaigns', 'people', 'statements', 'parties', 'bylines', 'speeches']
  // "Εμφάνιση όλων" draws up to 300 of a kind: a query that finds more (one letter) asks for more letters.
  const SHOW_ALL = 300
  const LIMITS = { pages: 5, outlets: 5, groups: 3, topics: 4, stories: 6, cases: 3, campaigns: 3, people: 5, statements: 3, parties: 3, bylines: 3, speeches: 4 }
  // A page or tab: its own name, and where it lives (the section, and the tab of a sub-tab).
  function pageEntries () {
    const named = NAV.flatMap((item) => pagesOf(item).map((page) => {
      const path = pageLabel(item, page).split(' › ')
      return { kind: 'pages', n: path.pop(), where: path.join(' › '), h: hrefOf(page[1]) }
    }))
    return [...named, ...FOOTER.filter(([, r]) => r).map(([key, r]) => ({ kind: 'pages', n: t(`nav.${key}`), where: '', h: hrefOf(r) }))]
  }
  // The entries of the index, in the language of the page. The place of an entry is the page that lists it.
  function indexEntries (index) {
    const name = (x) => (window.App.locale === 'en' && x.en) || x.n
    const topics = index.kinds.topics
    const where = (x) => [placeOf(x.r), x.s && t(`shell.search.set.${x.s}`)].filter(Boolean).join(' · ')
    const out = {}
    for (const kind of KINDS.slice(1)) out[kind] = (index.kinds[kind] || []).map((x) => ({ kind, n: name(x), d: x.d, h: x.h, where: where(x), alt: [x.n, x.en, ...(x.a || [])] }))
    const storyWhere = placeOf('/stories')
    out.stories.unshift(...index.storyRows.map(([id, el, issue, outlets, en]) =>
      ({ kind: 'stories', n: (window.App.locale === 'en' && en) || el, d: topics[issue] && name(topics[issue]), h: `story-v2.html?id=${id}`, where: storyWhere, alt: [el, en], outlets })))
    return out
  }
  function keysOf (e) {
    if (!e.key) {
      e.key = fold([e.n, e.where && e.kind === 'pages' ? e.where : '', ...(e.alt || [])].filter(Boolean).join(' '))
      e.latinKey = latin(e.key)
    }
    return e
  }
  // All the hits of a query, the best first: a name that starts with the query, then a word that starts with it, then the rest.
  function match (entries, query) {
    const words = fold(query).split(/\s+/).filter(Boolean)
    const latinWords = words.map(latin)
    const hits = []
    for (const e of entries) {
      keysOf(e)
      const key = [[words, e.key], [latinWords, e.key], [words, e.latinKey]].find(([list, k]) => list.every((w) => k.includes(w)))
      if (!key) continue
      const [list, k] = key
      hits.push({ e, rank: k.startsWith(list[0]) ? 0 : k.includes(' ' + list[0]) ? 1 : 2 })
    }
    return hits.sort((a, b) => a.rank - b.rank).map((x) => x.e)
  }

  // The last pages and searches of the visitor, in this browser only.
  const RECENT_KEY = 'proto-search-recent'
  function readRecent () {
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY)); return { pages: r?.pages || [], queries: r?.queries || [] } } catch { return { pages: [], queries: [] } }
  }
  function remember (kind, value, same) {
    const recent = readRecent()
    recent[kind] = [value, ...recent[kind].filter((x) => !same(x))].slice(0, 6)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch {}
  }
  const hereHref = () => location.pathname.split('/').pop() + location.search

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  let searchOverlay = null

  // hero: the large search of Αρχική, in the page instead of the top bar. It opens the same panel, the width of the field.
  function GlobalSearch ({ hero = false } = {}) {
    const pages = pageEntries()
    let entities = null
    let loading = null
    let failed = false
    let options = []
    let active = -1
    let expanded = new Set()
    const limits = {}
    let isOpen = false
    let motion = []
    const listId = 'global-search-list'
    const panelId = 'global-search-panel'

    // Collapsed: the button. Its place in the bar stays the same when the search opens, so the page does not move.
    const button = h('button', {
      type: 'button', class: hero ? 'search-button search-hero' : 'search-button', 'aria-label': t('shell.search'), title: t('shell.search'),
      'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': panelId, 'aria-keyshortcuts': '/'
    }, Icon('magnifying-glass', 'icon search-button-icon'), h('span', { class: 'search-button-label', 'aria-hidden': 'true' }, t(hero ? 'shell.search.placeholder' : 'shell.search')),
    h('kbd', { class: 'global-search-key', 'aria-hidden': 'true' }, '/'),
    hero ? h('span', { class: 'search-hero-go', 'aria-hidden': 'true' }, t('shell.search')) : null)
    const box = h('div', { class: hero ? 'global-search is-hero' : 'global-search' }, button)

    // Open: the field, the results and a short line of keys, over a light scrim.
    const input = h('input', {
      type: 'search', class: 'global-search-input', placeholder: t('shell.search.placeholder'), 'aria-label': t('shell.search'),
      role: 'combobox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go'
    })
    const closeButton = h('button', { type: 'button', class: 'search-close', 'aria-label': t('shell.search.close'), title: t('shell.search.close') }, Icon('x-mark', 'icon'))
    const list = h('div', { class: 'global-search-list', id: listId, role: 'listbox', 'aria-label': t('shell.search') })
    const status = h('div', { class: 'visually-hidden', role: 'status' })
    const panel = h('div', { class: hero ? 'search-panel is-hero' : 'search-panel', id: panelId, role: 'dialog', 'aria-label': t('shell.search'), hidden: true },
      h('div', { class: 'search-field' }, Icon('magnifying-glass', 'icon global-search-icon'), input, closeButton),
      list, status, h('p', { class: 'search-keys', 'aria-hidden': 'true' }, t('shell.search.keys')))
    const scrim = h('div', { class: 'search-scrim', hidden: true })
    // A new language mounts the shell again: the old search leaves the page.
    searchOverlay?.forEach((el) => el.remove())
    searchOverlay = [scrim, panel]
    document.body.append(scrim, panel)

    function ensure () {
      if (loading) return
      loading = loadFixture('search').then((index) => {
        if (index) entities = indexEntries(index)
        else failed = true
        if (isOpen) render()
      })
    }

    function setActive (i) {
      active = i
      options.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)))
      input.setAttribute('aria-activedescendant', i >= 0 ? options[i].id : '')
      if (i >= 0) options[i].scrollIntoView({ block: 'nearest' })
    }

    let n = 0
    function option (e) {
      const where = [t(`shell.search.one.${e.kind}`), e.where].filter(Boolean).join(' · ')
      return h('a', { class: 'global-search-option', id: `gs-${n++}`, role: 'option', href: e.h, tabindex: '-1', 'aria-selected': 'false' },
        h('span', { class: 'global-search-name' }, h('span', { class: 'global-search-label' }, e.n), e.d ? h('span', { class: 'global-search-sub' }, e.d) : null),
        h('span', { class: 'global-search-where' }, where))
    }
    // A group of results: the kind, the count, the best ones and "Εμφάνιση όλων" for the rest.
    function section (key, label, hits, limit) {
      const all = expanded.has(key)
      limits[key] = limit
      const shown = hits.slice(0, all ? SHOW_ALL : limit)
      const labelId = `gs-kind-${key}`
      return h('div', { class: 'global-search-group', role: 'group', 'aria-labelledby': labelId },
        h('div', { class: 'global-search-kind', id: labelId }, h('span', {}, label), h('span', { class: 'global-search-count' }, fmtInt(hits.length))),
        shown.map(option),
        hits.length > shown.length && !all
          ? h('div', { class: 'global-search-option global-search-more', id: `gs-${n++}`, role: 'option', tabindex: '-1', 'aria-selected': 'false', 'data-more': key }, t('shell.search.all', { n: fmtInt(hits.length) }))
          : null,
        all && hits.length > shown.length ? h('p', { class: 'global-search-note' }, t('shell.search.more', { n: fmtInt(shown.length), total: fmtInt(hits.length) })) : null)
    }
    const fmtInt = (x) => window.App.fmt.int(x)
    const note = (text) => h('p', { class: 'global-search-note' }, text)
    const loadingNote = () => h('div', { class: 'global-search-loading' }, h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' }), note(t('shell.search.loading')))

    // Before typing: the last pages and searches of the visitor, then the stories in the most outlets and the groups.
    function renderStart () {
      const recent = readRecent()
      const here = hereHref()
      const recentPages = recent.pages.filter((p) => p.h !== here).slice(0, 4).map((p) => {
        const page = pages.find((x) => x.h === p.h)
        return page || { kind: 'pages', n: p.n, where: p.r ? placeOf(p.r) : '', h: p.h }
      })
      const queries = recent.queries.slice(0, 4)
      const blocks = []
      if (recentPages.length) blocks.push(section('recent-pages', t('shell.search.recent.pages'), recentPages, 4))
      if (queries.length) {
        blocks.push(h('div', { class: 'global-search-group', role: 'group', 'aria-labelledby': 'gs-kind-recent-queries' },
          h('div', { class: 'global-search-kind', id: 'gs-kind-recent-queries' }, h('span', {}, t('shell.search.recent.queries'))),
          queries.map((q) => h('div', { class: 'global-search-option is-query', id: `gs-${n++}`, role: 'option', tabindex: '-1', 'aria-selected': 'false', 'data-query': q },
            Icon('magnifying-glass', 'icon icon-sm'), h('span', { class: 'global-search-label' }, q)))))
      }
      if (entities) {
        blocks.push(section('suggest-stories', t('shell.search.suggest.stories'), entities.stories.filter((s) => s.outlets).slice(0, 5), 5))
        blocks.push(section('suggest-groups', t('shell.search.groups'), entities.groups, 4))
      } else blocks.push(failed ? note(t('shell.search.failed')) : loadingNote())
      return blocks
    }

    function render () {
      n = 0
      const query = input.value.trim()
      let blocks
      let count = null
      if (!query) blocks = renderStart()
      else {
        const sections = [['pages', match(pages, query)]]
        if (entities) KINDS.slice(1).forEach((k) => sections.push([k, match(entities[k], query)]))
        const found = sections.filter(([, hits]) => hits.length)
        count = found.reduce((s, [, hits]) => s + hits.length, 0)
        blocks = found.map(([k, hits]) => section(k, t(`shell.search.${k}`), hits, LIMITS[k]))
        if (!entities) blocks.push(failed ? note(t('shell.search.failed')) : loadingNote())
        else if (!found.length) blocks.push(note(t('shell.search.none', { q: query })))
      }
      list.replaceChildren(...blocks)
      options = [...list.querySelectorAll('[role="option"]')]
      input.setAttribute('aria-expanded', String(options.length > 0))
      setActive(query && options.length ? 0 : -1)
      status.textContent = count == null ? '' : count === 1 ? t('shell.search.count.one') : count ? t('shell.search.count', { n: fmtInt(count) }) : t('shell.search.none', { q: query })
    }

    // The panel sits over the button: centered on it on a wide screen, the full width of the screen on a phone (CSS).
    // The hero field takes its own width. Scrolled out of view, it opens at the top of the window.
    const inView = () => { const b = button.getBoundingClientRect(); return b.bottom > 0 && b.top < window.innerHeight }
    function place () {
      panel.style.maxHeight = ''
      if (smallScreen.matches) { panel.style.left = panel.style.top = panel.style.width = ''; return }
      if (hero && !inView()) {
        const w = Math.min(640, window.innerWidth - 32)
        Object.assign(panel.style, { width: `${w}px`, left: `${(window.innerWidth - w) / 2}px`, top: '12px' })
        return
      }
      // The results need room under the hero field: a field low in the window comes up under the navbar first.
      if (hero && window.innerHeight - button.getBoundingClientRect().top < 420) {
        window.scrollBy({ top: button.getBoundingClientRect().top - (parseFloat(token('--navbar-height')) || 56) - 24, behavior: 'instant' })
      }
      const b = button.getBoundingClientRect()
      if (hero) panel.style.maxHeight = `${window.innerHeight - Math.max(8, b.top - 4) - 16}px`
      const width = Math.min(hero ? Math.max(640, b.width + 8) : 640, window.innerWidth - 32)
      panel.style.width = `${width}px`
      panel.style.left = `${Math.max(16, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - 16 - width))}px`
      panel.style.top = `${Math.max(8, b.top - 4)}px`
    }
    // The button grows into the panel and the panel shrinks back into the button: transform and opacity only.
    // With reduced motion the panel only fades.
    function morph (opening) {
      motion.forEach((a) => a.cancel())
      const from = button.getBoundingClientRect()
      const to = panel.getBoundingClientRect()
      const small = { opacity: 0 }
      const big = { opacity: 1 }
      if (!reduceMotion.matches && (!hero || inView())) {
        small.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
        big.transform = 'none'
      }
      const timing = { duration: parseFloat(token('--motion-base')) || 0, easing: token(opening ? '--ease-out' : '--ease-in-out'), fill: 'both' }
      motion = [
        panel.animate(opening ? [small, big] : [big, small], timing),
        scrim.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], timing),
        button.animate(opening ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { ...timing, duration: parseFloat(token('--motion-fast')) || 0 })
      ]
      return motion[0].finished.catch(() => null)
    }

    // A query (a chip of the hero) opens the search with that text in the field.
    function open (query = '') {
      if (isOpen) { input.focus(); return }
      isOpen = true
      ensure()
      expanded = new Set()
      input.value = query
      panel.hidden = scrim.hidden = false
      box.classList.add('is-open')
      button.setAttribute('aria-expanded', 'true')
      place()
      render()
      input.focus()
      morph(true).then(() => { if (isOpen) motion.forEach((a) => a.cancel()) })
    }
    function close ({ focus = true } = {}) {
      if (!isOpen) return
      isOpen = false
      button.setAttribute('aria-expanded', 'false')
      input.setAttribute('aria-expanded', 'false')
      if (focus) button.focus({ preventScroll: true })
      morph(false).then(() => {
        if (isOpen) return
        panel.hidden = scrim.hidden = true
        box.classList.remove('is-open')
        motion.forEach((a) => a.cancel())
      })
    }
    // Choose: open a result, show all of a kind, or search a recent query again.
    function choose (el) {
      if (el.dataset.more) {
        // The first of the rest becomes the active result.
        const kind = el.dataset.more
        expanded.add(kind)
        render()
        const rows = options.filter((o) => o.parentElement.getAttribute('aria-labelledby') === `gs-kind-${kind}`)
        setActive(options.indexOf(rows[limits[kind]] || rows[0]))
        input.focus()
        return
      }
      if (el.dataset.query) { input.value = el.dataset.query; render(); input.focus(); return }
      const query = input.value.trim()
      if (query) remember('queries', query, (q) => fold(q) === fold(query))
      close({ focus: false })
      location.href = el.getAttribute('href')
    }

    button.addEventListener('click', () => open())
    closeButton.addEventListener('click', () => close())
    scrim.addEventListener('click', () => close({ focus: false }))
    input.addEventListener('input', () => { expanded = new Set(); render() })
    list.addEventListener('mousedown', (e) => e.preventDefault())
    list.addEventListener('click', (e) => {
      const el = e.target.closest('[role="option"]')
      if (!el || e.ctrlKey || e.metaKey || e.shiftKey) return
      e.preventDefault()
      choose(el)
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setActive((active + 1) % options.length) }
      else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setActive((active - 1 + options.length) % options.length) }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(options[active]) }
    })
    // Esc closes from anywhere in the panel. Tab moves between the field and the close button; the focus stays in the panel while it is open.
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
      else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === input ? closeButton : input).focus() }
    })
    window.addEventListener('resize', () => { if (isOpen) place() })
    box.open = open
    return box
  }

  // The back button shows only on a detail page, such as an outlet. It goes to the last page of the site. When the visitor came from outside, it goes to the parent page.
  function BackButton (parent) {
    const inSite = document.referrer && document.referrer.startsWith(location.origin) && history.length > 1
    return h('button', {
      type: 'button', class: 'back-button', 'aria-label': t('shell.back'), title: t('shell.back'),
      onClick: () => { if (inSite) history.back(); else location.href = parent }
    }, Icon('arrow-left', 'icon icon-sm'))
  }

  // Page transitions (app.css). A move to another section slides the page sideways, in the order of the navbar. A move to another sub-tab
  // slides the content up or down, in the order of the sidebar (sideways on a phone, where the sub-tabs are a row). Back and forward move
  // the same way. A link to a detail page, in a card or in the footer changes the page without a slide.
  // The page that is left keeps where it was and which link was clicked. The new page reads it before its first frame.
  const MOVE_KEY = 'm-move' // also read by page-move.js
  const MOVE_LINKS = '.nav-main a, .section-nav a, .section-tabs a, .sub-tabs a'
  // The place of a route in the order: its section and its page in the section. A detail page has none.
  function stepOf (route) {
    const item = route ? itemOf(route) : null
    const page = item ? pagesOf(item).findIndex(([, r]) => r === route) : -1
    return page < 0 ? null : { section: NAV.indexOf(item), page }
  }
  function directionOf (from, to) {
    const a = stepOf(from)
    const b = stepOf(to)
    if (!a || !b || (a.section === b.section && a.page === b.page)) return null
    if (a.section !== b.section) return b.section > a.section ? 'right' : 'left'
    const column = window.matchMedia('(min-width: 1024px)').matches
    if (b.page > a.page) return column ? 'down' : 'right'
    return column ? 'up' : 'left'
  }
  function readMove () {
    try { const move = JSON.parse(sessionStorage.getItem(MOVE_KEY)); return move && Date.now() - move.time < 5000 ? move : null } catch { return null }
  }
  function keepMove (move) {
    try { sessionStorage.setItem(MOVE_KEY, JSON.stringify({ ...move, time: Date.now() })) } catch { /* storage is not available */ }
  }
  function watchMoves (route) {
    let restored = false
    document.addEventListener('click', (e) => {
      const link = e.target.closest?.(MOVE_LINKS)
      if (link && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) keepMove({ from: route, href: link.href, nav: true })
    }, true)
    // The top of the page as the visitor saw it: the new page shows the old picture there, not at its own top.
    const pageTop = () => document.querySelector('.page-main')?.getBoundingClientRect().top ?? 0
    window.addEventListener('pageswap', () => {
      const move = readMove()
      keepMove({ ...(move?.nav ? move : { from: route }), top: pageTop() })
    })
    window.addEventListener('pageshow', (e) => { restored = e.persisted })
    window.addEventListener('pagereveal', (e) => {
      const move = readMove()
      try { sessionStorage.removeItem(MOVE_KEY) } catch { /* storage is not available */ }
      if (!e.viewTransition) return
      const traverse = window.navigation?.activation?.navigationType === 'traverse' || restored ||
        performance.getEntriesByType('navigation')[0]?.type === 'back_forward'
      const counted = move && (traverse || (move.nav && move.href === location.href))
      const direction = counted ? directionOf(move.from, route) : null
      if (!direction) {
        e.viewTransition.ready.catch(() => { /* skipped on purpose */ })
        e.viewTransition.skipTransition()
        return
      }
      const html = document.documentElement
      html.dataset.vt = direction
      html.style.setProperty('--vt-old-y', `${(move.top ?? 0) - pageTop()}px`)
      e.viewTransition.finished.finally(() => { delete html.dataset.vt; html.style.removeProperty('--vt-old-y') })
    })
  }

  // search: false leaves the search out of the top bar. Αρχική has its own, in the page.
  function start ({ id, route, title, breadcrumbs, render, dash = false, search = true }) {
    const root = document.getElementById('app')
    watchMoves(route)
    // The search lists the last pages of the visitor.
    const here = hereHref()
    remember('pages', { h: here, n: title(), r: route }, (p) => p.h === here)

    function mount () {
      document.documentElement.lang = window.App.locale
      document.title = `${title()} · ${t('site.name')}`

      const item = route ? itemOf(route) : null
      // The tab of the page. For a sub-tab it is the tab that holds it.
      const exactTab = item && item.tabs.find(([, r, subs]) => r === route || (subs || []).some(([, s]) => s === route))

      const navLink = ({ key, href, current }) =>
        h('li', {}, h('a', { class: 'nav-link', href, 'aria-current': current ? 'page' : null }, t(`nav.${key}`)))
      // The links are made twice: the top navbar (wide screens) and the drawer (tablet and phone). CSS shows one of them.
      const mainLinks = () => NAV.map((n) => navLink({ key: n.key, href: hrefOf(n.tabs[0][1]), current: n === item }))
      const footerLinks = () => FOOTER.map(([key, r]) => navLink({ key, href: hrefOf(r), current: key === id }))

      const langSwitch = () => h('div', { class: 'lang-switch', role: 'group', 'aria-label': t('shell.lang') },
        [['el', 'ΕΛ'], ['en', 'EN']].map(([value, label]) => h('button', {
          type: 'button', lang: value, 'aria-pressed': String(window.App.locale === value),
          onClick: () => { window.App.setLocale(value); mount(); document.querySelector(`.lang-switch button[lang="${value}"]`).focus() }
        }, label)))

      // Prototype only: the font and the theme. They are in the footer on a wide screen and in the drawer on a phone.
      const fontSwitch = () => h('label', { class: 'font-switch' }, h('span', {}, t('shell.font')),
        h('select', { onChange: (e) => { setFont(e.target.value); document.querySelectorAll('.font-switch select').forEach((s) => { s.value = e.target.value }) } },
          FONTS.map(([key, label]) => h('option', { value: key, selected: document.documentElement.dataset.font === key }, label))))

      let themeCount = 0
      const themeSwitch = () => {
        const labelId = `theme-label-${themeCount++}`
        return h('div', { class: 'theme-switch' }, h('span', { id: labelId }, t('shell.theme')),
          h('div', { class: 'theme-swatches', role: 'group', 'aria-labelledby': labelId },
            THEMES.map((key) => h('button', {
              type: 'button', class: 'theme-swatch', 'data-theme': key, title: t(`theme.${key}`), 'aria-label': t(`theme.${key}`),
              'aria-pressed': String(document.documentElement.dataset.theme === key),
              onClick: () => { setTheme(key); document.querySelectorAll('.theme-swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === key))) }
            }))))
      }

      // Log in and sign up open the drawer from the right. A visitor who is logged in sees the user icon on a wide screen: a menu with the profile and "Αποσύνδεση".
      // The drawer of the menu of a phone shows the name and "Αποσύνδεση".
      let closeUserMenu = null
      const userMenu = (user) => {
        const button = h('button', { type: 'button', class: 'user-button', 'aria-label': `${t('shell.account')}: ${user}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, Icon('user-circle', 'icon'))
        const logout = h('button', { type: 'button', role: 'menuitem', class: 'user-menu-item', onClick: () => { setOpen(false); signOut(); mount() } }, t('shell.logout'))
        const profile = h('a', { role: 'menuitem', class: 'user-menu-item', href: hrefOf('/profile') }, t('shell.profile'))
        const menu = h('div', { class: 'user-menu-list', role: 'menu', 'aria-label': t('shell.account'), hidden: true }, h('p', { class: 'user-menu-name' }, user), profile, logout)
        const away = (e) => { if (!menu.parentElement.contains(e.target)) setOpen(false) }
        function setOpen (open, focusFirst) {
          menu.hidden = !open
          button.setAttribute('aria-expanded', String(open))
          document.removeEventListener('pointerdown', away, true)
          closeUserMenu = null
          if (!open) return
          document.addEventListener('pointerdown', away, true)
          closeUserMenu = () => setOpen(false)
          if (focusFirst) profile.focus()
        }
        button.addEventListener('click', () => setOpen(menu.hidden))
        button.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, true) } })
        menu.addEventListener('keydown', (e) => {
          const items = [profile, logout]
          const i = items.indexOf(document.activeElement)
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.focus() }
          else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus() }
          else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus() }
          else if (e.key === 'Tab') setOpen(false)
        })
        return h('div', { class: 'user-menu' }, button, menu)
      }
      const authLinks = (cls, inDrawer = false) => {
        const user = currentUser()
        const opener = (view) => () => { if (inDrawer) setDrawer(false, false); openAuth(view) }
        if (user && !inDrawer) return h('div', { class: cls }, userMenu(user))
        if (user) {
          return h('div', { class: cls },
            h('span', { class: 'auth-user' }, user),
            h('button', { type: 'button', class: 'button auth-login', onClick: () => { signOut(); mount() } }, t('shell.logout')))
        }
        return h('div', { class: cls },
          h('button', { type: 'button', class: 'button auth-login', onClick: opener('login') }, t('shell.login')),
          h('button', { type: 'button', class: 'button button-primary auth-register', onClick: opener('register') }, t('shell.register')))
      }

      const logoLink = (cls) => h('a', { class: `logo-link ${cls}`, href: 'index.html' }, h('img', { class: 'logo-img', src: 'assets/logo.svg?v=6', alt: t('site.name'), width: 335, height: 141 }))

      // The drawer: the navigation of a tablet or a phone.
      const closeButton = h('button', { type: 'button', class: 'icon-button sidebar-close', 'aria-label': t('shell.close'), onClick: () => setDrawer(false) }, Icon('x-mark'))
      const sidebar = h('nav', { class: 'sidebar', id: 'sidebar', 'aria-label': t('shell.nav') },
        h('div', { class: 'sidebar-logo' }, logoLink(''), closeButton),
        h('ul', { class: 'nav-list nav-main' }, mainLinks()),
        authLinks('auth-links drawer-auth', true),
        h('div', { class: 'nav-footer' },
          h('ul', { class: 'nav-list', 'aria-label': t('section.footer') }, footerLinks()),
          h('div', { class: 'sidebar-tools' }, langSwitch(), themeSwitch(), fontSwitch())))

      const menuButton = h('button', { type: 'button', class: 'icon-button menu-button', 'aria-label': t('shell.menu'), 'aria-controls': 'sidebar', 'aria-expanded': 'false', onClick: () => setDrawer(true) }, Icon('bars-3'))

      // A page can ask for no breadcrumbs: breadcrumbs() returns null.
      const crumbItems = breadcrumbs()
      const crumbs = crumbItems ? [{ label: t('shell.home'), href: 'index.html' }, ...crumbItems] : []
      const crumbList = (id === 'home' ? crumbs.slice(0, 1) : crumbs).map((c, i, all) => h('li', {},
        i > 0 && Icon('chevron-right', 'icon icon-sm'),
        i === all.length - 1 ? h('span', { 'aria-current': 'page' }, c.label) : h('a', { href: c.href }, c.label)))

      // The top bar of every page: the back button and the global search. Below 1024 px it also holds the menu button for the drawer.
      // A detail page is a page of an item that is not one of its tabs. Its parent page is the tab that lists it (NAV details), else the first tab.
      const detail = item && !exactTab
      const parentRoute = detail && ((item.details || []).find(([r]) => under(route, r)) || [])[1]
      const parent = detail ? hrefOf(parentRoute || item.tabs[0][1]) : null
      const header = h('header', { class: 'header-bar' }, h('div', { class: 'header-left' }, menuButton, detail ? BackButton(parent) : null))
      const subBarTrail = headerV2 ? mountV2({ item, header, detail, parent, title }) : null

      // Breadcrumbs show only on a page that is not a tab and not Home. A tab page has the tab bar.
      const crumbBar = !exactTab && id !== 'home' && crumbItems
        ? h('nav', { class: 'breadcrumbs', 'aria-label': t('shell.breadcrumbs') }, h('ol', {}, crumbList))
        : null

      // The tabs show on the page of a tab. A detail page below a tab has none.
      const tabBar = exactTab && item.tabs.length > 1
        ? h('nav', { class: 'section-tabs', 'aria-label': t(`nav.${item.key}`) }, h('ul', {}, item.tabs.map(([key, r]) =>
          h('li', {}, h('a', { href: hrefOf(r), 'aria-current': exactTab[1] === r ? (r === route ? 'page' : 'true') : null }, t(`tab.${item.key}.${key}`))))))
        : null
      // The sub-tabs of the tab: a second row of underlined tabs under the top bar.
      const subBar = exactTab && exactTab[2]
        ? h('nav', { class: 'sub-tabs', 'aria-label': t(`tab.${item.key}.${exactTab[0]}`) }, h('ul', {}, exactTab[2].map(([key, r]) =>
          h('li', {}, h('a', { href: hrefOf(r), 'aria-current': r === route ? 'page' : null }, t(`tab.${item.key}.${key}`))))))
        : null
      // A dash page has its tabs in the center of the top bar. The other pages have them under the top bar.
      // An item with many tabs (more than 6) puts them on a second row of the top bar, so they do not push the page wider.
      if (dash && tabBar && !headerV2) { header.classList.add('has-tabs'); if (item.tabs.length > 6) header.classList.add('many-tabs'); header.append(tabBar) }
      // A wide screen: the logo and the sections on the left, the search, the language and the account on the right.
      header.append(
        logoLink('header-logo'),
        h('nav', { class: 'header-nav', 'aria-label': t('shell.nav') }, h('ul', { class: 'nav-list nav-main' }, mainLinks())),
        ...(search ? [GlobalSearch()] : []),
        h('div', { class: 'header-actions' }, langSwitch(), authLinks('auth-links')))
      // The tabs of the section are a sidebar on a wide screen, under the navbar. A phone keeps them as tabs in the page head.
      // The sub-tabs of the current tab are listed under it in the sidebar; a phone keeps them in the page body. A detail page (an outlet) marks the tab that lists it.
      const activeRoute = exactTab ? route : parentRoute
      const sectionNav = item && item.tabs.length > 1
        ? h('nav', { class: 'section-nav', 'aria-label': t(`nav.${item.key}`) }, h('div', { class: 'section-nav-inner' },
          h('ul', { class: 'section-nav-list' }, item.tabs.map(([key, r, subs]) => {
            const inTab = r === activeRoute || (subs || []).some(([, s]) => s === activeRoute)
            const nested = inTab && subs
            const current = inTab ? (!nested && (route === r || (subs || []).some(([, s]) => s === route)) ? 'page' : 'true') : null
            return h('li', {},
              h('a', { class: `section-nav-link${nested ? ' is-parent' : ''}`, href: hrefOf(r), 'aria-current': current }, t(`tab.${item.key}.${key}`)),
              nested ? h('ul', { class: 'section-nav-sub' }, subs.map(([subKey, s]) =>
                h('li', {}, h('a', { class: 'section-nav-link', href: hrefOf(s), 'aria-current': s === route ? 'page' : null }, t(`tab.${item.key}.${subKey}`))))) : null)
          }))))
        : null
      const content = h('main', { class: 'content', id: 'content' })
      // v2: the tabs and the sub-tabs are one block of the page head. The page puts it under its title.
      const pageTabs = headerV2 && tabBar ? h('div', { class: 'page-tabs' }, tabBar, subBar) : null
      const shell = h('div', { class: 'shell' }, sidebar, h('div', { class: 'drawer-scrim', onClick: () => setDrawer(false) }),
        h('div', { class: 'main-column' }, header, headerV2 || dash ? null : tabBar, headerV2 ? null : subBar, headerV2 ? null : crumbBar,
          h('div', { class: 'page-body' }, sectionNav, h('div', { class: 'page-main' }, subBarTrail, content)),
          h('footer', { class: 'page-footer' }, h('span', { class: 'page-footer-text' }, t('site.footer')),
            h('ul', { class: 'nav-list page-footer-links', 'aria-label': t('section.footer') }, footerLinks()),
            h('div', { class: 'page-footer-tools' }, themeSwitch(), fontSwitch()))))

      // The open drawer keeps the focus: the rest of the page is inert until the drawer closes.
      const mainColumn = shell.querySelector('.main-column')
      function setDrawer (open, moveFocus = true) {
        shell.classList.toggle('drawer-open', open)
        menuButton.setAttribute('aria-expanded', String(open))
        sidebar.inert = smallScreen.matches && !open
        mainColumn.inert = open
        if (!moveFocus) return
        if (open) closeButton.focus()
        else if (smallScreen.matches) menuButton.focus()
      }
      sidebar.inert = smallScreen.matches
      smallScreen.onchange = () => setDrawer(false, false)
      document.onkeydown = (e) => { if (e.key === 'Escape' && shell.classList.contains('drawer-open')) setDrawer(false) }

      root.replaceChildren(shell)
      // A tab bar that scrolls sideways (phones) shows the current tab. v2 puts the bars in the page head, so it runs again after the page renders.
      const centerTabs = () => [tabBar, subBar].forEach((bar) => {
        const nav = bar && bar.querySelector('[aria-current]')
        if (nav && bar.scrollWidth > bar.clientWidth) bar.scrollLeft += nav.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - nav.offsetWidth) / 2
      })
      centerTabs()
      if (headerV2) {
        current = { section: item ? t(`nav.${item.key}`) : title(), tabs: pageTabs }
        // A tab page that draws no page head of its own gets the plain one: the tabs and the page tools. A section with one tab needs none.
        if (item && exactTab && item.tabs.length > 1) {
          const ensureHead = () => { if (!content.querySelector('.page-head')) content.prepend(window.Shell.PageHead({})) }
          new MutationObserver(ensureHead).observe(content, { childList: true })
        }
        // The detail pages of Αναλύσεις (a speech, a person's file) are locked as well.
        if (item?.key === 'world' && !signedIn()) {
          content.classList.add('is-gated')
          content.replaceChildren(window.Shell.PageHead({ tabs: null }), SignInGate())
          centerTabs()
          return
        }
        render(content, { tabs: pageTabs })
        centerTabs()
        return
      }
      render(content, { tabs: dash ? null : tabBar })
    }

    remount = mount
    mount()
  }

  // v2 (prototype). The top bar on a phone: the menu and the back button, the name of the section, the search.
  // A detail page also gets a row under the navbar on a wide screen: the back button and the trail (the section, then the page). It returns that row.
  let current = { section: '', tabs: null }
  function mountV2 ({ item, header, detail, parent, title }) {
    header.classList.add('appbar')
    const left = header.querySelector('.header-left')
    if (item) left.append(h('span', { class: 'appbar-title' }, t(`nav.${item.key}`)))
    if (!detail) return null
    const trail = [{ label: t(`nav.${item.key}`), href: parent }, { label: title() }]
    return h('div', { class: 'trail-bar' }, BackButton(parent), h('nav', { class: 'appbar-trail', 'aria-label': t('shell.breadcrumbs') }, h('ol', {}, trail.map((c, i, all) =>
      h('li', {}, i > 0 && Icon('chevron-right', 'icon icon-sm'), i === all.length - 1 ? h('span', { 'aria-current': 'page' }, c.label) : h('a', { href: c.href }, c.label))))))
  }
  // The "/" key opens the search from anywhere on the page: the one of the top bar, or the one of the page (Αρχική).
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable]')) return
    const search = document.querySelector('.header-bar .global-search') || document.querySelector('.global-search')
    if (!search) return
    e.preventDefault()
    search.open()
  })
  // The page head (v2): the title and the page actions on one row, the tabs and sub-tabs under them, the filters of the tab last.
  // Page actions change the whole page: the period, the set of outlets, a view switch. Filters narrow the content of one tab.
  function PageHead ({ title, meta, actions = [], filters = [], tabs = current.tabs, error }) {
    actions = actions.filter(Boolean)
    filters = filters.filter(Boolean)
    // A page with no tabs, actions or filters (a section with one tab) has no visible head: only the h1 for screen readers.
    if (!tabs && !actions.length && !filters.length && !error) return h('header', { class: 'page-head is-empty' }, h('h1', { class: 'visually-hidden' }, title || current.section))
    return h('header', { class: 'page-head' },
      h('div', { class: 'page-head-row' },
        h('div', { class: 'page-head-titles' }, h('h1', { class: 'page-head-title' }, title || current.section), meta ? h('p', { class: 'page-head-meta' }, meta) : null),
        actions.length ? h('div', { class: 'page-head-actions' }, actions) : null),
      tabs,
      filters.length ? h('div', { class: 'page-filters' }, filters) : null,
      error ? h('p', { class: 'dash-error', role: 'alert' }, error) : null)
  }

  // The tree of the sidebar: each item with its pages (label, link and question), for the table of pages.
  function tree () {
    return NAV.map((item) => ({ key: item.key, label: t(`nav.${item.key}`), pages: pagesOf(item).map((page) => ({
      route: page[1], label: pageLabel(item, page), href: hrefOf(page[1]), question: hasText(`question.${item.key}.${page[0]}`) ? t(`question.${item.key}.${page[0]}`) : null
    })) }))
  }

  window.Shell = { start, routeAnchor, hrefOf, placeOf, tree, PageHead, headerV2, Search: GlobalSearch }
})()
