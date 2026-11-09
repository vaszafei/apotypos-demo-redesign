// A smooth line through the points: a monotone cubic curve (UI.smoothPath in assets/components.js, same arithmetic).
export const smoothPath = (pts: [number, number][]): string => {
  const f = (v: number) => v.toFixed(1)
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${f(pts[0]![0])} ${f(pts[0]![1])}`
  const dx = pts.slice(1).map((q, i) => q[0] - pts[i]![0])
  const m = pts.slice(1).map((q, i) => (q[1] - pts[i]![1]) / dx[i]!)
  const tan = pts.map((_, i) => (i === 0 ? m[0]! : i === n - 1 ? m[n - 2]! : m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2))
  m.forEach((slope, i) => {
    if (slope === 0) { tan[i] = 0; tan[i + 1] = 0; return }
    const a = tan[i]! / slope
    const b = tan[i + 1]! / slope
    const k = a * a + b * b
    if (k > 9) { const tau = 3 / Math.sqrt(k); tan[i] = tau * a * slope; tan[i + 1] = tau * b * slope }
  })
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`
  for (let i = 0; i < n - 1; i++) {
    d += `C${f(pts[i]![0] + dx[i]! / 3)} ${f(pts[i]![1] + (tan[i]! * dx[i]!) / 3)} ${f(pts[i + 1]![0] - dx[i]! / 3)} ${f(pts[i + 1]![1] - (tan[i + 1]! * dx[i]!) / 3)} ${f(pts[i + 1]![0])} ${f(pts[i + 1]![1])}`
  }
  return d
}
