---
title: Prove a file move changes nothing by diffing the prerendered HTML of every route
date: 2026-11-13
category: workflow
module: web
problem_type: workflow_issue
component: development_workflow
severity: low
applies_when:
  - moving components or utils into folders, renaming files, changing import paths
tags: [refactor, ssr, nuxt, components, verification]
---

# Prove a file move changes nothing by diffing the prerendered HTML of every route

## Guidance
1. Before the move: `npm run generate`, copy every `.output/public/**/index.html` to a scratch folder.
2. Move the files. In `nuxt.config.ts` set `components: [{ path: '~/components', pathPrefix: false }]`, so `components/charts/BarList.vue` is still `<BarList>` and no template changes. For utils in a subfolder, add `imports: { dirs: ['utils/plegma'] }`; Nuxt scans only the top level of `utils/`.
3. Update what names a path: `~/components/X.vue` type imports, relative imports between utils, the tests in `web/scripts/*.test.mjs`, and `(utils/x.ts)` mentions in comments. A script that resolves each import against the file's old location and rewrites it is safer than sed; also catch imports with no extension (`~/utils/plegma-day`).
4. After: `npm run typecheck`, `npm test`, `npm run generate`, then compare each route's HTML after removing what changes on every build: `_nuxt/*.js|css` hashes, `_b=` query, `buildId`, the 13-digit timestamp, and `data-v-xxxxxxxx` (scoped-style hashes come from the file path). 11 of 11 routes were identical.
5. Prerendered HTML does not prove hydration. Also open every route in a browser and collect `pageerror` and console errors.

## Why
The pages have no component tests. A moved file that breaks an import fails only on a page someone opens.
