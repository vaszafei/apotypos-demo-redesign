// AppShell, SidebarNav, HeaderBar and PageFooter. Source: knowledge_base/redesign/shell-spec.md.
(function () {
  const { t, h, Icon } = window.App

  // The pages with a prototype. Each other sidebar item opens its row in the table of pages.
  const PROTOTYPES = {
    '/': 'index.html',
    '/trends': 'topics-v2.html',
    '/overton': 'overton-v2.html',
    '/stories': 'stories-v2.html',
    '/echoes': 'stories-v2.html',
    '/similarity': 'similarity-v2.html',
    '/originality': 'similarity-v2.html#originality',
    '/campaigns': 'campaigns-v2.html',
    '/media': 'media-v2.html',
    '/fingerprints': 'fingerprints-v2.html',
    '/groups': 'groups-v2.html',
    '/analyze': 'groups-v2.html',
    '/elections': 'elections-v2.html',
    '/speeches': 'speeches-v2.html',
    '/contradictions': 'persons-v2.html',
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
  // Ιστορίες has Υποθέσεις (/cases) and Μοτίβα διάδοσης (/campaigns), both from Πολιτική, so Πολιτική has only Εκλογές.
  const NAV = [
    { key: 'home', tabs: [['home', '/']] },
    { key: 'media', tabs: [['overview', '/media'], ['topics', '/trends'], ['shifts', '/overton'], ['ownership', '/groups'], ['similarity', '/similarity']], details: ['/outlet', '/group', '/topic'] },
    { key: 'spread', tabs: [['overview', '/stories'], ['cases', '/cases'], ['campaigns', '/campaigns']], details: ['/story'] },
    { key: 'people', tabs: [['overview', '/fingerprints'], ['statements', '/track'], ['file', '/contradictions']] },
    { key: 'politics', tabs: [['elections', '/elections']] },
    { key: 'world', tabs: [['speeches', '/speeches', [['speeches.all', '/speeches'], ['speeches.pi', '/un-israel-palestine']]],
      ['pi', '/narrative', [['pi.overview', '/narrative'], ['gaza', '/gaza'], ['israel', '/israel'], ['language', '/gaza-language']]],
      ['greekturkish', '/war'], ['coverage', '/coverage'], ['france', '/france-riots']] }
  ]
  const FOOTER = [['methodology', '/methodology'], ['about', '/about'], ['pages', null]]

  const under = (route, base) => route === base || (base !== '/' && route.startsWith(base + '/'))
  // The pages of an item: each tab, or the sub-tabs of a tab with sub-tabs. Each page is [key, route, parent tab].
  const pagesOf = (item) => item.tabs.flatMap((tab) => (tab[2] ? tab[2].map(([key, r]) => [key, r, tab]) : [[tab[0], tab[1], null]]))
  function itemOf (route) {
    return NAV.find((item) => pagesOf(item).some(([, r]) => under(route, r)) || (item.details || []).some((r) => under(route, r)))
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

  // Prototype only: the font candidates for the decision of the project lead. ?font= or the last choice sets the font.
  const FONTS = [['plex', 'IBM Plex Sans'], ['manrope', 'Manrope'], ['commissioner', 'Commissioner'], ['inter', 'Inter + Source Serif 4'], ['dejavu', 'DejaVu Sans (λογότυπο)'], ['ubuntu', 'Ubuntu']]
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

  // The global search finds pages, groups, outlets and stories in the snapshot. A data file that the page does not load opens on the first search.
  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ς/g, 'σ')
  // Most outlet and group names are in Latin letters, so a Greek query also matches in Latin letters ("πολιτ" finds "Politis").
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
  function pageEntries () {
    return [...NAV.flatMap((item) => pagesOf(item).map((page) => ({ label: pageLabel(item, page), href: hrefOf(page[1]) }))),
      ...FOOTER.filter(([, r]) => r).map(([key, r]) => ({ label: t(`nav.${key}`), href: hrefOf(r) }))]
  }
  function entityEntries (groups, stories) {
    const name = (x) => x[window.App.locale] || x.el
    const out = { groups: [], outlets: [], topics: [], stories: [] }
    if (groups) {
      groups.groups.forEach((g) => {
        out.groups.push({ label: g.name, sub: g.owner, href: `group-v2.html?g=${encodeURIComponent(g.slug)}` })
        g.outlets.forEach((o) => out.outlets.push({ label: o.name, sub: g.name, href: `outlet-v2.html?slug=${o.slug}` }))
      })
      ;(groups.ungrouped || []).forEach((o) => out.outlets.push({ label: o.name, sub: t('story.nogroup'), href: `outlet-v2.html?slug=${o.slug}` }))
    }
    if (stories) {
      stories.issues.forEach((x, i) => out.topics.push({ label: name(x), href: `topic-v2.html?i=${i}` }))
      stories.stories.filter((s) => !s.generic).sort((a, b) => b.outlets - a.outlets)
        .forEach((s) => out.stories.push({ label: name(s), sub: name(stories.issues[s.issue]), href: `story-v2.html?id=${s.id}` }))
    }
    return out
  }
  const LIMITS = { pages: 4, groups: 4, outlets: 6, topics: 4, stories: 6 }
  function match (entries, query, limit) {
    const words = fold(query).split(/\s+/).filter(Boolean)
    const latinWords = words.map(latin)
    const hits = []
    for (const e of entries) {
      const key = e.key || (e.key = fold(e.label))
      const found = [words, latinWords].find((list) => list.every((w) => key.includes(w)))
      if (!found) continue
      hits.push({ e, rank: key.startsWith(found[0]) ? 0 : 1 })
      if (hits.length >= limit * 8) break
    }
    return hits.sort((a, b) => a.rank - b.rank).slice(0, limit).map((x) => x.e)
  }

  function GlobalSearch () {
    const pages = pageEntries()
    let entities = null
    let loading = null
    let options = []
    let active = -1
    const listId = 'global-search-list'
    const input = h('input', {
      type: 'search', class: 'global-search-input', placeholder: t('shell.search.placeholder'), 'aria-label': t('shell.search'),
      role: 'combobox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false'
    })
    const list = h('div', { class: 'global-search-list', id: listId, role: 'listbox', hidden: true })
    const box = h('div', { class: 'global-search', role: 'search' }, Icon('magnifying-glass', 'icon global-search-icon'), input,
      headerV2 ? h('kbd', { class: 'global-search-key', 'aria-hidden': 'true' }, '/') : null, list)

    function ensure () {
      if (!loading) loading = Promise.all([loadFixture('groups'), loadFixture('stories')]).then(([g, s]) => { entities = entityEntries(g, s); render() })
    }
    function setActive (i) {
      active = i
      options.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)))
      input.setAttribute('aria-activedescendant', i >= 0 ? options[i].id : '')
      if (i >= 0) options[i].scrollIntoView({ block: 'nearest' })
    }
    function close () { list.hidden = true; input.setAttribute('aria-expanded', 'false'); setActive(-1) }
    function render () {
      const query = input.value.trim()
      if (!query) { close(); return }
      const sections = [['pages', match(pages, query, LIMITS.pages)]]
      if (entities) ['groups', 'outlets', 'topics', 'stories'].forEach((k) => sections.push([k, match(entities[k], query, LIMITS[k])]))
      let n = 0
      const blocks = sections.filter(([, hits]) => hits.length).map(([k, hits]) => h('div', { class: 'global-search-group', role: 'group', 'aria-label': t(`shell.search.${k}`) },
        h('div', { class: 'global-search-kind', 'aria-hidden': 'true' }, t(`shell.search.${k}`)),
        hits.map((e) => h('a', { class: 'global-search-option', id: `gs-${n++}`, role: 'option', href: e.href, 'aria-selected': 'false' },
          h('span', { class: 'global-search-label' }, e.label), e.sub ? h('span', { class: 'global-search-sub' }, e.sub) : null))))
      const note = !entities ? h('p', { class: 'global-search-note' }, t('shell.search.loading'))
        : blocks.length ? null : h('p', { class: 'global-search-note' }, t('shell.search.none', { q: query }))
      list.replaceChildren(...blocks, ...(note ? [note] : []))
      options = [...list.querySelectorAll('[role="option"]')]
      list.hidden = false
      input.setAttribute('aria-expanded', 'true')
      setActive(options.length ? 0 : -1)
    }
    input.addEventListener('focus', ensure)
    input.addEventListener('input', () => { ensure(); render() })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setActive((active + 1) % options.length) }
      else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setActive((active - 1 + options.length) % options.length) }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); location.href = options[active].href }
      else if (e.key === 'Escape') { if (!list.hidden) { e.stopPropagation(); close() } else input.value = '' }
    })
    box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) close() })
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

  function start ({ id, route, title, breadcrumbs, render, dash = false }) {
    const root = document.getElementById('app')

    function mount () {
      document.documentElement.lang = window.App.locale
      document.title = `${title()} · ${t('site.name')}`

      const item = route ? itemOf(route) : null
      // The tab of the page. For a sub-tab it is the tab that holds it.
      const exactTab = item && item.tabs.find(([, r, subs]) => r === route || (subs || []).some(([, s]) => s === route))

      const navLink = ({ key, href, current }) =>
        h('li', {}, h('a', { class: 'nav-link', href, 'aria-current': current ? 'page' : null }, t(`nav.${key}`)))
      const mainLinks = NAV.map((n) => navLink({ key: n.key, href: hrefOf(n.tabs[0][1]), current: n === item }))
      const footerLinks = FOOTER.map(([key, r]) => navLink({ key, href: r ? hrefOf(r) : 'pages.html', current: key === id }))

      const langSwitch = h('div', { class: 'lang-switch', role: 'group', 'aria-label': t('shell.lang') },
        [['el', 'ΕΛ'], ['en', 'EN']].map(([value, label]) => h('button', {
          type: 'button', lang: value, 'aria-pressed': String(window.App.locale === value),
          onClick: () => { window.App.setLocale(value); mount(); document.querySelector(`.lang-switch button[lang="${value}"]`).focus() }
        }, label)))

      const fontSwitch = h('label', { class: 'font-switch' }, h('span', {}, t('shell.font')),
        h('select', { id: 'font-switch', onChange: (e) => setFont(e.target.value) },
          FONTS.map(([key, label]) => h('option', { value: key, selected: document.documentElement.dataset.font === key }, label))))

      const closeButton = h('button', { type: 'button', class: 'icon-button sidebar-close', 'aria-label': t('shell.close'), onClick: () => setDrawer(false) }, Icon('x-mark'))
      const sidebar = h('nav', { class: 'sidebar', id: 'sidebar', 'aria-label': t('shell.nav') },
        h('div', { class: 'sidebar-logo' }, h('a', { class: 'logo-link', href: 'index.html' }, h('img', { class: 'logo-img', src: 'assets/logo.svg?v=5', alt: t('site.name'), width: 335, height: 100 })), closeButton),
        h('ul', { class: 'nav-list nav-main' }, mainLinks),
        h('div', { class: 'nav-footer' },
          h('ul', { class: 'nav-list', 'aria-label': t('section.footer') }, footerLinks),
          h('div', { class: 'sidebar-tools' }, langSwitch),
          fontSwitch))

      const menuButton = h('button', { type: 'button', class: 'icon-button menu-button', 'aria-label': t('shell.menu'), 'aria-controls': 'sidebar', 'aria-expanded': 'false', onClick: () => setDrawer(true) }, Icon('bars-3'))

      // A page can ask for no breadcrumbs: breadcrumbs() returns null.
      const crumbItems = breadcrumbs()
      const crumbs = crumbItems ? [{ label: t('shell.home'), href: 'index.html' }, ...crumbItems] : []
      const crumbList = (id === 'home' ? crumbs.slice(0, 1) : crumbs).map((c, i, all) => h('li', {},
        i > 0 && Icon('chevron-right', 'icon icon-sm'),
        i === all.length - 1 ? h('span', { 'aria-current': 'page' }, c.label) : h('a', { href: c.href }, c.label)))

      // The top bar of every page: the back button and the global search. Below 1024 px it also holds the menu button for the drawer.
      // A detail page is a page of an item that is not one of its tabs. Its parent page is the tab that lists it: Ownership for a group, the first tab for the rest.
      const detail = item && !exactTab
      const parent = detail ? hrefOf(under(route, '/group') ? '/groups' : item.tabs[0][1]) : null
      const header = h('header', { class: 'header-bar' }, h('div', { class: 'header-left' }, menuButton, detail ? BackButton(parent) : null))
      if (headerV2) mountV2({ item, header, detail, parent, title })

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
      header.append(GlobalSearch())
      if (headerV2) header.append(SearchToggle(header))
      const content = h('main', { class: 'content', id: 'content' })
      // v2: the tabs and the sub-tabs are one block of the page head. The page puts it under its title.
      const pageTabs = headerV2 && tabBar ? h('div', { class: 'page-tabs' }, tabBar, subBar) : null
      const shell = h('div', { class: 'shell' }, sidebar, h('div', { class: 'drawer-scrim', onClick: () => setDrawer(false) }),
        h('div', { class: 'main-column' }, header, headerV2 || dash ? null : tabBar, headerV2 ? null : subBar, headerV2 ? null : crumbBar, content, h('footer', { class: 'page-footer' }, t('site.footer'))))

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
      // A tab bar that scrolls sideways (phones) shows the current tab.
      ;[tabBar, subBar].forEach((bar) => {
        const nav = bar && bar.querySelector('[aria-current]')
        if (nav && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = nav.offsetLeft - (bar.clientWidth - nav.offsetWidth) / 2
      })
      if (headerV2) {
        current = { section: item ? t(`nav.${item.key}`) : title(), tabs: pageTabs }
        // A tab page that draws no page head of its own gets the plain one: the tabs and the page tools. A section with one tab needs none.
        if (item && exactTab && item.tabs.length > 1) {
          const ensureHead = () => { if (!content.querySelector('.page-head')) content.prepend(window.Shell.PageHead({})) }
          new MutationObserver(ensureHead).observe(content, { childList: true })
        }
        render(content, { tabs: pageTabs })
        return
      }
      render(content, { tabs: dash ? null : tabBar })
    }

    mount()
  }

  // v2 (prototype). The top bar: the menu and the back button, the name of the section (phone) or the trail of a detail page (desktop), the search.
  let current = { section: '', tabs: null }
  function mountV2 ({ item, header, detail, parent, title }) {
    header.classList.add('appbar')
    const left = header.querySelector('.header-left')
    if (item) left.append(h('span', { class: 'appbar-title' }, t(`nav.${item.key}`)))
    // A detail page shows where it is: the section, then the page. The section links to the parent page.
    if (detail) {
      const trail = [{ label: t(`nav.${item.key}`), href: parent }, { label: title() }]
      left.append(h('nav', { class: 'appbar-trail', 'aria-label': t('shell.breadcrumbs') }, h('ol', {}, trail.map((c, i, all) =>
        h('li', {}, i > 0 && Icon('chevron-right', 'icon icon-sm'), i === all.length - 1 ? h('span', { 'aria-current': 'page' }, c.label) : h('a', { href: c.href }, c.label))))))
    }
  }
  // On a phone the search is an icon button. It opens the field over the top bar.
  function SearchToggle (header) {
    const button = h('button', { type: 'button', class: 'icon-button search-toggle', 'aria-label': t('shell.search'), 'aria-expanded': 'false' }, Icon('magnifying-glass'))
    const set = (open) => { header.classList.toggle('search-open', open); button.setAttribute('aria-expanded', String(open)); if (open) header.querySelector('.global-search-input').focus() }
    button.addEventListener('click', () => set(true))
    header.addEventListener('focusout', (e) => { if (!header.contains(e.relatedTarget) && !header.querySelector('.global-search-input').value) set(false) })
    return button
  }
  // The "/" key opens the search from anywhere on the page.
  if (headerV2) {
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.target.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      const header = document.querySelector('.header-bar')
      header.querySelector('.search-toggle')?.offsetParent ? header.querySelector('.search-toggle').click() : header.querySelector('.global-search-input').focus()
    })
  }
  // The page head (v2): the title and the page actions on one row, the tabs and sub-tabs under them, the filters of the tab last.
  // Page actions change the whole page: the period, the set of outlets, a view switch. Filters narrow the content of one tab.
  // The tools of every page, after its actions: how it is measured, copy the link, download the data (prototype: the download is not built).
  function PageTools () {
    const tool = (icon, label, onClick) => h('button', { type: 'button', class: 'page-tool', 'aria-label': label, title: label, onClick }, Icon(icon, 'icon'))
    return h('div', { class: 'page-tools', role: 'group', 'aria-label': t('shell.tools') },
      tool('information-circle', t('shell.tool.method'), () => { location.href = 'methodology.html' }),
      tool('link', t('shell.tool.link'), () => navigator.clipboard?.writeText(location.href)),
      tool('arrow-down-tray', t('shell.tool.download'), null))
  }
  function PageHead ({ title, meta, actions = [], filters = [], tabs = current.tabs, error }) {
    actions = actions.filter(Boolean)
    filters = filters.filter(Boolean)
    // A page with no tabs, actions or filters (a section with one tab) has no visible head: only the h1 for screen readers.
    if (!tabs && !actions.length && !filters.length && !error) return h('header', { class: 'page-head is-empty' }, h('h1', { class: 'visually-hidden' }, title || current.section))
    actions.push(PageTools())
    return h('header', { class: 'page-head' },
      h('div', { class: 'page-head-row' },
        h('div', { class: 'page-head-titles' }, h('h1', { class: 'page-head-title' }, title || current.section), meta ? h('p', { class: 'page-head-meta' }, meta) : null),
        actions.length ? h('div', { class: 'page-head-actions' }, actions) : null),
      tabs,
      filters.length ? h('div', { class: 'page-filters' }, filters) : null,
      error ? h('p', { class: 'dash-error', role: 'alert' }, error) : null)
  }

  window.Shell = { start, routeAnchor, hrefOf, itemOf, placeOf, PageHead, headerV2 }
})()
