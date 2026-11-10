import type { Issue } from '~/types/topics'

// The part of data/mme.json that Μέσα › Επισκόπηση and Στάση read. od is 7 numbers per outlet and day: articles, news, cb known, cb yes, critical, neutral, supportive.
// oi is the articles of each topic per outlet as day, count pairs.
export interface MmeOutlet { name: string, slug: string, group: string | null }
export interface MmePerson { name: string, role: string | null, party: string | null }
// A story of the set: t is the flat triples [outlet, day, articles]. A lite story has o, the flat pairs [outlet, articles] over the whole window.
export interface MmeStory { el: string, en: string, issue: number, generic?: boolean, t: number[] }
export interface MmeLiteStory { el: string, en: string, issue: number, o: number[] }
// headlines[k] are [day, title, url, angle, frame, story]; attacks[k] are [from, to, statements].
export type MmeHeadline = [string, string, string | null, string | null, number, string | null]
// The rest is what the page of one outlet reads: os is [day, critical, neutral, supportive] per outlet and topic, of the frames of the outlet [day, n], osec the articles per section,
// q the quotes of each person by day (pairs), mt the tone about each person (rows [day, critical, neutral, supportive]).
export interface MmeSet {
  country: string, dates: string[], outlets: MmeOutlet[], issues: Issue[], od: number[][], oi: number[][][]
  os: number[][][], of: number[][][], osec: number[][], frames: string[], sections: string[], people: MmePerson[]
  q: number[][][], mt: number[][][], attacks: [string, string, number][][], headlines: MmeHeadline[][]
  stories: MmeStory[], lite: MmeLiteStory[]
}
export interface MmeData { updatedAt: string, sets: Record<string, MmeSet> }

export interface MmeOutletSum extends MmeOutlet {
  k: number
  n: number
  news: number
  // Articles with a clickbait score, and those scored as clickbait.
  cbKnown: number
  cbYes: number
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

// The whole window of the set, with what the page of an outlet reads: its quotes and tone for each person, and every story with its articles for each outlet.
export interface MmeProfileOutlet extends MmeOutletSum { quotes: number[], tone: number[][] }
export interface MmeProfileStory { el: string, en: string, issue: number, generic: boolean, per: number[], n: number, reach: number }
export interface MmeProfile extends Omit<MmeSummary, 'outlets' | 'active'> {
  outlets: MmeProfileOutlet[]
  active: MmeProfileOutlet[]
  stories: MmeProfileStory[]
  personQuotes: number[]
}

// A block of the group tiles (a group and its outlets) and a dot of the stance map.
export interface TileGroup { name: string | null, label: string, color: string, slug: string | null, n: number, outlets: { name: string, slug: string, n: number }[] }
export interface StancePoint { name: string, c: number, u: number, s: number, n: number, color: string }
