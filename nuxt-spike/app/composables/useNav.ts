export interface NavTab { label: string, to: string, icon: string }
export interface NavSection { key: string, label: string, to: string, icon: string, tabs: NavTab[] }

// The sections and tabs of NAV in assets/shell.js, with the routes of this spike (only /trends and /groups are pages here).
export const NAV: NavSection[] = [
  { key: 'home', label: 'Αρχική', to: '/', icon: 'home', tabs: [] },
  { key: 'media', label: 'Μέσα', to: '/media', icon: 'tv', tabs: [
    { label: 'Επισκόπηση', to: '/media', icon: 'grid_view' },
    { label: 'Ιδιοκτησία', to: '/groups', icon: 'account_balance' },
    { label: 'Θέματα', to: '/trends', icon: 'sell' },
    { label: 'Ιστορίες', to: '/stories', icon: 'sensors' },
    { label: 'Στάση', to: '/media/writing', icon: 'edit' },
    { label: 'Ομοιότητα και πρωτοτυπία', to: '/similarity', icon: 'content_copy' }
  ] },
  { key: 'people', label: 'Πρόσωπα', to: '/fingerprints', icon: 'person', tabs: [] },
  { key: 'world', label: 'Αναλύσεις', to: '/speeches', icon: 'bar_chart', tabs: [] }
]
export const FOOTER_LINKS = [
  { label: 'Μεθοδολογία', to: '/methodology', icon: 'menu_book' },
  { label: 'Σχετικά', to: '/about', icon: 'info' }
]

export const useNav = () => {
  const route = useRoute()
  const section = computed(() => NAV.find(s => s.tabs.some(t => t.to === route.path)) ?? NAV[1]!)
  return { sections: NAV, section }
}
