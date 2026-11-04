// The moving field behind the hero of Αρχική: a wall of thin bars that turns from one real picture of the data into the next.
// shapes: [{ caption, draw (ctx, W, H) }]. draw paints a picture in page pixels with any colors of the theme; the field shows it through its bars.
// It costs little: one low-resolution image for the whole field, and it stops when it is out of view or the tab is hidden. With reduced motion it shows one picture and stays.
(function () {
  const COL = 7 // Page pixels between two bars.
  const ROW = 11
  const BAR = 3 // The width of a bar and the height of one of its dashes.
  const DASH = 9
  const HOLD = 3600
  const MORPH = 1700
  const FRAME = 1000 / 24

  function HeroField ({ shapes, still, onShape }) {
    const canvas = document.createElement('canvas')
    canvas.className = 'home-hero-field'
    canvas.setAttribute('aria-hidden', 'true')
    const ctx = canvas.getContext('2d')
    const low = document.createElement('canvas')
    const lowCtx = low.getContext('2d', { willReadFrequently: true })
    let cols = 0; let rows = 0; let cell = 0; let pictures = []; let pattern = null; let image = null; let jitter = []
    let index = still ? Math.min(1, shapes.length - 1) : 0
    let phaseStart = 0; let raf = 0; let lastFrame = 0; let inView = true

    function build () {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      if (!W || !H) return false
      const scale = (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) * (window.devicePixelRatio || 1)
      cell = Math.max(2, Math.round(COL * scale))
      const cellH = Math.max(2, Math.round(ROW * scale))
      cols = Math.ceil((W * scale) / cell)
      rows = Math.ceil((H * scale) / cellH)
      canvas.width = cols * cell
      canvas.height = rows * cellH
      low.width = cols
      low.height = rows
      image = lowCtx.createImageData(cols, rows)
      jitter = Array.from({ length: cols }, (_, c) => (Math.sin(c * 12.9898) * 43758.5453) % 1)
      pictures = shapes.map((shape) => {
        lowCtx.setTransform(1, 0, 0, 1, 0, 0)
        lowCtx.clearRect(0, 0, cols, rows)
        lowCtx.setTransform(cols / W, 0, 0, rows / H, 0, 0)
        shape.draw(lowCtx, W, H)
        return lowCtx.getImageData(0, 0, cols, rows).data
      })
      lowCtx.setTransform(1, 0, 0, 1, 0, 0)
      // One dash of one bar, repeated over the field: everything outside the dashes is cut away.
      const tile = document.createElement('canvas')
      tile.width = cell
      tile.height = cellH
      const tileCtx = tile.getContext('2d')
      tileCtx.fillRect(0, 0, Math.max(1, Math.round(BAR * scale)), Math.max(1, Math.round(DASH * scale)))
      pattern = ctx.createPattern(tile, 'repeat')
      return true
    }

    const ease = (x) => x * x * (3 - 2 * x)
    function paint (from, to, progress, time) {
      const out = image.data
      for (let c = 0; c < cols; c++) {
        // The change sweeps across the field, each bar a little before or after its neighbours.
        const start = (c / cols) * 0.55 + Math.abs(jitter[c]) * 0.12
        const k = from === to ? 1 : ease(Math.min(1, Math.max(0, (progress - start) / 0.33)))
        const breath = still ? 1 : 0.86 + 0.14 * Math.sin(time / 900 + c * 0.16)
        for (let r = 0; r < rows; r++) {
          const i = (r * cols + c) * 4
          const a0 = from ? from[i + 3] : 0
          const a1 = to[i + 3]
          // A bar with no picture on one side keeps the color of the other side while it fades.
          const w = a0 + a1 ? (a1 * k) / (a0 * (1 - k) + a1 * k || 1) : 0
          const p0 = from || to
          out[i] = p0[i] + ((to[i] - p0[i]) * (a0 ? w : 1))
          out[i + 1] = p0[i + 1] + ((to[i + 1] - p0[i + 1]) * (a0 ? w : 1))
          out[i + 2] = p0[i + 2] + ((to[i + 2] - p0[i + 2]) * (a0 ? w : 1))
          out[i + 3] = (a0 + (a1 - a0) * k) * breath
        }
      }
      lowCtx.putImageData(image, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(low, 0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    function tick (time) {
      raf = 0
      if (!canvas.isConnected) return
      if (!pictures.length && !build()) { schedule(); return }
      if (time - lastFrame >= FRAME) {
        lastFrame = time
        phaseStart ||= time
        const elapsed = time - phaseStart
        if (elapsed < MORPH) {
          paint(index === 0 && !tick.looped ? null : pictures[(index - 1 + pictures.length) % pictures.length], pictures[index], elapsed / MORPH, time)
        } else {
          paint(pictures[index], pictures[index], 1, time)
          if (elapsed >= MORPH + HOLD) {
            tick.looped = true
            index = (index + 1) % pictures.length
            phaseStart = time
            onShape?.(shapes[index])
          }
        }
      }
      schedule()
    }
    function schedule () { if (!raf && inView && !document.hidden) raf = requestAnimationFrame(tick) }

    function drawStill () {
      if (!canvas.isConnected || !build()) return
      paint(pictures[index], pictures[index], 1, 0)
    }
    const rebuild = () => { pictures = []; if (still) drawStill() }
    new ResizeObserver(rebuild).observe(canvas)
    new MutationObserver(rebuild).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    onShape?.(shapes[index])
    if (still) requestAnimationFrame(drawStill)
    else {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule() }).observe(canvas)
      document.addEventListener('visibilitychange', schedule)
      schedule()
    }
    return canvas
  }
  window.HeroField = HeroField
})()
