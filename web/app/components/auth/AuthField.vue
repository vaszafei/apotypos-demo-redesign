<script setup lang="ts">
// A labelled field of the auth drawer: the label, the control (slot), an optional hint that hides while there is an error, and the error line.
const props = defineProps<{ id: string, label: string, error?: string, hint?: string, optional?: boolean, trailing?: boolean }>()
const { t } = useI18n()
const attrs = computed(() => ({
  id: props.id,
  'aria-describedby': props.hint ? `${props.id}-hint ${props.id}-error` : `${props.id}-error`,
  'aria-invalid': props.error ? 'true' as const : undefined
}))
</script>

<template>
  <div class="auth-field">
    <label :for="id">{{ label }}<span v-if="optional" class="field-optional">{{ t('register.optional') }}</span></label>
    <div v-if="trailing" class="field-control"><slot :attrs="attrs" /><slot name="trailing" /></div>
    <slot v-else :attrs="attrs" />
    <p v-if="hint" :id="`${id}-hint`" class="field-hint" :hidden="Boolean(error)">{{ hint }}</p>
    <p :id="`${id}-error`" class="field-error" role="alert" :hidden="!error">{{ error }}</p>
  </div>
</template>
