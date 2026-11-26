export default defineNuxtRouteMiddleware((to) => {
  if (isHidden(to.path)) return navigateTo('/stories', { replace: true })
  if (isGone(to.path)) return navigateTo('/', { replace: true })
})
