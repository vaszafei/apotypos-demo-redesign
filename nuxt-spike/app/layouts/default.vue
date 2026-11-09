<script setup lang="ts">
// The shell of assets/shell.js as Vue: the drawer (sidebar), the header bar, the section nav, the page and the footer. Same markup and classes, so the prototype CSS applies as it is.
const { sections, section } = useNav()
const route = useRoute()
const drawer = ref(false)
watch(() => route.path, () => { drawer.value = false })

const themes = [['paper', 'Χαρτί'], ['fog', 'Ομίχλη'], ['terra', 'Κεραμίδι'], ['night', 'Νύχτα'], ['midnight', 'Μεσάνυχτα']] as const
const theme = ref('paper')
const icons = ref('off')
const font = ref('plex')
const fonts = [['plex', 'IBM Plex Sans'], ['manrope', 'Manrope'], ['commissioner', 'Commissioner'], ['inter', 'Inter + Source Serif 4'], ['dejavu', 'DejaVu Sans (λογότυπο)'], ['ubuntu', 'Ubuntu'], ['noto', 'Noto Sans'], ['sourcesans', 'Source Sans 3'], ['geologica', 'Geologica'], ['sofia', 'Sofia Sans'], ['literata', 'Source Sans 3 + Literata']]
const setAttr = (name: string, value: string) => document.documentElement.setAttribute(name, value)
watch(theme, v => setAttr('data-theme', v))
watch(icons, v => setAttr('data-icons', v))
watch(font, v => setAttr('data-font', v))
// A tab bar that scrolls sideways (phones) shows the current tab (centerTabs in assets/shell.js).
const centerTabs = async () => {
  await nextTick()
  const bar = document.querySelector<HTMLElement>('.page-tabs .section-tabs')
  const tab = bar?.querySelector<HTMLElement>('[aria-current]')
  if (bar && tab && bar.scrollWidth > bar.clientWidth) bar.scrollLeft += tab.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - tab.offsetWidth) / 2
}
onMounted(centerTabs)
watch(() => route.path, centerTabs)
const current = (to: string) => (route.path === to ? 'page' : undefined)
</script>

<template>
  <div class="shell" :class="{ 'drawer-open': drawer }">
    <nav id="sidebar" class="sidebar" aria-label="Κύρια πλοήγηση">
      <div class="sidebar-logo">
        <NuxtLink class="logo-link" to="/"><img class="logo-img" src="/assets/logo.svg" alt="Απότυπος" width="335" height="141"></NuxtLink>
        <button type="button" class="icon-button sidebar-close" aria-label="Κλείσιμο μενού" @click="drawer = false"><AppIcon name="x-mark" /></button>
      </div>
      <ul class="nav-list nav-main">
        <li v-for="s in sections" :key="s.key">
          <NuxtLink class="nav-link" :to="s.to" :aria-current="s.key === section.key ? 'page' : undefined"><AppIcon :name="s.icon" glyph /><span class="nav-label">{{ s.label }}</span></NuxtLink>
        </li>
      </ul>
      <div class="auth-links drawer-auth"><button type="button" class="button auth-login">Σύνδεση</button><button type="button" class="button button-primary auth-register">Εγγραφή</button></div>
      <div class="nav-footer">
        <ul class="nav-list" aria-label="Για το έργο">
          <li v-for="l in FOOTER_LINKS" :key="l.to"><NuxtLink class="nav-link" :to="l.to"><AppIcon :name="l.icon" glyph /><span class="nav-label">{{ l.label }}</span></NuxtLink></li>
        </ul>
      </div>
    </nav>
    <div class="drawer-scrim" @click="drawer = false" />
    <div class="main-column">
      <header class="header-bar appbar">
        <div class="header-left">
          <button type="button" class="icon-button menu-button" aria-label="Άνοιγμα μενού" aria-controls="sidebar" :aria-expanded="tf(drawer)" @click="drawer = true"><AppIcon name="bars-3" /></button>
          <span class="appbar-title">{{ section.label }}</span>
        </div>
        <NuxtLink class="logo-link header-logo" to="/"><img class="logo-img" src="/assets/logo.svg" alt="Απότυπος" width="335" height="141"></NuxtLink>
        <nav class="header-nav" aria-label="Κύρια πλοήγηση">
          <ul class="nav-list nav-main">
            <li v-for="s in sections" :key="s.key">
              <NuxtLink class="nav-link" :to="s.to" :aria-current="s.key === section.key ? 'page' : undefined"><AppIcon :name="s.icon" glyph /><span class="nav-label">{{ s.label }}</span></NuxtLink>
            </li>
          </ul>
        </nav>
        <div class="global-search">
          <button type="button" class="search-button" aria-label="Αναζήτηση" title="Αναζήτηση" aria-haspopup="dialog" aria-expanded="false" aria-keyshortcuts="/">
            <AppIcon name="magnifying-glass" class="icon search-button-icon" /><span class="search-button-label" aria-hidden="true">Αναζήτηση</span><kbd class="global-search-key" aria-hidden="true">/</kbd>
          </button>
        </div>
        <div class="header-actions">
          <div class="auth-links"><button type="button" class="button auth-login">Σύνδεση</button><button type="button" class="button button-primary auth-register">Εγγραφή</button></div>
          <div class="lang-switch" role="group" aria-label="Γλώσσα"><button type="button" lang="el" aria-pressed="true">ΕΛ</button><button type="button" lang="en" aria-pressed="false">EN</button></div>
        </div>
      </header>
      <div class="page-body">
        <nav v-if="section.tabs.length" class="section-nav" :aria-label="section.label">
          <div class="section-nav-inner">
            <ul class="section-nav-list">
              <li v-for="t in section.tabs" :key="t.to">
                <NuxtLink class="section-nav-link" :to="t.to" :aria-current="current(t.to)"><AppIcon :name="t.icon" glyph /><span class="nav-label">{{ t.label }}</span></NuxtLink>
              </li>
            </ul>
          </div>
        </nav>
        <div class="page-main">
          <main id="content" class="content dash minimal filters-right">
            <header class="page-head">
              <div class="page-head-row">
                <div class="page-head-titles"><h1 class="page-head-title">{{ section.label }}</h1></div>
                <div id="page-actions" class="page-head-actions" />
              </div>
              <div v-if="section.tabs.length" class="page-tabs">
                <nav class="section-tabs" :aria-label="section.label">
                  <ul><li v-for="t in section.tabs" :key="t.to"><NuxtLink :to="t.to" :aria-current="current(t.to)"><AppIcon :name="t.icon" glyph /><span class="nav-label">{{ t.label }}</span></NuxtLink></li></ul>
                </nav>
              </div>
            </header>
            <slot />
          </main>
        </div>
      </div>
      <footer class="page-footer">
        <span class="page-footer-text">Απότυπος · Παρακολούθηση και ανάλυση των ελληνικών ΜΜΕ</span>
        <ul class="nav-list page-footer-links" aria-label="Για το έργο">
          <li v-for="l in FOOTER_LINKS" :key="l.to"><NuxtLink class="nav-link" :to="l.to"><AppIcon :name="l.icon" glyph /><span class="nav-label">{{ l.label }}</span></NuxtLink></li>
        </ul>
        <div class="page-footer-tools">
          <div class="theme-switch">
            <span id="theme-label-1">Θέμα (πρωτότυπο)</span>
            <div class="theme-swatches" role="group" aria-labelledby="theme-label-1">
              <button v-for="[k, name] in themes" :key="k" type="button" class="theme-swatch" :data-theme="k" :title="name" :aria-label="name" :aria-pressed="tf(theme === k)" @click="theme = k" />
            </div>
          </div>
          <label class="font-switch icon-switch"><span>Εικονίδια (πρωτότυπο)</span>
            <select v-model="icons"><option value="off">Χωρίς εικονίδια</option><option value="all">Εικονίδια παντού</option><option value="sidebar">Μόνο στην πλευρική στήλη</option></select>
          </label>
          <label class="font-switch"><span>Γραμματοσειρά (πρωτότυπο)</span>
            <select v-model="font"><option v-for="[k, name] in fonts" :key="k" :value="k">{{ name }}</option></select>
          </label>
        </div>
      </footer>
    </div>
    <ChartTooltip />
  </div>
</template>
