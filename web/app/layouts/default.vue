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

// Αναλύσεις needs a log in: its pages show the page head and the gate, as in the static shell.
const gated = computed(() => section.value.key === 'world' && !session.signedIn)

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
const current = (to: string) => (route.path === to ? 'page' : detail.value === to ? 'true' : undefined)
// The back button of a detail page goes to the last page of the site. A visitor who came from outside goes to the parent page (BackButton in assets/shell.js).
// The router remembers the page before in history.state; a visitor who came from a static page of the site has it in the referrer.
const back = () => {
  const cameFromSite = (history.state as { back?: string | null } | null)?.back || (document.referrer.startsWith(location.origin) && history.length > 1)
  if (cameFromSite) history.back()
  else navigateTo(detail.value ?? '/')
}
</script>

<template>
  <div class="shell" :class="{ 'drawer-open': drawer, 'is-plegma': plegma.active }">
    <ClientOnly><PlegmaStage /></ClientOnly>
    <nav id="sidebar" class="sidebar" :aria-label="t('shell.nav')" :inert="smallScreen && !drawer">
      <div class="sidebar-logo">
        <NavLink class="logo-link" to="/"><img class="logo-img" src="/assets/logo.svg" :alt="t('site.name')" width="335" height="141"></NavLink>
        <button ref="closeButton" type="button" class="icon-button sidebar-close" :aria-label="t('shell.close')" @click="setDrawer(false)"><AppIcon name="x-mark" /></button>
      </div>
      <ul class="nav-list nav-main">
        <li v-for="s in sections" :key="s.key">
          <NavLink class="nav-link" :to="s.to" :aria-current="s.key === section.key ? 'page' : undefined"><AppIcon :name="s.icon" glyph /><span class="nav-label">{{ t(`nav.${s.key}`) }}</span></NavLink>
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
              <NavLink class="nav-link" :to="s.to" :aria-current="s.key === section.key ? 'page' : undefined"><AppIcon :name="s.icon" glyph /><span class="nav-label">{{ t(`nav.${s.key}`) }}</span></NavLink>
            </li>
          </ul>
        </nav>
        <GlobalSearch />
        <div class="header-actions">
          <AuthLinks cls="auth-links" />
          <LangSwitch />
        </div>
      </header>
      <div class="page-body">
        <nav v-if="section.tabs.length && !plegma.active" class="section-nav" :aria-label="t(`nav.${section.key}`)">
          <div class="section-nav-inner">
            <ul class="section-nav-list">
              <li v-for="tab in section.tabs" :key="tab.to">
                <NavLink class="section-nav-link" :to="tab.to" :aria-current="current(tab.to)"><AppIcon :name="tab.icon" glyph /><span class="nav-label">{{ t(`tab.${section.key}.${tab.key}`) }}</span></NavLink>
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
          <main id="content" class="content dash minimal filters-right" :class="{ 'is-gated': gated }">
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
