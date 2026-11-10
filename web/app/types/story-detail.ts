// data/storyDetail.js: one row for each story. t: flat triples [outlet index, day index, articles]. f, c: articles by frame and by section. s: [not rated, critical, neutral, supportive].
// k: [articles with a clickbait score, clickbait articles]. p: flat quadruples [person index, critical, neutral, supportive portrayal]. A story after the labelled days has null for f, s, c and k.
export interface DetailOutlet { name: string, slug: string, group: string | null, total: number }
export interface DetailPerson { name: string, role: string, party: string }
export interface DetailRow { id: number, t: number[], f: number[] | null, s: number[] | null, c: number[] | null, k: number[] | null, p: number[] }
export interface StoryDetailData {
  dates: string[]
  outlets: DetailOutlet[]
  frames: string[]
  stances: string[]
  sections: string[]
  portrayals: string[]
  people: DetailPerson[]
  base: { f: number[], s: number[], c: number[], k: number[] }
  stories: DetailRow[]
  volumeFrom: string
}
