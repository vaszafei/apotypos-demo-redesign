const int = new Intl.NumberFormat('el-GR')
const pct = new Intl.NumberFormat('el-GR', { style: 'percent', maximumFractionDigits: 1 })
const signed = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
const day = new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short' })

export const fmtInt = (v: number) => int.format(v)
export const fmtPct = (v: number) => pct.format(v)
export const fmtSigned = (v: number) => signed.format(v)
export const fmtDay = (iso: string) => day.format(new Date(`${iso}T00:00:00`))
export const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(raw || 1))
  return ([1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw)) ?? p * 10
}
