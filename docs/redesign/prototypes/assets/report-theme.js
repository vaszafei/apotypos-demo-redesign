// The standalone reports (reports/*) take the theme of the site. Load in the head of a report, before its own styles.
// Inside a frame of the site a report also drops its own page: it has no background and no margins, so it reads as the content of its card.
(function () {
  const root = document.documentElement
  let saved = null
  try { saved = localStorage.getItem('proto-theme') } catch {}
  root.dataset.theme = new URLSearchParams(location.search).get('theme') || saved || 'ember'
  let parentZoom = 1
  if (window.self !== window.top) {
    root.dataset.report = 'embedded'
    try { parentZoom = parseFloat(getComputedStyle(window.parent.document.documentElement).zoom) || 1 } catch { /* another origin */ }
  }
  // No text is below 12 px on screen (C13). The sizes are in the styles of each report, so raise them there.
  const floor = 12 / parentZoom
  const raise = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules?.length) raise(rule.cssRules)
      const size = rule.style?.fontSize
      if (size?.endsWith('px') && parseFloat(size) < floor) rule.style.fontSize = `${floor}px`
      // A font shorthand with a var() in it keeps its size only in the shorthand.
      const font = rule.style?.getPropertyValue('font')
      const inFont = font && /(?:^|\s)([\d.]+)px/.exec(font)
      if (inFont && parseFloat(inFont[1]) < floor) rule.style.setProperty('font', font.replace(`${inFont[1]}px`, `${floor}px`))
    }
  }
  // A chart can set the size on its own text as it draws.
  const raiseDrawn = () => {
    for (const el of document.querySelectorAll('svg text[font-size], [style*="font-size"]')) {
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < floor) el.style.fontSize = `${floor}px`
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    for (const sheet of document.styleSheets) { try { raise(sheet.cssRules) } catch { /* a sheet of another origin */ } }
    raiseDrawn()
    let waiting = false
    new MutationObserver(() => { if (!waiting) { waiting = true; requestAnimationFrame(() => { waiting = false; raiseDrawn() }) } }).observe(document.body, { childList: true, subtree: true })
  })
})()
