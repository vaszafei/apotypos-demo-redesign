import type { PlegmaCamera, PlegmaFlight, PlegmaPoint } from '../plegma-camera'
import type { PlegmaHighlight } from '../plegma-articles'
import type { PlegmaStory, PlegmaWorld } from '../plegma-world'

// What the parts of PlegmaStage share: the canvases and their size, the camera, the colors, and the state of the pointer and of the intro. One object, made once by the stage;
// what only one part uses stays inside that part.
export interface HeroSpot { x: number, y: number, v: number, on: boolean }
export interface StageState {
  world: PlegmaWorld | null
  byX: PlegmaStory[]
  ctx: CanvasRenderingContext2D | null
  ctxFocus: CanvasRenderingContext2D | null
  width: number
  height: number
  dpr: number
  cam: PlegmaCamera
  flight: PlegmaFlight | null
  hover: PlegmaStory | null
  webs: PlegmaStory[]
  // The best webs of the latest week, which Home frames under the hero. Under the hero, with a day picked (plegma.homeDay), the map is a dim background of dots for the web of the day.
  weekWebs: PlegmaStory[]
  ink: string
  // The color of a story with no theme and of a node with no group: a soft gray, not the ink, so the map is not black.
  mute: string
  // The color of the page: the rim of a node.
  paper: string
  cats: string[]
  groupInk: string[]
  stanceInk: string[]
  // The colors of the nodes at rest: the group colors mixed with the gray of no group, so the web is a family of colors, not confetti. A group that is
  // pointed at gets its full color.
  softInk: string[]
  fontText: string
  // How far the intro of the web in view has come (0 to 1) and, from it, how far its nodes, lines and ring have come in.
  introP: number
  nodeIn: number
  lineIn: number
  ringIn: number
  // The story in view keeps a clear space around its web: its place and the radius (in the world) the other stories are pushed out of.
  push: { s: PlegmaStory, r: number } | null
  hoverArticle: number
  // The arc of the ring under the pointer ('g3' the fourth group, 's1' the neutral arc of the stance) and, for each arc, how far it has come forward (0 to 1): it grows and brightens as it eases.
  hoverRing: string
  // Set while the pointer is on an arc of the ring of a story and that arc has lit its nodes (the highlight of the cards is not touched).
  ringLit: boolean
  ringHot: Map<string, number>
  // What the cards point at (stores/plegma.ts): the articles of a group or an outlet come forward. It eases in and out, so the map answers the pointer instead of jumping; with reduced motion it jumps.
  hlMix: number
  hlLast: PlegmaHighlight | null
  // The ring of the story web turns from the arcs of the groups to the arcs of the stance and back: 0 is the groups, 1 the stance.
  ringMix: number
  hoverNode: number
  // The step the camera takes toward a click in the hero.
  walk: PlegmaCamera | null
  // The theme web was in the last frame, and where its story nodes were: the place a picked story is dived into from.
  wasTheme: boolean
  diveSpot: Map<number, PlegmaPoint>
  heroCleared: boolean
  heroRev: Map<number, number>
  lantern: HeroSpot
}

export const createStageState = (): StageState => ({
  world: null,
  byX: [],
  ctx: null,
  ctxFocus: null,
  width: 0,
  height: 0,
  dpr: 1,
  cam: { x: 0, y: 0, z: 0.5 },
  flight: null,
  hover: null,
  webs: [],
  weekWebs: [],
  ink: '#111',
  mute: '#6b6f78',
  paper: '#f6f4ef',
  cats: [],
  groupInk: [],
  stanceInk: [],
  softInk: [],
  fontText: 'system-ui, sans-serif',
  introP: 1,
  nodeIn: 1,
  lineIn: 1,
  ringIn: 1,
  push: null,
  hoverArticle: -1,
  hoverRing: '',
  ringLit: false,
  ringHot: new Map(),
  hlMix: 0,
  hlLast: null,
  ringMix: 0,
  hoverNode: -1,
  walk: null,
  wasTheme: false,
  diveSpot: new Map(),
  heroCleared: false,
  heroRev: new Map(),
  lantern: { x: -9999, y: -9999, v: 0, on: false }
})
