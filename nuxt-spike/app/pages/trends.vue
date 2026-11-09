<script setup lang="ts">
useHead({ title: 'Θέματα · Απότυπος' })
const { status, refresh, dates, rows, total, colorOf, series, movers, range } = await useTopics()
const [from, to] = [computed(() => dates.value[range.value[0]] ?? ''), computed(() => dates.value[range.value[1]] ?? '')]
const sliced = computed(() => dates.value.slice(range.value[0], range.value[1] + 1))
const top3 = computed(() => rows.value.slice(0, 3).reduce((a, r) => a + r.count, 0) / (total.value || 1))
</script>

<template>
  <div class="flex flex-col gap-4">
    <Teleport v-if="dates.length" defer to="#topbar-actions"><DateRange :dates="dates" /></Teleport>

    <div v-if="status === 'error'" class="rounded-xl border p-6 text-center">
      <p>Δεν φορτώθηκαν τα δεδομένα.</p>
      <UButton class="mt-2" label="Δοκιμάστε ξανά" @click="refresh()" />
    </div>
    <p v-else-if="!rows.length && status === 'success'" class="p-6 text-center text-[var(--text-secondary)]">Δεν υπάρχουν άρθρα σε αυτή την περίοδο.</p>

    <div v-else class="grid gap-4 lg:grid-cols-12">
      <div class="relative lg:col-span-4 xl:col-span-3">
        <DashCard class="lg:absolute lg:inset-0" title="Όλα τα θέματα" info="Όλα τα θέματα της περιόδου, με τα άρθρα και το μερίδιο του καθενός.">
          <p v-if="rows.length > 3" class="-mt-1 text-sm text-[var(--text-secondary)]">Τα 3 μεγαλύτερα θέματα έχουν το {{ fmtPct(top3) }} των άρθρων</p>
          <TopicDonut v-if="rows.length" :rows="rows" :total="total" :color-of="colorOf" />
        </DashCard>
      </div>
      <div class="flex min-w-0 flex-col gap-4 lg:col-span-8 xl:col-span-9">
        <DashCard title="Θέματα στον χρόνο" info="Άρθρα ανά ημέρα, μέσος όρος 7 ημερών, για τα 8 θέματα με τα περισσότερα άρθρα στην περίοδο.">
          <LinesChart v-if="series.length" :dates="sliced" :series="series" caption="Θέματα στον χρόνο" />
        </DashCard>
        <DashCard title="Τάσεις" info="Αλλαγή των άρθρων στις τελευταίες 14 ημέρες έναντι των 14 πριν. Μόνο θέματα με 200 άρθρα ή περισσότερα στις 14 πριν.">
          <MoversList :rows="movers" />
        </DashCard>
      </div>
    </div>
    <p class="sr-only">{{ from }} – {{ to }}</p>
  </div>
</template>
