<script setup lang="ts">
import { useMediaQuery, useEventListener } from '@vueuse/core'
// The shell of assets/shell.js as Vue: the drawer (sidebar), the header bar, the section nav, the page and the footer. Same markup and classes, so the prototype CSS applies as it is.
const { t } = useI18n()
const { sections, section, detail, parent } = useNav()
const detailTitle = useDetailTitle()
const session = useSessionStore()
const route = useRoute()
// The Plegma behind the pages: a page with the `plegma` page meta shows it, and the route says what it is focused on (stores/plegma.ts).
const plegma = usePlegmaStore()
watch(() => route.fullPath, () => plegma.syncRoute(route), { immediate: true })
const drawer = ref(false)
const menuButton = ref<HTMLButtonElement>()
const closeButton = ref<HTMLButtonElement>()
const smallScreen = useMediaQuery('(max-width: 1023px)')
// A story or a theme on the Plegma: the search leaves the top bar and stays at the middle of the top of the body, under the bar (a phone keeps it in the bar).
const bodySearch = computed(() => route.meta.plegma === true && route.meta.hero !== true && route.meta.backdrop !== true && !smallScreen.value)
// A phone or tablet: the open drawer keeps the focus and the rest of the page is inert until it closes (setDrawer of assets/shell.js).
const setDrawer = async (open: boolean, moveFocus = true) => {
  drawer.value = open
  if (!moveFocus) return
  await nextTick()
  if (open) closeButton.value?.focus()
  else if (smallScreen.value) menuButton.value?.focus()
}
watch(() => route.path, () => { drawer.value = false })
watch(smallScreen, () => { drawer.value = false })
useEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && drawer.value) setDrawer(false) })

// Πρόσωπα and Αναλύσεις need a log in: their pages show the page head and the gate, as in the static shell.
const gated = computed(() => (section.value.key === 'world' || section.value.key === 'people') && !session.signedIn)

// A tab bar that scrolls sideways (phones) shows the current tab (centerTabs in assets/shell.js).
const centerTabs = async () => {
  await nextTick()
  const bar = document.querySelector<HTMLElement>('.page-tabs .section-tabs')
  const tab = bar?.querySelector<HTMLElement>('[aria-current]')
  if (bar && tab && bar.scrollWidth > bar.clientWidth) bar.scrollLeft += tab.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - tab.offsetWidth) / 2
}
onMounted(centerTabs)
watch(() => route.path, centerTabs)
// A detail page marks the tab that lists it, not as the page itself ('true', as the static shell does).
const inTab = (tab: { to: string, children?: { to: string }[] }) => route.path === tab.to || detail.value === tab.to || !!tab.children?.some(c => c.to === route.path)
const current = (to: string) => (route.path === to ? 'page' : detail.value === to ? 'true' : undefined)
// A click on a section of the top bar or on a tab of the left column makes it the current one at once, not when the page has loaded (a lazy page takes a few hundred ms): the "/" moves with the click.
const clicked = ref<string | null>(null)
let clickedTimer: ReturnType<typeof setTimeout> | undefined
useEventListener(document, 'click', (e: MouseEvent) => {
  const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('.header-nav a[href], .section-nav a[href]')
  if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.hasAttribute('download')) return
  clicked.value = new URL(link.href).pathname
  clearTimeout(clickedTimer)
  clickedTimer = setTimeout(() => { clicked.value = null }, 4000)
}, { capture: true })
watch(() => route.fullPath, () => { clicked.value = null })
// A story, a theme or an outlet on the Plegma belongs to Μέσα but is not one of its pages: no section of the top bar is the current one there.
const bareNav = computed(() => route.meta.plegma === true && route.meta.hero !== true)
const shownSection = computed(() => {
  const picked = clicked.value && sections.find(s => s.to === clicked.value)
  return picked ? picked.key : bareNav.value ? null : section.value.key
})
const sectionCurrent = (key: string) => (key === shownSection.value ? 'page' : undefined)
// The tab of the left column that has the "/" (a tab with sub-tabs gives it to the sub-tab), and the one that has just lost it.
const slashTo = computed(() => {
  const all = section.value.tabs.flatMap(tab => (tab.children ?? [tab]).map(c => c.to))
  if (clicked.value && all.includes(clicked.value)) return clicked.value
  for (const tab of section.value.tabs) {
    if (tab.children) { const c = tab.children.find(c => c.to === route.path); if (c) return c.to } else if (current(tab.to)) return tab.to
  }
  return null
})
const tabCurrent = (tab: { to: string, children?: unknown[] }) => (tab.children && inTab(tab as { to: string, children: { to: string }[] }) ? 'true' : clicked.value && !tab.children ? (clicked.value === tab.to ? 'page' : undefined) : current(tab.to))
const subCurrent = (to: string) => ((clicked.value && slashTo.value === clicked.value ? clicked.value === to : route.path === to) ? 'page' : undefined)
const leavingSection = useSlashLeave(() => shownSection.value)
const leavingTab = useSlashLeave(() => slashTo.value)
// The back button of a detail page goes to the last page of the site. A visitor who came from outside goes to the parent page (BackButton in assets/shell.js).
// The router remembers the page before in history.state; a visitor who came from a static page of the site has it in the referrer.
const pager = useState<{ to: string | null, pull: number }>('tab-pull', () => ({ to: null, pull: 0 }))
const back = () => {
  const cameFromSite = (history.state as { back?: string | null } | null)?.back || (document.referrer.startsWith(location.origin) && history.length > 1)
  if (cameFromSite) history.back()
  else navigateTo(detail.value ?? '/')
}
</script>

<template>
  <div class="shell" :class="{ 'drawer-open': drawer, 'is-plegma': plegma.active, 'is-backdrop': plegma.backdrop, 'is-hero-page': route.meta.hero === true, 'is-body-search': bodySearch }">
    <ClientOnly><PlegmaStage /></ClientOnly>
    <nav id="sidebar" class="sidebar" :aria-label="t('shell.nav')" :inert="smallScreen && !drawer">
      <div class="sidebar-logo">
        <NavLink class="logo-link" to="/"><img class="logo-img" src="/assets/logo.svg" :alt="t('site.name')" width="335" height="141"></NavLink>
        <button ref="closeButton" type="button" class="icon-button sidebar-close" :aria-label="t('shell.close')" @click="setDrawer(false)"><AppIcon name="x-mark" /></button>
      </div>
      <ul class="nav-list nav-main">
        <li v-for="s in sections" :key="s.key">
          <NavLink class="nav-link" :to="s.to" :aria-current="sectionCurrent(s.key)"><AppIcon :name="s.icon" glyph /><span class="nav-label">{{ t(`nav.${s.key}`) }}</span></NavLink>
        </li>
      </ul>
      <AuthLinks cls="auth-links drawer-auth" in-drawer @opened="setDrawer(false, false)" />
      <div class="nav-footer">
        <ul class="nav-list" :aria-label="t('section.footer')">
          <li v-for="l in FOOTER_LINKS" :key="l.to"><NavLink class="nav-link" :to="l.to"><AppIcon :name="l.icon" glyph /><span class="nav-label">{{ t(`nav.${l.key}`) }}</span></NavLink></li>
        </ul>
        <div class="sidebar-tools"><LangSwitch /><ShellSwitches /></div>
      </div>
    </nav>
    <div class="drawer-scrim" @click="setDrawer(false)" />
    <div class="main-column" :inert="drawer">
      <header class="header-bar appbar">
        <div class="header-left">
          <button ref="menuButton" type="button" class="icon-button menu-button" :aria-label="t('shell.menu')" aria-controls="sidebar" :aria-expanded="tf(drawer)" @click="setDrawer(true)"><AppIcon name="bars-3" /></button>
          <button v-if="detail" type="button" class="back-button" :aria-label="t('shell.back')" :title="t('shell.back')" @click="back"><AppIcon name="arrow-left" class="icon icon-sm" /></button>
          <span class="appbar-title">{{ t(`nav.${section.key}`) }}</span>
        </div>
        <NavLink class="logo-link header-logo" to="/"><img class="logo-img" src="/assets/logo.svg" :alt="t('site.name')" width="335" height="141"></NavLink>
        <nav class="header-nav" :aria-label="t('shell.nav')">
          <ul class="nav-list nav-main">
            <li v-for="s in sections" :key="s.key">
              <NavLink class="nav-link" :class="{ 'is-leaving': leavingSection === s.key }" :to="s.to" :aria-current="sectionCurrent(s.key)"><AppIcon :name="s.icon" glyph /><span class="nav-label">{{ t(`nav.${s.key}`) }}</span></NavLink>
            </li>
          </ul>
        </nav>
        <GlobalSearch v-if="!bodySearch" :disabled="route.meta.hero === true" />
        <div class="header-actions">
          <AuthLinks cls="auth-links" />
          <LangSwitch />
        </div>
      </header>
      <Transition name="search-swap"><div v-if="bodySearch" class="body-search"><GlobalSearch /></div></Transition>
      <div class="page-body">
        <nav v-if="section.tabs.length && (!plegma.active || plegma.backdrop)" class="section-nav" :aria-label="t(`nav.${section.key}`)">
          <div class="section-nav-inner">
            <ul class="section-nav-list">
              <li v-for="tab in section.tabs" :key="tab.to">
                <NavLink class="section-nav-link" :class="{ 'is-pull': pager.to === tab.to, 'is-parent': inTab(tab) && tab.children, 'is-leaving': !tab.children && leavingTab === tab.to }" :style="pager.to === tab.to ? { '--pull': pager.pull } : undefined" :to="tab.to" :aria-current="tabCurrent(tab)"><AppIcon :name="tab.icon" glyph /><span class="nav-label">{{ t(`tab.${section.key}.${tab.key}`) }}</span></NavLink>
                <ul v-if="tab.children && inTab(tab)" class="section-nav-sub">
                  <li v-for="child in tab.children" :key="child.to"><NavLink class="section-nav-link" :class="{ 'is-leaving': leavingTab === child.to }" :to="child.to" :aria-current="subCurrent(child.to)"><AppIcon :name="child.icon" glyph /><span class="nav-label">{{ t(`tab.${section.key}.${child.key}`) }}</span></NavLink></li>
                </ul>
              </li>
            </ul>
          </div>
        </nav>
        <div class="page-main">
          <div v-if="detail && parent" class="trail-bar">
            <button type="button" class="back-button" :aria-label="t('shell.back')" :title="t('shell.back')" @click="back"><AppIcon name="arrow-left" class="icon icon-sm" /></button>
            <nav class="appbar-trail" :aria-label="t('shell.breadcrumbs')">
              <ol>
                <li><NavLink :to="detail">{{ t(`nav.${section.key}`) }}</NavLink></li>
                <li><AppIcon name="chevron-right" class="icon icon-sm" /><span aria-current="page">{{ detailTitle ?? t(`tab.${section.key}.${parent.key}`) }}</span></li>
              </ol>
            </nav>
          </div>
          <main id="content" class="content dash minimal filters-right" :class="{ 'is-gated': gated, 'is-home': route.meta.hero === true }">
            <!-- A detail page has no page head, but the head stays in the DOM: the page that is left for a tab teleports its controls to #page-actions before the layout learns the route changed. -->
            <header v-show="!detail" class="page-head">
              <div class="page-head-row">
                <div class="page-head-titles"><h1 class="page-head-title">{{ t(`nav.${section.key}`) }}</h1></div>
                <div id="page-actions" class="page-head-actions" />
              </div>
              <div v-if="section.tabs.length && !gated" class="page-tabs">
                <nav class="section-tabs" :aria-label="t(`nav.${section.key}`)">
                  <ul><li v-for="tab in section.tabs" :key="tab.to"><NavLink :to="tab.to" :aria-current="current(tab.to)"><AppIcon :name="tab.icon" glyph /><span class="nav-label">{{ t(`tab.${section.key}.${tab.key}`) }}</span></NavLink></li></ul>
                </nav>
              </div>
            </header>
            <SignInGate v-if="gated" />
            <slot v-else />
            <ClientOnly><TabPager v-if="!gated" /></ClientOnly>
          </main>
        </div>
      </div>
      <footer class="page-footer">
        <span class="page-footer-text">{{ t('site.footer') }}</span>
        <ul class="nav-list page-footer-links" :aria-label="t('section.footer')">
          <li v-for="l in FOOTER_LINKS" :key="l.to"><NavLink class="nav-link" :to="l.to"><AppIcon :name="l.icon" glyph /><span class="nav-label">{{ t(`nav.${l.key}`) }}</span></NavLink></li>
        </ul>
        <div class="page-footer-tools"><ShellSwitches /></div>
      </footer>
    </div>
    <ChartTooltip />
    <AuthDrawer />
  </div>
</template>
