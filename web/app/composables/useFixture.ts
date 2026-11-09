// A fixture of the prototype (public/data/<key>.json, made by scripts/build-fixtures.mjs) and its state: loading, ready, empty or error.
// The page passes the same rules as App.load: the required fields and when the body is empty. ?state=empty, ?state=error and ?state=bad force a state.
export const useFixture = async <T extends object>(key: string, rules: FixtureRules<T> = {}) => {
  const route = useRoute()
  const { data: body, error, pending, refresh } = await useFetch<T>(`/data/${key}.json`, { key: `fixture:${key}` })
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
