// Which cards a story view has and which of them float around the web: the headline cards, in the order of their slots, and the rest, which wait behind chips (KTD8).
export type PlegmaStoryCard = 'days' | 'outlets' | 'how' | 'related' | 'stance' | 'people'

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: three headline cards, one empty slot, no dock.
export const plegmaStoryCards = (labelled: boolean): { headline: PlegmaStoryCard[], dock: PlegmaStoryCard[] } =>
  labelled
    ? { headline: ['days', 'outlets', 'how', 'related'], dock: ['stance', 'people'] }
    : { headline: ['days', 'outlets', 'related'], dock: [] }
