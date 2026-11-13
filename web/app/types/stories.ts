export interface StoryIssue { el: string, en: string, soft: boolean, catchAll: boolean }
// days: pairs of [day index, articles]. A generic story ("Άλλα διεθνή") is a bucket, not a story.
export interface Story { id: number, el: string, en?: string, issue: number, outlets: number, generic: boolean, days: number[] }
export interface StoriesData { dates: string[], issues: StoryIssue[], stories: Story[], updatedAt: string }
export interface StoryDay { s: Story, n: number }
