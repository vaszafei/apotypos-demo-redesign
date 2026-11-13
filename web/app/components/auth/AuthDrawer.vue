<script setup lang="ts">
// openAuth of assets/shell.js: log in and the three-step sign up in a drawer from the right, over a scrim. The page behind is inert while it is open.
// Prototype only: a sign-up request is checked and then dropped. There is no backend, so nothing is saved or sent.
const JOBS = ['journalist', 'researcher', 'student', 'comms', 'politics', 'public', 'business', 'other']
const REASONS = ['journalism', 'academic', 'monitoring', 'professional', 'personal', 'other']
const SOURCES = ['google', 'social', 'friend', 'media', 'event', 'other']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STEPS = 3

const { t } = useI18n()
const auth = useAuthDrawer()
const session = useSessionStore()

const rendered = ref(false)
const shown = ref(false)
const current = ref<'login' | 'register' | 'done'>('login')
const step = ref(1)
const confirming = ref(false)
const showPassword = ref(false)
const loginFailed = ref(false)
const panel = ref<HTMLElement>()
const main = ref<HTMLElement>()

const blank = () => ({ user: '', password: '', name: '', email: '', newPassword: '', job: '', org: '', source: '', sourceOther: '', terms: false, updates: false })
const form = reactive(blank())
const reasons = ref<string[]>([])
const errors = reactive<Record<string, string>>({})
const clear = (key: string) => { errors[key] = '' }

let opener: HTMLElement | null = null
let beforeConfirm: HTMLElement | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined
const app = () => document.getElementById('__nuxt')

const title = computed(() => t(current.value === 'register' && step.value > 1 ? `register.title${step.value}` : `${current.value}.title`))
const text = computed(() => t(current.value === 'register' && step.value > 1 ? `register.text${step.value}` : `${current.value}.text`))

const hasInput = () => [form.name, form.email, form.newPassword, form.org, form.sourceOther].some(v => v !== '') ||
  Boolean(form.job || form.source || reasons.value.length || form.terms || form.updates)

// Each step checks only its own fields. The last step checks all three, so a field cleared on a step back cannot slip through.
// It returns the ids of the fields that are wrong.
const validate = (n: number) => {
  const wrong: string[] = []
  const check = (key: string, message: string, focus: string) => { errors[key] = message; if (message) wrong.push(focus) }
  if (n === 1) {
    const mail = form.email.trim()
    check('name', form.name.trim() ? '' : t('err.name'), 'auth-name')
    check('email', !mail ? t('err.email') : EMAIL_PATTERN.test(mail) ? '' : t('err.emailInvalid'), 'auth-email')
    check('newPassword', form.newPassword.length >= 8 ? '' : t('err.password'), 'auth-new-password')
  } else if (n === 2) {
    check('job', form.job ? '' : t('err.job'), 'auth-job')
    check('reason', reasons.value.length ? '' : t('err.reason'), 'auth-reason-0')
  } else {
    check('source', form.source ? '' : t('err.source'), 'auth-source')
    if (form.source === 'other') check('sourceOther', form.sourceOther.trim() ? '' : t('err.sourceOther'), 'auth-source-other')
    check('terms', form.terms ? '' : t('err.terms'), 'auth-terms')
  }
  return wrong
}

const focusId = (id: string) => document.getElementById(id)?.focus()
const focusFirst = async () => {
  await nextTick()
  const items = [...(panel.value?.querySelectorAll<HTMLElement>('input, select, .reason-chip') ?? [])].filter(el => !el.closest('[hidden]') && (el as HTMLInputElement).type !== 'checkbox')
  items[0]?.focus()
}
const goTo = async (n: number) => {
  step.value = n
  if (main.value) main.value.scrollTop = 0
  await focusFirst()
}
const show = (view: 'login' | 'register' | 'done', focus: boolean) => {
  current.value = view
  loginFailed.value = false
  if (!focus) return
  if (view === 'done') nextTick(() => panel.value?.querySelector<HTMLElement>('.auth-done button')?.focus())
  else focusFirst()
}

const submitLogin = () => {
  if (session.signIn(form.user, form.password)) { close(false); return }
  loginFailed.value = true
  form.password = ''
  nextTick(() => focusId('auth-password'))
}
const submitRegister = async () => {
  if (step.value < STEPS) {
    const wrong = validate(step.value)
    if (wrong.length) { focusId(wrong[0]!); return }
    await goTo(step.value + 1)
    return
  }
  for (let n = 1; n <= STEPS; n++) {
    const wrong = validate(n)
    if (wrong.length) { if (n !== step.value) await goTo(n); focusId(wrong[0]!); return }
  }
  show('done', true)
}
const toggleReason = (key: string) => {
  const at = reasons.value.indexOf(key)
  if (at >= 0) reasons.value.splice(at, 1)
  else reasons.value.push(key)
  clear('reason')
}

const showConfirm = (on: boolean) => {
  confirming.value = on
  if (on) { beforeConfirm = document.activeElement as HTMLElement | null; nextTick(() => panel.value?.querySelector<HTMLElement>('.auth-confirm-actions .button-primary')?.focus()) }
  else if (beforeConfirm?.isConnected) beforeConfirm.focus()
}
// Sign up closes only with the X or Esc, and asks first when something is typed. A click outside does not close it.
const requestClose = () => { if (current.value === 'register' && hasInput()) showConfirm(true); else close() }

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { e.preventDefault(); if (!confirming.value) requestClose(); else showConfirm(false); return }
  if (e.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>('button, input, select, a[href]')].filter(el => !(el as HTMLButtonElement).disabled && !el.closest('[hidden], [inert]'))
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  if (!panel.value.contains(document.activeElement)) { e.preventDefault(); first.focus() }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function close (restore = true) {
  if (!rendered.value || !shown.value) return
  document.removeEventListener('keydown', onKey)
  const root = app()
  if (root) root.inert = false
  shown.value = false
  auth.view.value = null
  closeTimer = setTimeout(() => { rendered.value = false }, reduceMotion() ? 0 : 220)
  if (restore && opener?.isConnected) opener.focus({ preventScroll: true })
}

const open = async (view: 'login' | 'register') => {
  if (rendered.value) { clearTimeout(closeTimer); document.removeEventListener('keydown', onKey) } else opener = document.activeElement as HTMLElement | null
  Object.assign(form, blank())
  reasons.value = []
  for (const key of Object.keys(errors)) errors[key] = ''
  step.value = 1
  confirming.value = false
  showPassword.value = false
  show(view, false)
  rendered.value = true
  await nextTick()
  const root = app()
  if (root) root.inert = true
  document.addEventListener('keydown', onKey)
  panel.value?.getBoundingClientRect()
  shown.value = true
  focusFirst()
}
watch(() => auth.view.value, (view) => { if (view) open(view) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); clearTimeout(closeTimer); const root = app(); if (root) root.inert = false })

// A click that starts and ends on the scrim closes the log in drawer.
let pressedOnOverlay = false
const pressOverlay = (e: MouseEvent) => { pressedOnOverlay = e.target === e.currentTarget }
const clickOverlay = (e: MouseEvent) => { if (pressedOnOverlay && e.target === e.currentTarget && current.value === 'login') close() }
const holdPage = (e: Event) => { if (!panel.value?.contains(e.target as Node)) e.preventDefault() }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="rendered" class="auth-overlay" :class="{ 'is-open': shown }"
      @mousedown="pressOverlay" @click="clickOverlay"
      @wheel="holdPage" @touchmove="holdPage"
    >
      <div ref="panel" class="auth-drawer" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-text">
        <div class="auth-head" :inert="confirming">
          <button type="button" class="icon-button auth-close" :aria-label="t('auth.close')" @click="requestClose"><AppIcon name="x-mark" /></button>
        </div>
        <div ref="main" class="auth-main" :inert="confirming">
          <h2 id="auth-title" class="auth-title">{{ title }}</h2>
          <p id="auth-text" class="auth-text">{{ text }}</p>

          <form class="auth-form" novalidate :hidden="current !== 'login'" @submit.prevent="submitLogin" @input="loginFailed = false">
            <AuthField id="auth-user" :label="t('login.user')" :error="errors.user" v-slot="{ attrs }">
              <input v-bind="attrs" v-model="form.user" class="input" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required @input="clear('user')">
            </AuthField>
            <AuthField id="auth-password" :label="t('login.password')" :error="errors.password" v-slot="{ attrs }">
              <input v-bind="attrs" v-model="form.password" class="input" type="password" autocomplete="current-password" required @input="clear('password')">
            </AuthField>
            <p class="login-error" role="alert" :hidden="!loginFailed">{{ t('login.error') }}</p>
            <div class="auth-actions"><button type="submit" class="button button-primary auth-submit">{{ t('login.submit') }}</button></div>
          </form>

          <form class="auth-form" novalidate :hidden="current !== 'register'" @submit.prevent="submitRegister">
            <div class="auth-progress">
              <p class="auth-progress-label" aria-live="polite">{{ t('register.step', { n: step, total: STEPS }) }}</p>
              <div class="auth-progress-bar" aria-hidden="true"><span v-for="n in STEPS" :key="n" :class="{ 'is-done': n <= step }" /></div>
            </div>
            <div class="auth-step" :hidden="step !== 1">
              <AuthField id="auth-name" :label="t('register.name')" :error="errors.name" v-slot="{ attrs }">
                <input v-bind="attrs" v-model="form.name" class="input" type="text" autocomplete="name" required @input="clear('name')">
              </AuthField>
              <AuthField id="auth-email" :label="t('register.email')" :error="errors.email" v-slot="{ attrs }">
                <input v-bind="attrs" v-model="form.email" class="input" type="email" autocomplete="email" required @input="clear('email')">
              </AuthField>
              <AuthField id="auth-new-password" :label="t('login.password')" :error="errors.newPassword" :hint="t('register.passwordHint')" trailing>
                <template #default="{ attrs }">
                  <input v-bind="attrs" v-model="form.newPassword" class="input" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required @input="clear('newPassword')">
                </template>
                <template #trailing>
                  <button type="button" class="icon-button field-eye" :aria-label="t(showPassword ? 'register.hidePassword' : 'register.showPassword')" @click="showPassword = !showPassword"><AppIcon :name="showPassword ? 'eye-slash' : 'eye'" /></button>
                </template>
              </AuthField>
            </div>
            <div class="auth-step" :hidden="step !== 2">
              <div class="auth-field">
                <label for="auth-job">{{ t('register.job') }}</label>
                <div class="field-control select-control">
                  <select id="auth-job" v-model="form.job" class="input" required aria-describedby="auth-job-error" :aria-invalid="errors.job ? 'true' : undefined" @change="clear('job')">
                    <option value="">{{ t('register.choose') }}</option>
                    <option v-for="k in JOBS" :key="k" :value="k">{{ t(`job.${k}`) }}</option>
                  </select>
                  <AppIcon name="chevron-down" />
                </div>
                <p id="auth-job-error" class="field-error" role="alert" :hidden="!errors.job">{{ errors.job }}</p>
              </div>
              <AuthField id="auth-org" :label="t('register.org')" optional v-slot="{ attrs }">
                <input v-bind="attrs" v-model="form.org" class="input" type="text" autocomplete="organization">
              </AuthField>
              <div class="auth-field" role="group" aria-labelledby="auth-reason-label">
                <span id="auth-reason-label" class="field-label">{{ t('register.reason') }}<span class="field-optional">{{ t('register.reasonHint') }}</span></span>
                <div class="reason-chips">
                  <button v-for="(k, i) in REASONS" :id="`auth-reason-${i}`" :key="k" type="button" class="reason-chip" :aria-pressed="tf(reasons.includes(k))" @click="toggleReason(k)">{{ t(`reason.${k}`) }}</button>
                </div>
                <p id="auth-reason-error" class="field-error" role="alert" :hidden="!errors.reason">{{ errors.reason }}</p>
              </div>
            </div>
            <div class="auth-step" :hidden="step !== 3">
              <div class="auth-field">
                <label for="auth-source">{{ t('register.source') }}</label>
                <div class="field-control select-control">
                  <select id="auth-source" v-model="form.source" class="input" required aria-describedby="auth-source-error" :aria-invalid="errors.source ? 'true' : undefined" @change="clear('source'); clear('sourceOther')">
                    <option value="">{{ t('register.choose') }}</option>
                    <option v-for="k in SOURCES" :key="k" :value="k">{{ t(`source.${k}`) }}</option>
                  </select>
                  <AppIcon name="chevron-down" />
                </div>
                <p id="auth-source-error" class="field-error" role="alert" :hidden="!errors.source">{{ errors.source }}</p>
              </div>
              <div v-show="form.source === 'other'">
                <AuthField id="auth-source-other" :label="t('register.sourceOther')" :error="errors.sourceOther" v-slot="{ attrs }">
                  <input v-bind="attrs" v-model="form.sourceOther" class="input" type="text" required @input="clear('sourceOther')">
                </AuthField>
              </div>
              <div class="auth-checks">
                <div class="auth-field">
                  <label class="auth-check" for="auth-terms">
                    <input id="auth-terms" v-model="form.terms" type="checkbox" aria-describedby="auth-terms-error" @change="clear('terms')">
                    <span>{{ t('register.terms1') }}<span class="terms-text">{{ t('register.terms2') }}</span>{{ t('register.terms3') }}<span class="terms-text">{{ t('register.terms4') }}</span></span>
                  </label>
                  <p id="auth-terms-error" class="field-error" role="alert" :hidden="!errors.terms">{{ errors.terms }}</p>
                </div>
                <div class="auth-field">
                  <label class="auth-check" for="auth-updates"><input id="auth-updates" v-model="form.updates" type="checkbox"><span>{{ t('register.updates') }}</span></label>
                </div>
              </div>
            </div>
            <div class="auth-actions">
              <button v-if="step > 1" type="button" class="button auth-back" @click="goTo(step - 1)">{{ t('register.back') }}</button>
              <button type="submit" class="button button-primary auth-submit">{{ t(step === STEPS ? 'register.submit' : 'register.next') }}</button>
            </div>
          </form>

          <div class="auth-done" :hidden="current !== 'done'">
            <span class="gate-icon"><AppIcon name="check-circle" /></span>
            <button type="button" class="button button-primary auth-submit" @click="close()">{{ t('auth.close') }}</button>
          </div>

          <p class="auth-foot" :hidden="current === 'done'">
            <span>{{ t(current === 'login' ? 'gate.register' : 'auth.haveAccount') }}</span>{{ ' ' }}<button type="button" class="link-button" @click="show(current === 'login' ? 'register' : 'login', true)">{{ t(current === 'login' ? 'shell.register' : 'shell.login') }}</button>
          </p>
        </div>
        <div class="auth-confirm" role="alertdialog" aria-modal="true" aria-labelledby="auth-confirm-title" :hidden="!confirming">
          <h3 id="auth-confirm-title" class="auth-title">{{ t('confirm.title') }}</h3>
          <p class="auth-text">{{ t('confirm.text') }}</p>
          <div class="auth-confirm-actions">
            <button type="button" class="button button-primary" @click="showConfirm(false)">{{ t('confirm.stay') }}</button>
            <button type="button" class="button" @click="close()">{{ t('auth.close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
