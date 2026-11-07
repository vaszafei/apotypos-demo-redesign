// The pages show at 90 % on a desktop screen (html { zoom: 0.9 } in app.css). With CSS zoom the browser gives the pointer, the boxes
// and the window size in screen pixels, while the page lays out in its own pixels. This file turns them back into page pixels,
// so the charts draw at the width of their card and the tooltips stand at the pointer.
(function () {
  // The zoom of the page, read again when the window changes size (the zoom is only on a wide screen).
  let cached = null
  const zoom = () => (cached ??= parseFloat(getComputedStyle(document.documentElement).zoom) || 1)
  addEventListener('resize', () => { cached = null }, true)
  const rect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    const r = rect.call(this); const z = zoom()
    return z === 1 ? r : new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z)
  }
  for (const key of ['clientX', 'clientY']) {
    const d = Object.getOwnPropertyDescriptor(MouseEvent.prototype, key)
    Object.defineProperty(MouseEvent.prototype, key, { configurable: true, get () { return d.get.call(this) / zoom() } })
  }
  for (const key of ['innerWidth', 'innerHeight']) {
    const d = Object.getOwnPropertyDescriptor(window, key)
    if (d && d.get) Object.defineProperty(window, key, { configurable: true, get () { return d.get.call(window) / zoom() } })
  }
})()
