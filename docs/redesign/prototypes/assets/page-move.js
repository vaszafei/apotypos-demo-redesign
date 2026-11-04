// A move from another page (shell.js, "m-move") holds the first frame until the whole page is parsed and its scripts have drawn it,
// so the page transition shows the new page and not the loading skeleton. A page opened directly draws at once and shows the skeleton.
// Load in the head, before the body.
// The theme is set before the first paint, so a dark page does not flash the light background of :root.
(function () {
  let saved = null
  try { saved = localStorage.getItem('proto-theme') } catch {}
  document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') || saved || 'carbon'
})();
(function () {
  let move = null
  try { move = JSON.parse(sessionStorage.getItem('m-move')) } catch { return }
  const traverse = window.navigation?.activation?.navigationType === 'traverse' || performance.getEntriesByType('navigation')[0]?.type === 'back_forward'
  if (!move || Date.now() - move.time > 5000 || !(move.nav || traverse)) return
  // No element has this id, so the frame waits for the end of the parse.
  const hold = document.createElement('link')
  hold.rel = 'expect'
  hold.href = '#page-parsed'
  hold.setAttribute('blocking', 'render')
  document.head.append(hold)
})()
