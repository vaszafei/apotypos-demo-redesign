// Which cards a story view has and in which of the three columns each one goes (KTD8): the title, the map and the related stories on the left; the cards about how the
// story was taken in the middle; the charts of its days and its groups on the right. The map region is the free cell on the left, under the title.
export type PlegmaStoryCard = 'days' | 'outlets' | 'how' | 'related' | 'stance' | 'people'
export interface PlegmaStoryColumns { left: PlegmaStoryCard[], middle: PlegmaStoryCard[], right: PlegmaStoryCard[] }

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: the related stories take the middle column and the left one is the title and the map.
export const plegmaStoryColumns = (labelled: boolean): PlegmaStoryColumns =>
  labelled
    ? { left: ['related'], middle: ['stance', 'how', 'people'], right: ['days', 'outlets'] }
    : { left: [], middle: ['related'], right: ['days', 'outlets'] }
