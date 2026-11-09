# Apotypos demo redesign

A Nuxt app that serves the redesign prototypes. Netlify builds it. The pages move from static HTML into Nuxt one by one (`docs/plans/2026-11-09-1742-refactor-nuxt-app-migration-plan.md`).

- `docs/redesign/prototypes/` holds the static prototype pages, data and assets. It is the one source of the CSS, fonts and data.
- `web/` holds the Nuxt app. `npm run generate` copies the pages that are not ported yet to `web/public/` and runs `nuxt generate`. `web/ported-pages.json` lists the pages that are Nuxt pages; their old URLs redirect to the Nuxt route.

Deploy: set the Netlify base directory to `web`. `web/netlify.toml` sets the rest.
