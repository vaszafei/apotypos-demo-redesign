// A fixture of the prototype (public/data/<key>.json, made by scripts/build-fixtures.mjs) and its state: loading, ready, empty or error.
// The page passes the same rules as App.load: the required fields and when the body is empty. ?state=empty, ?state=error and ?state=bad force a state.
const fixtureOf = <T extends object>(route: ReturnType<typeof useRoute>, rules: FixtureRules<T>, { data: body, error, pending, refresh }: { data: Ref<unknown>, error: Ref<unknown>, pending: Ref<boolean>, refresh: () => Promise<void> }) => {
  const status = computed(() => fixtureStatus({
    ...rules,
    body: body.value,
    failed: !!error.value,
    pending: pending.value,
    forced: typeof route.query.state === 'string' ? route.query.state : null
  }))
  // Only a body that passed the rules is given to the page.
  const data = computed<T | null>(() => (status.value === 'ready' || status.value === 'empty' ? (body.value as T | null | undefined) ?? null : null))
  return { data, status, refresh }
}

// The page waits for the fixture (it is prerendered with it).
export const useFixture = async <T extends object>(key: string, rules: FixtureRules<T> = {}) => {
  const route = useRoute()
  return fixtureOf(route, rules, await useFetch<T>(`/data/${key}.json`, { key: `fixture:${key}` }))
}

// A page that is drawn in the browser only (ClientOnly) does not wait: the status is 'loading' until the fixture is there.
// `immediate: false` waits for refresh(): a fixture that a page needs only after the first ones are in does not share the connection with them.
export const useFixtureLazy = <T extends object>(key: string, rules: FixtureRules<T> = {}, options: { immediate?: boolean } = {}) =>
  fixtureOf(useRoute(), rules, useLazyFetch<T>(`/data/${key}.json`, { key: `fixture:${key}`, ...options }))
