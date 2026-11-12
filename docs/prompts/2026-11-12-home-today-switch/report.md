# Home «Η επικαιρότητα»: cards by the calendar, outlet ring, stories/themata switch

Prompt (user, 2026-11-12, with `/ce-handoff resume docs/prompts/2026-11-12-home-today/handoff.md`): move the top stories to begin next to the calendar; add correctly the rings of outlets and not themata; add a switch tab above the best story where the Plegma transforms smoothly from the stories of the day to the themata of the day, and the cards too. Then "go and open pr".

## What was built (my reading, not confirmed by the user)
- The right column (switch, «Ιστορία της ημέρας», «Ιστορίες της ημέρας») spans both grid rows, so it starts at the level of the calendar (`.home-today-side` in `plegma.css`).
- Form «Ιστορίες της ημέρας» (default): stories around the date, the ring has one arc per outlet of the day in the color of its group (`dayOutlets` in `HomeToday.vue`). Form «Θέματα της ημέρας»: the previous web (date, themes, stories, dots) and the ring of themes. Nodes of a story and its dots are matched between the two layouts (`storiesAsThemes`, `matchWebs` in `plegma-day.ts`), so the switch moves them, fades the theme nodes, faint dots and labels, and cross-fades the rings (`PlegmaDayWeb.vue`, `form`).
- Cards: the themes form has «Θέμα της ημέρας» (name, articles, stories, share, bar of the outlets, link to the topic) and the list «Θέματα της ημέρας»; a theme is picked from the list, a node or an arc. The two pairs fade into each other.
- New messages are in `docs/redesign/prototypes/assets/messages-home.js` (`home.mode.*`, `home.theme.*`, `home.themes.*`); `i18n/locales` are generated and untracked (`node scripts/build-messages.mjs`).

## Checked
- `nuxt typecheck` exit 0, `npm test` 175 pass.
- Headless Chromium at 1918×960 on the dev server: 27 Oct and 12 Sep, both forms, no console errors; a frame 350 ms after the click shows the web already moving.

## Not checked
- Safari, Firefox, phones (<1024: the switch sits above the cards in the stacked layout, not looked at), night theme, reduced motion by eye, the hero ↔ section walk with the new form.
- 18–27 Oct have one gray «Άλλα» theme, so the themes form is nearly empty there (data, not a bug).
- Open question to the user: «top stories» was read as the whole right column; the ring of outlets has one arc per outlet (largest first), not grouped by group.
