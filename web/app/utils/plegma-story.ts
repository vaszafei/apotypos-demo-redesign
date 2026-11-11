// Which cards a story view has and in which of the three columns each one goes (KTD8): the title, the map and under it the other stories of the theme on the left; the groups and
// how the story was written in the middle; its days over time, its stance and its people on the right. The map region is the free cell on the left, under the title.
export type PlegmaStoryCard = 'days' | 'outlets' | 'how' | 'related' | 'stance' | 'people'
// `middle` is two narrow columns of cards (half the width each) on a wide screen; on a narrower one they stack in one.
export interface PlegmaStoryColumns { left: PlegmaStoryCard[], middle: PlegmaStoryCard[][], right: PlegmaStoryCard[] }

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: the groups are in the middle and the days on the right.
export const plegmaStoryColumns = (labelled: boolean): PlegmaStoryColumns =>
  labelled
    ? { left: ['related'], middle: [['outlets'], ['how']], right: ['days', 'stance', 'people'] }
    : { left: ['related'], middle: [['outlets']], right: ['days'] }
