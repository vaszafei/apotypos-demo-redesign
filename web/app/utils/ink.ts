// The text color on a colored circle (Dash.textOn, Dash.tint): the one of the two ink colors with the better contrast.
const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const tintHex = (hex: string, k: number) => `#${channels(hex).map(v => Math.round(v * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('')}`
export const inkOn = (fill: string, dark: string, light: string) => {
  const l = luminance(fill)
  return (l + 0.05) / (luminance(dark) + 0.05) >= (luminance(light) + 0.05) / (l + 0.05) ? dark : light
}
// A token written as var(--name) or --name, or null when it is something else.
export const tokenName = (value: string) => value.match(/^(?:var\()?(--[\w-]+)\)?$/)?.[1] ?? null
