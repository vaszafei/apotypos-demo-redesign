// Which cards a story view has and where each one goes (KTD8): the title on top; under it the map, and on its right, side by side, the stance and the other stories of the theme
// (how the story was written is not shown, so the map has the room of the left column); the days over time in a card under that row, and the people the story names beside it.
// A story with no profile has the other stories alone on the right, and under the map its views (PlegmaStoryViews.vue) in place of the days, which are drawn in the Plegma under its web.
export type PlegmaStoryCard = 'days' | 'how' | 'related' | 'stance' | 'people'
// `right` are the columns of the row beside the map; on a narrow screen they stack.
export interface PlegmaStoryColumns { left: PlegmaStoryCard[], right: PlegmaStoryCard[][], under: PlegmaStoryCard[] }

// A story with no profile (every story from 1 October on has no stance, framing or sections) has no stance, how or people card: the map and, on its right, the other stories.
export const plegmaStoryColumns = (labelled: boolean): PlegmaStoryColumns =>
  labelled
    ? { left: [], right: [['stance'], ['related']], under: ['days', 'people'] }
    : { left: [], right: [['related']], under: [] }
