# Prompt: Nuxt spike (Θέματα)

User question (2026-11-09/10): would a proper Nuxt + Vue + Tailwind app be better than the static HTML prototypes for performance, transitions, display, and for working with Claude? After the discussion: "continue with the best practices".

## Task

A throwaway spike on branch `claude/nuxt-spike`, in `nuxt-spike/` (not `web/`, not the prototypes). Port **Αναλύσεις/Μέσα › Θέματα** (`docs/redesign/prototypes/topics-v2.html`) as a Nuxt 4 page and compare it with the static page.

Best practices chosen: Nuxt 4, Vue 3 `<script setup lang="ts">`, Nuxt UI 4 on Tailwind 4, Pinia for the period state, composables with named exports, tokens from `assets/tokens.css` kept as the source of colors, d3-scale/d3-shape for the SVG charts, data as JSON loaded per route.

## Scope

- Layout: top bar, sidebar (stays mounted between routes), page transition.
- Page Θέματα: donut + list, lines chart, movers list, date range.
- A second route (stub) to test going between pages.
- Not in scope: other pages, English, the sign-in gate, the shifts card.

## Compare (against the static page, 1440 and 390)

First-load JS size, page-change time, look vs screenshot, lines of code, reusable parts.

## Rules

Small commits, draft PR, Netlify is not changed (the preview of the spike is local only unless asked). Report in `report.md` with real numbers.
