import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Prototype only: the accounts are fixed (ACCOUNTS in assets/shell.js, KTD9). The check runs in the browser and keeps nobody out of the files.
// The user is in localStorage['proto-user'], the key the static pages use, so a user signed in on a static page is signed in here.
export const ACCOUNTS: Record<string, string> = { lolovios: 'typosapo', odpein: 'typosapo', npizza: 'typosapo' }
export const USER_KEY = 'proto-user'

const read = () => {
  try { const user = localStorage.getItem(USER_KEY); return user && Object.hasOwn(ACCOUNTS, user) ? user : null } catch { return null }
}

export const useSessionStore = defineStore('session', () => {
  const user = ref<string | null>(read())
  const signedIn = computed(() => user.value !== null)
  // A wrong name or password, or storage that cannot be written, gives false and signs nobody in.
  const signIn = (name: string, password: string) => {
    const next = name.trim().toLowerCase()
    if (!Object.hasOwn(ACCOUNTS, next) || ACCOUNTS[next] !== password) return false
    try { localStorage.setItem(USER_KEY, next) } catch { return false }
    user.value = next
    return true
  }
  const signOut = () => {
    try { localStorage.removeItem(USER_KEY) } catch { /* storage is not available */ }
    user.value = null
  }
  // A sign-in or sign-out on another tab or a static page.
  const refresh = () => { user.value = read() }
  return { user, signedIn, signIn, signOut, refresh }
})
