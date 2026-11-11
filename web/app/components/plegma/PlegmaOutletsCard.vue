<script setup lang="ts">
import type { StoryView } from '~/composables/useStoryView'

// The groups and the outlets that pushed the story; outlets appear in cards only (AE5).
const props = defineProps<{ view: StoryView }>()
const { t } = useI18n()
const v = props.view
const m = computed(() => v.model.value!)
const plegma = usePlegmaStore()
</script>

<template>
  <DashCard :title="t('entity.groups.title')" :info="t('story.outlets.info')">
    <GroupSunburst :groups="v.tree.value" :total="m.articles" rounded @hover="plegma.setHighlight">
      <template #name="{ group }">
        <EntityLink v-if="group.slug" type="group" :to="groupPageHref(group.slug)">{{ group.key }}</EntityLink>
        <template v-else>{{ group.label }}</template>
      </template>
      <template #sub="{ group }">
        <span><template v-for="(o, k) in group.outlets" :key="o.slug">{{ k ? ' · ' : '' }}<span @pointerenter.stop="plegma.setHighlight({ group: group.key, outlet: o.name })" @pointerleave.stop="plegma.setHighlight({ group: group.key })"><EntityLink type="outlet" :to="outletHref(o.slug)">{{ o.name }}</EntityLink>{{ ` ${fmtInt(o.value)}` }}</span></template></span>
      </template>
    </GroupSunburst>
  </DashCard>
</template>
