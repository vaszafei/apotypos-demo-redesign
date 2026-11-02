// The color checks of the prototypes (#2). Usage: pnpm check (in web/) or node docs/redesign/prototypes/scripts/check.mjs
// 1. No hex color outside assets/tokens.css.
// 2. Contrast in every theme: text 4.5 to 1, marks 3 to 1, each on its surfaces.
// 3. The accent, the data series and "supportive" are far apart (CIEDE2000).
// 4. The categorical slots stay apart under simulated protanopia, deuteranopia and tritanopia (Machado 2009, severity 1). A warning, not a failure.
// Exit code 1 if 1, 2 or 3 fails.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const THEMES = ['paper', 'fog', 'terra', 'night', 'midnight']
const DARK = new Set(['night', 'midnight'])
const MIN_DISTINCT = 15
const MIN_CVD = 8
let failures = 0
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`) }

// 1. Hex colors outside tokens.css. Vendor code, fonts, SVG files and the standalone reports are not ours to theme.
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const files = [
  ...readdirSync(ROOT).filter((f) => f.endsWith('.html')),
  ...readdirSync(join(ROOT, 'assets')).filter((f) => /\.(css|js)$/.test(f) && f !== 'tokens.css').map((f) => join('assets', f))
]
console.log(`1. Hex colors outside tokens.css (${files.length} files)`)
let hexCount = 0
for (const f of files) {
  readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
    // An id fragment in a link (href="#main") is not a color: it is not followed by a hex-only word of 3, 4, 6 or 8 digits.
    for (const m of line.matchAll(HEX)) {
      if (![4, 5, 7, 9].includes(m[0].length)) continue
      const before = line.slice(Math.max(0, m.index - 6), m.index)
      if (/href=["']?$/.test(before)) continue
      hexCount++
      fail(`${f}:${i + 1}: ${m[0]}`)
    }
  })
}
if (!hexCount) console.log('  ok: none')

// Read the tokens of each theme from tokens.css: the :root block, then each block whose selector names the theme, in order.
const css = readFileSync(join(ROOT, 'assets', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }))
const declsOf = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
function themeTokens (theme) {
  const vars = {}
  for (const b of blocks) {
    const sels = b.sel.split(',').map((s) => s.trim())
    const hit = theme === 'paper' ? sels.includes(':root') : sels.some((s) => s.includes(`data-theme="${theme}"`))
    if (hit || (theme !== 'paper' && sels.includes(':root'))) Object.assign(vars, declsOf(b.body))
  }
  return vars
}
function resolver (vars) {
  const get = (name, depth = 0) => {
    const v = vars[name]
    if (v === undefined) throw new Error(`token ${name} is not defined`)
    const ref = v.match(/^var\((--[\w-]+)\)$/)
    if (ref && depth < 10) return get(ref[1], depth + 1)
    if (!/^#[0-9a-f]{6}$/i.test(v)) return null
    return v.toLowerCase()
  }
  return get
}

// Color math: WCAG contrast, CIELAB, CIEDE2000, Machado CVD matrices.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
function labOfLinear ([r, g, b]) {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const rad = (d) => (d * Math.PI) / 180
function deltaE ([L1, a1, b1], [L2, a2, b2]) {
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const [a1p, a2p] = [a1 * (1 + G), a2 * (1 + G)]
  const [C1, C2] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)]
  const hue = (b, a) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  const [h1, h2] = [hue(b1, a1p), hue(b2, a2p)]
  let dh = h2 - h1
  if (C1 * C2 === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dL = L2 - L1
  const dC = C2 - C1
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(rad(dh / 2))
  const Lb = (L1 + L2) / 2
  const Cbp = (C1 + C2) / 2
  let hb = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + 360) / 2
  if (C1 * C2 === 0) hb = h1 + h2
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63))
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const SC = 1 + 0.045 * Cbp
  const SH = 1 + 0.015 * Cbp * T
  const RT = -2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * Math.sin(rad(60 * Math.exp(-(((hb - 275) / 25) ** 2))))
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}
const CVD = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]]
}
const labOf = (hex, kind) => {
  const v = rgb(hex).map(lin)
  return labOfLinear(kind ? CVD[kind].map((row) => Math.min(1, Math.max(0, row.reduce((s, m, j) => s + m * v[j], 0)))) : v)
}
const dE = (a, b, kind) => deltaE(labOf(a, kind), labOf(b, kind))

// The pairs that must keep their contrast. [foreground tokens, background tokens, minimum].
const SURFACES = ['--surface-page', '--surface-card', '--surface-raised']
const RULES = [
  [['--ink', '--text-primary', '--text-secondary', '--accent'], SURFACES, 4.5],
  [['--error-text'], ['--error-bg', '--surface-raised'], 4.5],
  [['--notice-text'], ['--notice-bg'], 4.5],
  [['--success-text'], ['--success-bg'], 4.5],
  [['--series-1', '--stance-critical', '--stance-supportive', '--emph-more', '--emph-less', '--side-a', '--side-b'], ['--surface-card', '--surface-raised'], 3]
]
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `--cat-${i}`)

console.log('2. Contrast  3. Distinct accent, series and supportive  4. Slots under color vision deficiencies')
for (const theme of THEMES) {
  const get = resolver(themeTokens(theme))
  console.log(`  [${theme}]`)
  for (const [fgs, bgs, min] of RULES) {
    for (const fg of fgs) {
      for (const bg of bgs) {
        const c = contrast(get(fg), get(bg))
        if (c < min) fail(`${theme}: ${fg} on ${bg} is ${c.toFixed(2)} to 1, below ${min}`)
      }
    }
  }
  for (let k = 1; k <= 7; k++) {
    const c = contrast(get(`--seq-text-${k}`), get(`--seq-${k}`))
    if (c < 4.5) fail(`${theme}: --seq-text-${k} on --seq-${k} is ${c.toFixed(2)} to 1, below 4.5`)
  }
  // The decision of #2: one set of slots; a dark theme lightens a slot that fails 3 to 1 on its card. A light theme reports only.
  const weak = []
  for (const s of [...SLOTS, '--cat-9']) {
    const c = contrast(get(s), get('--surface-card'))
    if (c < 3) (DARK.has(theme) ? fail : (m) => weak.push(m))(`${theme}: ${s} on --surface-card is ${c.toFixed(2)} to 1, below 3`)
  }
  if (weak.length) console.log(`  note: ${weak.length} slots below 3 to 1 on the card (light themes keep the dataviz palette): ${weak.map((w) => w.split(' ')[1]).join(' ')}`)
  const trio = ['--accent', '--series-1', '--stance-supportive']
  for (let i = 0; i < trio.length; i++) {
    for (let j = i + 1; j < trio.length; j++) {
      const d = dE(get(trio[i]), get(trio[j]))
      if (d < MIN_DISTINCT) fail(`${theme}: ${trio[i]} and ${trio[j]} are ΔE ${d.toFixed(1)} apart, below ${MIN_DISTINCT}`)
    }
  }
  const close = []
  for (let i = 0; i < SLOTS.length; i++) {
    for (let j = i + 1; j < SLOTS.length; j++) {
      const [kind, d] = Object.keys(CVD).map((k) => [k, dE(get(SLOTS[i]), get(SLOTS[j]), k)]).sort((a, b) => a[1] - b[1])[0]
      if (d < MIN_CVD) close.push(`${SLOTS[i]}/${SLOTS[j]} ${kind} ΔE ${d.toFixed(1)}`)
    }
  }
  if (close.length) console.log(`  warn: slot pairs closer than ΔE ${MIN_CVD} for color vision deficiencies: ${close.join(', ')}`)
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll color checks pass.')
process.exit(failures ? 1 : 0)
