import { RING_START } from './plegma-ring'

// Leaving a view of the Plegma for another page: the cards and the title fade, and the ring empties the way it filled (from its start, clockwise) while its names and the line round the center
// go. Only then does the route change, so the picture that a dive carries away has no ring in it (plugins/plegma-leave.client.ts, the stage's `ringOut`, PlegmaThemeView.vue).
export const LEAVE_RING_MS = 320
// The wait before the route changes: the ring has gone, with a little over for a frame that comes late.
export const LEAVE_HOLD_MS = 360
export const LEAVE_FADE_MS = 240

// The angle (from the top, clockwise) the ring has been emptied up to, for `t` (0 to 1) of the leave: it starts fast and slows down, as the ring of a day on Home does.
export const ringEmptiedTo = (t: number) => RING_START + (1 - (1 - t) ** 3) * Math.PI * 2
