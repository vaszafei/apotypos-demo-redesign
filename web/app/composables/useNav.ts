// The text of a section is t(`nav.${key}`) and of a tab t(`tab.${section.key}.${key}`) (the keys of assets/shell.js NAV); a footer link is t(`nav.${key}`).
export interface NavTab { key: string, to: string, icon: string }
export interface NavSection { key: string, to: string, icon: string, tabs: NavTab[] }

// The sections and tabs of NAV in assets/shell.js, (the routes that are not ported yet link to their static page, see NavLink).
export const NAV: NavSection[] = [
  { key: 'home', to: '/', icon: 'home', tabs: [] },
  { key: 'media', to: '/media', icon: 'tv', tabs: [
    { key: 'overview', to: '/media', icon: 'grid_view' },
    { key: 'ownership', to: '/groups', icon: 'account_balance' },
    { key: 'topics', to: '/trends', icon: 'sell' },
    { key: 'stories', to: '/stories', icon: 'sensors' },
    { key: 'writing', to: '/media/writing', icon: 'edit' },
    { key: 'similarity', to: '/similarity', icon: 'content_copy' }
  ] },
  { key: 'people', to: '/fingerprints', icon: 'person', tabs: [] },
  { key: 'world', to: '/speeches', icon: 'bar_chart', tabs: [] }
]
export const FOOTER_LINKS = [
  { key: 'methodology', to: '/methodology', icon: 'menu_book' },
  { key: 'about', to: '/about', icon: 'info' }
]

// A detail page (the page of a story) is a page of the section of its parent tab, definePageMeta({ detail: '/stories' }); the tab that lists it is marked in the nav
// (the details of NAV in assets/shell.js).
declare module '#app' { interface PageMeta { detail?: string } }

export const useNav = () => {
  const route = useRoute()
  const detail = computed(() => route.meta.detail)
  const path = computed(() => detail.value ?? route.path)
  const section = computed(() => NAV.find(s => s.to === path.value || s.tabs.some(t => t.to === path.value)) ?? NAV[1]!)
  const parent = computed(() => section.value.tabs.find(t => t.to === detail.value))
  return { sections: NAV, section, detail, parent }
}
