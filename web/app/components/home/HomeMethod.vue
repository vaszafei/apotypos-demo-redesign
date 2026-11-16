<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import type { MethodLabels } from '~/utils/method-scene'

// «Μεθοδολογία» under «Η επικαιρότητα» (#home-method): three steps, each a card of text beside an animation of the dots on the Plegma world (components/home/MethodScene.vue).
// The row of the second step is turned round. The world behind steps back to the dim map while the section is in view, as it does for «Η επικαιρότητα».
const { t } = useI18n()
const plegma = usePlegmaStore()
const root = ref<HTMLElement>()
const steps = [1, 2, 3]
const labels = computed<MethodLabels>(() => ({
  themes: Array.from({ length: 8 }, (_, i) => t(`home.method.theme.${i + 1}`)),
  judgeA: t('home.method.judgeA'),
  judgeB: t('home.method.judgeB'),
  score: t('home.method.score'),
  agreement: t('home.method.agreement')
}))
useIntersectionObserver(root, ([entry]) => plegma.setHomeDim(!!entry?.isIntersecting), { threshold: 0.2 })
// A page opened on /#home-method (the link of the top bar from a page that is not Home) scrolls here once the page is drawn; the router does it for a link inside the app.
// «Η επικαιρότητα» above is drawn in the browser, so the section moves down when it comes in: wait for it.
onMounted(async () => {
  if (location.hash !== '#home-method') return
  await nextTick()
  requestAnimationFrame(() => requestAnimationFrame(() => root.value?.scrollIntoView()))
})
onBeforeUnmount(() => plegma.setHomeDim(false))
</script>

<template>
  <section id="home-method" ref="root" class="home-method" aria-labelledby="home-method-title">
    <div class="method-in">
      <h2 id="home-method-title" class="method-kicker">{{ t('home.method.title') }}</h2>
      <div v-for="n in steps" :key="n" class="method-row" :class="{ 'is-flip': n === 2 }">
        <DashCard :title="t(`home.method.${n}.title`)" class="method-card">
          <p class="method-text">{{ t(`home.method.${n}.text`) }}</p>
          <span class="method-fact">{{ t(`home.method.${n}.fact`) }}</span>
        </DashCard>
        <ClientOnly><MethodScene :row="n - 1" :labels="labels" :label="t(`home.method.${n}.alt`)" /></ClientOnly>
      </div>
    </div>
  </section>
</template>
