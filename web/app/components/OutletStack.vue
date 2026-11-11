<script setup lang="ts">
// OutletStack of assets/home.js: a thin horizontal bar of the articles of a story, one part for each outlet, the largest from the left, in the color of its group. The line under it
// says the total, and names the outlet of the part under the pointer (or in focus). A part opens the page of its outlet.
export interface StackPart { name: string, group: string | null, n: number, color: string, slug?: string }
const props = defineProps<{ parts: StackPart[] }>()
const { t } = useI18n()
const total = computed(() => props.parts.reduce((s, p) => s + p.n, 0))
const on = ref<StackPart | null>(null)
</script>

<template>
  <div class="home-stack-wrap">
    <div :class="on ? 'home-stack has-hover' : 'home-stack'" role="group" :aria-label="t('home.day.outlets')">
      <template v-for="p in parts" :key="p.slug ?? p.name">
        <NuxtLink v-if="p.slug" :to="outletHref(p.slug)" :class="on === p ? 'home-stack-part is-on' : 'home-stack-part'" :style="{ flex: `${p.n} 1 0`, background: p.color }"
                  :aria-label="`${p.name}: ${fmtInt(p.n)}`" @pointerenter="on = p" @pointerleave="on = null" @focus="on = p" @blur="on = null" />
        <span v-else :class="on === p ? 'home-stack-part is-on' : 'home-stack-part'" :style="{ flex: `${p.n} 1 0`, background: p.color }" tabindex="0"
              :aria-label="`${p.name}: ${fmtInt(p.n)}`" @pointerenter="on = p" @pointerleave="on = null" @focus="on = p" @blur="on = null" />
      </template>
    </div>
    <div class="home-stack-panel" aria-live="polite">
      <template v-if="on">
        <p class="home-stack-line"><strong class="home-stack-name">{{ on.name }}</strong><span v-if="on.slug" class="home-stack-cap">{{ on.group || t('home.day.nogroup') }}</span></p>
        <p class="home-stack-cap">{{ t('home.day.slice', { n: fmtInt(on.n), share: fmtPct(on.n / total) }) }}</p>
      </template>
      <p v-else class="home-stack-line"><strong class="home-stack-total">{{ fmtInt(total) }}</strong><span class="home-stack-cap">{{ t('home.day.ring', { n: parts.length }) }}</span></p>
    </div>
  </div>
</template>
