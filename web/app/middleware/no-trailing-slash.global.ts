// Netlify serves a prerendered page at a folder URL (/fingerprints becomes /fingerprints/). The nav, the tabs and the Plegma compare route.path with the route without the slash,
// so on the host every page of Πρόσωπα and Αναλύσεις took the tabs of Μέσα. The route is the same one without the slash; this puts it back before the page is drawn.
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.length > 1 && to.path.endsWith('/')) return navigateTo({ path: to.path.replace(/\/+$/, '') || '/', query: to.query, hash: to.hash }, { replace: true })
})
