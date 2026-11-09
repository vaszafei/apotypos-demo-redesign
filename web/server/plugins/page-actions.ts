// A page puts its controls in the page head with <Teleport to="#page-actions">. Vue renders the content of a teleport apart from the page, and Nuxt
// writes down only the ones that go to #teleports; this puts the content of #page-actions into the head of the prerendered page, where the client finds it
// and hydrates it. Without it the controls are missing from the first frame and appear after the page is hydrated.
const TARGET = '<div id="page-actions" class="page-head-actions"></div>'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const content = event.context.pageActions as string | undefined
    if (!content) return
    html.body = html.body.map(chunk => chunk.replace(TARGET, TARGET.replace('></div>', `>${content}</div>`)))
  })
})
