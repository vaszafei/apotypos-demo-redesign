// The number and date formats of the prototype (App.fmt in assets/components.js).
const int = new Intl.NumberFormat('el-GR')
const pct = new Intl.NumberFormat('el-GR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signed = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' })
const short = new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const long = new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const utc = (s: string) => new Date(`${s}T00:00:00Z`)

export const fmtInt = (v: number) => int.format(v)
export const fmtPct = (v: number) => pct.format(v)
export const fmtSigned = (v: number) => signed.format(v).replace('-', '−')
export const fmtDay = (iso: string) => short.format(utc(iso))
export const fmtDate = (iso: string) => long.format(utc(iso))
export const fmtMonth = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('el-GR', { ...opts, timeZone: 'UTC' }).format(utc(iso))
export const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(raw || 1))
  return ([1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw)) ?? p * 10
}
