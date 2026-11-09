// The drawer of log in and sign up (AuthDrawer.vue). One for the shell: a button anywhere asks for it with open('login') or open('register').
export type AuthView = 'login' | 'register'

export const useAuthDrawer = () => {
  const view = useState<AuthView | null>('auth-drawer-view', () => null)
  return { view, open: (next: AuthView = 'login') => { view.value = next } }
}
