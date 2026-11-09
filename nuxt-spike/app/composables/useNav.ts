export interface NavTab { label: string, to: string }
export interface NavSection { key: string, label: string, to: string, tabs: NavTab[] }

// Same sections and routes as NAV in the prototype (assets/shell.js), only the ones this spike needs.
export const NAV: NavSection[] = [
  { key: 'home', label: 'Αρχική', to: '/', tabs: [] },
  { key: 'media', label: 'Μέσα', to: '/media', tabs: [
    { label: 'Επισκόπηση', to: '/media' },
    { label: 'Ιδιοκτησία', to: '/groups' },
    { label: 'Θέματα', to: '/trends' },
    { label: 'Ιστορίες', to: '/stories' }
  ] },
  { key: 'people', label: 'Πρόσωπα', to: '/fingerprints', tabs: [] },
  { key: 'world', label: 'Αναλύσεις', to: '/speeches', tabs: [] }
]

export const useNav = () => {
  const route = useRoute()
  const section = computed(() => NAV.find(s => s.tabs.some(t => t.to === route.path)) ?? NAV[1]!)
  return { sections: NAV, section }
}
