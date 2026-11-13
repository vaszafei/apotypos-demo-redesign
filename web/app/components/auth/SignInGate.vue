<script setup lang="ts">
// SignInGate of assets/shell.js: the page of Αναλύσεις for a visitor who is not signed in. The lock, what is behind it, log in, sign up.
const { t } = useI18n()
const auth = useAuthDrawer()
</script>

<template>
  <section class="gate" aria-labelledby="gate-title">
    <div class="gate-card">
      <span class="gate-icon"><AppIcon name="lock-closed" /></span>
      <h2 id="gate-title" class="gate-title">{{ t('gate.title') }}</h2>
      <p class="gate-text">{{ t('gate.text') }}</p>
      <button type="button" class="button button-primary gate-login" @click="auth.open('login')">{{ t('shell.login') }}</button>
      <p class="gate-register">{{ t('gate.register') }} <button type="button" class="link-button" @click="auth.open('register')">{{ t('shell.register') }}</button></p>
    </div>
  </section>
</template>
