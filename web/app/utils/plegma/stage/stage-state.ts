import type { PlegmaCamera, PlegmaFlight, PlegmaPoint } from '../plegma-camera'
import type { PlegmaHighlight } from '../plegma-articles'
import type { PlegmaStory, PlegmaWorld } from '../plegma-world'
import { createWebZoom } from '../plegma-zoom'
import type { WebZoom } from '../plegma-zoom'

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
  // The colors of a tooltip (the cards of the copies on Κλαδιά are drawn as the app's tooltip).
  raised: string
  border: string
  strong: string
  shade: string
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
  // The leave of the view (plegma.leaving): when it began (-1: none) and how far it has come (0 to 1); the ring empties and its names go as it comes.
  leaveAt: number
  ringOut: number
  // The story in view keeps a clear space around its web: its place and the radius (in the world) the other stories are pushed out of.
  push: { s: PlegmaStory, r: number } | null
  hoverArticle: number
  // The step of the band of the days (Κλαδιά) under the pointer, -1 for none.
  hoverBand: number
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
  diveSpot: Map<number, PlegmaPoint & { r: number }>
  // The dot of the story picked on a theme (or on the web of a day: `plegma.diveFrom`), on its way to the center of the page's web: where it started (px), its radius, its fill (null: a ring of gray), the
  // page it goes to (`s<story>` or `t<theme>`) and when it began (the clock of the frames); null when there is none.
  dive: { x: number, y: number, r: number, t0: number, key: string, fill: string | null } | null
  // The web of the story the camera leaves on a story → story flight along an arc: a picture of the frame it was in and the camera of that frame; it stays in the world, shrinks and fades as the camera goes.
  ghost: { img: HTMLCanvasElement, cam: PlegmaCamera } | null
  // The lines from the story in view to other stories, as they were last drawn at rest (in the world: where each leaves the web and the point it bends toward), so a move to one of those stories follows its line.
  links: { from: number, to: Map<number, { s: PlegmaPoint, c: PlegmaPoint }> } | null
  // The line the camera travels along from a story to another: it stays lit while the camera goes and fades as the web of the other story grows.
  travel: { s: PlegmaPoint, c: PlegmaPoint, e: PlegmaPoint, colour: string } | null
  heroCleared: boolean
  heroRev: Map<number, number>
  lantern: HeroSpot
  // The zoom of the story web of Κλαδιά (utils/plegma/plegma-zoom.ts), and when it last stepped.
  zoom: WebZoom
  zoomAt: number
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
  raised: '#fff',
  border: '#e4e1d9',
  strong: '#111',
  shade: '#000',
  cats: [],
  groupInk: [],
  stanceInk: [],
  softInk: [],
  fontText: 'system-ui, sans-serif',
  introP: 1,
  nodeIn: 1,
  lineIn: 1,
  ringIn: 1,
  leaveAt: -1,
  ringOut: 0,
  push: null,
  hoverArticle: -1,
  hoverBand: -1,
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
  dive: null,
  ghost: null,
  links: null,
  travel: null,
  heroCleared: false,
  heroRev: new Map(),
  lantern: { x: -9999, y: -9999, v: 0, on: false },
  zoom: createWebZoom(),
  zoomAt: 0
})
