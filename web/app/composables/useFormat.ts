// The number and date formats of the prototype (App.fmt in assets/components.js).
const int = new Intl.NumberFormat('el-GR')
const pct = new Intl.NumberFormat('el-GR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dec = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signed = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' })
// Numbers always use the Greek style (C12). Dates follow the active language (fmt.date: el-GR, or en-GB).
const dates = (opts: Intl.DateTimeFormatOptions) => {
  const formats = { 'el-GR': new Intl.DateTimeFormat('el-GR', { ...opts, timeZone: 'UTC' }), 'en-GB': new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }) }
  return (d: Date) => formats[useNuxtApp().$i18n.locale.value === 'en' ? 'en-GB' : 'el-GR'].format(d)
}
const short = dates({ day: 'numeric', month: 'short' })
const long = dates({ day: 'numeric', month: 'short', year: 'numeric' })
const utc = (s: string) => new Date(`${s}T00:00:00Z`)

export const fmtInt = (v: number) => int.format(v)
export const fmtPct = (v: number) => pct.format(v)
export const fmtDec = (v: number) => dec.format(v)
export const fmtPct0 = (v: number) => `${Math.round(v * 100)}%`
export const fmtSigned = (v: number) => signed.format(v).replace('-', '−')
export const fmtDay = (iso: string) => short(utc(iso))
export const fmtDate = (iso: string) => long(utc(iso))
export const fmtMonth = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(useNuxtApp().$i18n.locale.value === 'en' ? 'en-GB' : 'el-GR', { ...opts, timeZone: 'UTC' }).format(utc(iso))
export const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(raw || 1))
  return ([1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw)) ?? p * 10
}
