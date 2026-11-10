// Squarified layout of media-v2.html: the items in the rectangle, the largest first, as near to squares as it can.
export interface Tile<T> { item: T, x: number, y: number, w: number, h: number }

export const squarify = <T extends { v: number }>(items: T[], x: number, y: number, w: number, h: number): Tile<T>[] => {
  const out: Tile<T>[] = []
  const scale = (w * h) / items.reduce((a, b) => a + b.v, 0)
  let rest = items.slice()
  let [X, Y, W, H] = [x, y, w, h]
  while (rest.length) {
    const side = Math.min(W, H)
    const worst = (r: T[], total: number) => Math.max(...r.map(i => Math.max((side * side * i.v * scale) / (total * total), (total * total) / (side * side * i.v * scale))))
    let row: T[] = []
    let best = Infinity
    for (let k = 1; k <= rest.length; k++) {
      const r = rest.slice(0, k)
      const wv = worst(r, r.reduce((a, b) => a + b.v * scale, 0))
      if (wv > best) break
      best = wv
      row = r
    }
    const total = row.reduce((a, b) => a + b.v * scale, 0)
    const thick = total / side
    let pos = 0
    for (const item of row) {
      const len = (item.v * scale) / thick
      out.push(W >= H ? { item, x: X, y: Y + pos, w: thick, h: len } : { item, x: X + pos, y: Y, w: len, h: thick })
      pos += len
    }
    if (W >= H) { X += thick; W -= thick } else { Y += thick; H -= thick }
    rest = rest.slice(row.length)
  }
  return out
}
