import type { Story } from '~/types/stories'

// The name of a story in the active language; Greek when the data has no English name (x[App.locale] || x.el).
export const storyName = (s: Story) => s[useNuxtApp().$i18n.locale.value as 'el' | 'en'] || s.el
