export type FixtureStatus = 'loading' | 'ready' | 'empty' | 'error'

export interface FixtureRules<T = any> {
  // Fields that must be present (not null or undefined) in the body.
  required?: string[]
  // True when the body has nothing to show.
  isEmpty?: (body: T) => boolean
}

export interface FixtureInput<T = any> extends FixtureRules<T> {
  body: unknown
  // The request failed.
  failed?: boolean
  pending?: boolean
  // The ?state= of the page: error, empty or bad (the body {}), the same as App.load of the prototype.
  forced?: string | null
}

// The rule of App.load (assets/components.js): each fixture is ready, empty or error.
export const fixtureStatus = ({ body, failed = false, pending = false, forced = null, required = [], isEmpty }: FixtureInput): FixtureStatus => {
  if (forced === 'error' || failed) return 'error'
  if (pending && body == null) return 'loading'
  const value = forced === 'bad' ? {} : body
  if (!value || typeof value !== 'object') return 'error'
  const record = value as Record<string, unknown>
  if (!required.every(field => record[field] !== null && record[field] !== undefined)) return 'error'
  if (forced === 'empty') return 'empty'
  try {
    return isEmpty?.(value) ? 'empty' : 'ready'
  } catch {
    return 'error'
  }
}
