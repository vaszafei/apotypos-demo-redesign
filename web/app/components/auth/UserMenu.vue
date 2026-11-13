<script setup lang="ts">
// userMenu of assets/shell.js: the user icon with a menu of the profile and log out. Arrow keys move, Esc closes and gives the focus back to the button.
const props = defineProps<{ user: string }>()
const { t } = useI18n()
const session = useSessionStore()
const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
const items = () => [...(root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

const setOpen = async (value: boolean, focusFirst = false) => {
  open.value = value
  if (value && focusFirst) { await nextTick(); items()[0]?.focus() }
}
const away = (e: Event) => { if (!root.value?.contains(e.target as Node)) open.value = false }
watch(open, (value) => {
  if (value) document.addEventListener('pointerdown', away, true)
  else document.removeEventListener('pointerdown', away, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', away, true))

const onButtonKey = (e: KeyboardEvent) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, true) } }
const onMenuKey = (e: KeyboardEvent) => {
  const list = items()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'Escape') { e.preventDefault(); open.value = false; button.value?.focus() }
  else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
  else if (e.key === 'Tab') open.value = false
}
</script>

<template>
  <div ref="root" class="user-menu">
    <button ref="button" type="button" class="user-button" :aria-label="`${t('shell.account')}: ${props.user}`" aria-haspopup="menu" :aria-expanded="tf(open)" @click="setOpen(!open)" @keydown="onButtonKey"><AppIcon name="user-circle" /></button>
    <div class="user-menu-list" role="menu" :aria-label="t('shell.account')" :hidden="!open" @keydown="onMenuKey">
      <p class="user-menu-name">{{ props.user }}</p>
      <NavLink role="menuitem" class="user-menu-item" to="/profile" @click="open = false">{{ t('shell.profile') }}</NavLink>
      <button type="button" role="menuitem" class="user-menu-item" @click="open = false; session.signOut()">{{ t('shell.logout') }}</button>
    </div>
  </div>
</template>
