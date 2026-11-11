// Which cards a story view has and in which of the three columns each one goes (KTD8): the title, the map and under it the other stories of the theme on the left; the groups
// in the middle; on the right its days over time and under it, side by side, the stance with the people and how the story was written. The map region is the free cell on the
// left, under the title.
export type PlegmaStoryCard = 'days' | 'outlets' | 'how' | 'related' | 'stance' | 'people'
// `right.columns` are the columns of the row under the days card; on a narrow screen they stack.
export interface PlegmaStoryColumns { left: PlegmaStoryCard[], middle: PlegmaStoryCard[], right: { top: PlegmaStoryCard[], columns: PlegmaStoryCard[][] } }

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: the days are alone on the right.
export const plegmaStoryColumns = (labelled: boolean): PlegmaStoryColumns =>
  labelled
    ? { left: ['related'], middle: ['outlets'], right: { top: ['days'], columns: [['stance', 'people'], ['how']] } }
    : { left: ['related'], middle: ['outlets'], right: { top: ['days'], columns: [] } }
