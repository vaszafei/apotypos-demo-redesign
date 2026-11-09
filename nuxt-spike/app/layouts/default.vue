<script setup lang="ts">
const { sections, section } = useNav()
const route = useRoute()
const open = ref(false)
watch(() => route.path, () => { open.value = false })
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-30 flex h-14 items-center gap-6 border-b border-[var(--border)] bg-[var(--surface-page)] px-4">
      <UButton class="lg:hidden" icon="i-lucide-menu" color="neutral" variant="ghost" aria-label="Μενού" @click="open = !open" />
      <NuxtLink to="/" class="text-lg font-semibold tracking-tight">Απότυπος</NuxtLink>
      <nav class="hidden gap-1 lg:flex" aria-label="Ενότητες">
        <NuxtLink
          v-for="s in sections" :key="s.key" :to="s.to"
          class="rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--sidebar-hover-bg)]"
          :class="s.key === section.key ? 'font-semibold underline underline-offset-8' : ''"
        >{{ s.label }}</NuxtLink>
      </nav>
      <div id="topbar-actions" class="ml-auto" />
    </header>

    <div class="mx-auto flex max-w-[1920px]">
      <aside
        class="fixed inset-y-14 left-0 z-20 w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface-sidebar)] p-3 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0"
        :class="open ? 'translate-x-0' : '-translate-x-full'"
      >
        <ul class="flex flex-col gap-0.5 text-sm" role="list">
          <li v-for="t in section.tabs" :key="t.to">
            <NuxtLink :to="t.to" class="block rounded-lg px-3 py-2 hover:bg-[var(--sidebar-hover-bg)]" active-class="bg-[var(--sidebar-hover-bg)] font-semibold">{{ t.label }}</NuxtLink>
          </li>
        </ul>
      </aside>
      <main class="min-w-0 flex-1 p-4 lg:p-6">
        <slot />
      </main>
    </div>
    <ChartTooltip />
  </div>
</template>
