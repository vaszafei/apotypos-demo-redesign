// The fixtures (public/data/*.json) while the pages are prerendered: the prerender server does not serve public/, so useFixture would get a 404 and
// the page would be built in its error state. The deployed site serves the same files from the host, before any route.
export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? ''
  const body = /^[\w-]+\.json$/.test(file) ? await useStorage('assets:fixtures').getItemRaw(file) : null
  if (body === null || body === undefined) throw createError({ statusCode: 404, statusMessage: `No fixture ${file}` })
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  return body
})
