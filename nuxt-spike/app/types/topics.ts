export interface Issue { el: string, en: string, soft: boolean, catchAll: boolean }
export interface TopicsData { dates: string[], issues: Issue[], issueDaily: (number | null)[][] }
export interface TopicRow { k: number, issue: Issue, daily: (number | null)[], count: number, change: number | null }
export interface Series { key: string, name: string, color: string, values: number[] }
