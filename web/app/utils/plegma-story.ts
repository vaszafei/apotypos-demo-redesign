// Which cards a story view has and in which of the three columns each one goes (KTD8): the title, the map and under it the other stories of the theme on the left; the cards about how the
// story was taken in the middle; the charts of its days and its groups on the right. The map region is the free cell on the left, under the title.
export type PlegmaStoryCard = 'days' | 'outlets' | 'how' | 'related' | 'stance' | 'people'
// `middle` is two narrow columns of cards (half the width each) on a wide screen; on a narrower one they stack in one.
export interface PlegmaStoryColumns { left: PlegmaStoryCard[], middle: PlegmaStoryCard[][], right: PlegmaStoryCard[] }

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: the middle is empty and the map shows through.
export const plegmaStoryColumns = (labelled: boolean): PlegmaStoryColumns =>
  labelled
    ? { left: ['related'], middle: [['stance', 'people'], ['how']], right: ['days', 'outlets'] }
    : { left: ['related'], middle: [], right: ['days', 'outlets'] }
