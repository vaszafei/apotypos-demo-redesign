// Hands the content of Teleport to="#page-actions" to server/plugins/page-actions.ts.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:rendered', ({ ssrContext }) => {
    const content = ssrContext?.teleports?.['#page-actions']
    if (ssrContext && content) ssrContext.event.context.pageActions = content
  })
})
