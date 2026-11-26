// The app shows only the days whose articles have times (14–27 Oct). October has no topics and no stance yet (#204, #214), so the pages built on them
// are hidden: left out of the nav and the search, and their route goes to Ιστορίες. Πρόσωπα is removed; its old routes go to Home.
export const HIDDEN_ROUTES = ['/trends', '/topic', '/media', '/media/writing']
export const GONE_ROUTES = ['/fingerprints', '/fingerprints/spread']

const bare = (path: string) => path.replace(/\/+$/, '') || '/'
export const isHidden = (path: string) => HIDDEN_ROUTES.includes(bare(path))
export const isGone = (path: string) => GONE_ROUTES.includes(bare(path))
// The kinds of the search index that lead to those pages.
export const HIDDEN_KINDS = ['topics', 'people']
