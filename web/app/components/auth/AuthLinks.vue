<script setup lang="ts">
// authLinks of assets/shell.js: log in and sign up when nobody is signed in; the user menu on a wide screen, or the name and log out in the drawer, when someone is.
const props = defineProps<{ cls: string, inDrawer?: boolean }>()
const emit = defineEmits<{ opened: [] }>()
const { t } = useI18n()
const session = useSessionStore()
const auth = useAuthDrawer()
const ask = (view: 'login' | 'register') => { if (props.inDrawer) emit('opened'); auth.open(view) }
</script>

<template>
  <div :class="cls">
    <template v-if="session.user && !inDrawer"><UserMenu :user="session.user" /></template>
    <template v-else-if="session.user">
      <span class="auth-user">{{ session.user }}</span>
      <button type="button" class="button auth-login" @click="session.signOut()">{{ t('shell.logout') }}</button>
    </template>
    <template v-else>
      <button type="button" class="button auth-login" @click="ask('login')">{{ t('shell.login') }}</button>
      <button type="button" class="button button-primary auth-register" @click="ask('register')">{{ t('shell.register') }}</button>
    </template>
  </div>
</template>
