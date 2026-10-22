# Apotypos demo redesign

A static Nuxt app that serves the redesign prototypes. Netlify builds it.

- `docs/redesign/prototypes/` holds the prototype pages, data and assets.
- `web/` holds the Nuxt app. `pnpm generate` copies the prototypes to `web/public/` and runs `nuxt generate`.

Deploy: set the Netlify base directory to `web`. `web/netlify.toml` sets the rest.
