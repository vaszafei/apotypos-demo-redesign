// A boolean as the 'true' / 'false' string of an aria attribute.
export const tf = (v: unknown): 'true' | 'false' => (v ? 'true' : 'false')
