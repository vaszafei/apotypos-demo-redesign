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

export const useNav = () => {
  const route = useRoute()
  const section = computed(() => NAV.find(s => s.to === route.path || s.tabs.some(t => t.to === route.path)) ?? NAV[1]!)
  return { sections: NAV, section }
}
