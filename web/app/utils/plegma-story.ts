// Which cards a story view has and where each one goes (KTD8): the title on top; under it the other stories of the theme in a column of their own on the left, the map in
// the free cell beside it and on its right, side by side, the stance with the people and how the story was written; the days over time in a card under that row.
export type PlegmaStoryCard = 'days' | 'how' | 'related' | 'stance' | 'people'
// `right` are the columns of the row beside the map; on a narrow screen they stack.
export interface PlegmaStoryColumns { left: PlegmaStoryCard[], right: PlegmaStoryCard[][], under: PlegmaStoryCard[] }

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: the map has the row alone.
export const plegmaStoryColumns = (labelled: boolean): PlegmaStoryColumns =>
  labelled
    ? { left: ['related'], right: [['stance', 'people'], ['how']], under: ['days'] }
    : { left: ['related'], right: [], under: ['days'] }
