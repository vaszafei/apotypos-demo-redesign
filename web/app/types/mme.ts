import type { Issue } from '~/types/topics'

// The part of data/mme.json that Μέσα › Επισκόπηση and Στάση read. od is 7 numbers per outlet and day: articles, news, cb known, cb yes, critical, neutral, supportive.
// oi is the articles of each topic per outlet as day, count pairs.
export interface MmeOutlet { name: string, slug: string, group: string | null }
export interface MmeSet { country: string, dates: string[], outlets: MmeOutlet[], issues: Issue[], od: number[][], oi: number[][][] }
export interface MmeData { updatedAt: string, sets: Record<string, MmeSet> }

export interface MmeOutletSum extends MmeOutlet {
  k: number
  n: number
  news: number
  issues: number[]
  stance: [number, number, number]
}
export interface MmeSummary {
  set: MmeSet
  i0: number
  i1: number
  outlets: MmeOutletSum[]
  active: MmeOutletSum[]
  issueN: number[]
  newsN: number
  total: number
  hard: boolean[]
}
