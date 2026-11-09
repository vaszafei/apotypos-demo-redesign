import type { Issue } from '~/types/topics'

// The name of a topic in the active language; Greek when the data has no English name (x[App.locale] || x.el).
export const topicName = (issue: Issue) => issue[useNuxtApp().$i18n.locale.value as 'el' | 'en'] || issue.el
