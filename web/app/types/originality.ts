// data/originality.js: the share of original articles of each outlet in its own period (Sep 2025 to Jan 2026). pct and anonPct are percents; lagMin is the median lag in minutes.
export interface OriginalityOutlet { name: string, scored: number, originals: number, rewrites: number, pct: number, lagMin: number, anonPct: number }
export interface OriginalityData { readAt: string, window: [string, string], outlets: OriginalityOutlet[] }
