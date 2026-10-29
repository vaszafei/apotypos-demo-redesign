# Report: sidebar, cards and transitions

Branch `claude/sidebar-cards-transitions`, base `main` at 1d58741. Session 1 built U1–U5 (see `handoff.md`). Session 2 reviewed and fixed the work and wrote the learning.

## Commits

| Commit | Content |
|---|---|
| 99600c9 | docs: glossary and plan |
| 1f41ab3 | U1 cards |
| eebfe1d | U2–U4 sidebar background, icons, nested sub-tabs |
| 8fc7c36 | U5 page transitions |
| 8825985 | fix: review findings 1–4 below |

## Code review (session 2)

`/ce-code-review mode:agent base:main plan:docs/plans/2026-10-29-1800-feat-sidebar-cards-transitions-plan.md`

- Depth: focused (121 executable lines changed, small band, no hard floor). My own correctness read, plus one separate adversarial reviewer agent.
- Cross-model pass: not run. No codex, grok, antigravity or cursor CLI is installed, so the adversarial reader was Claude too.
- Plan: R1–R13 and U1–U5 are all addressed.
- Verdict: Ready with fixes. All 4 findings were fixed in 8825985.

| # | Sev | Finding | How it was confirmed |
|---|---|---|---|
| 1 | P2 | Back/Forward to or from methodology, pages or 404 (no route) threw `Cannot read properties of undefined (reading 'startsWith')` in `pagereveal` | Playwright: media → methodology (footer) → Back. The error showed on both pages. After the fix: no error. |
| 2 | P2 | A move started while scrolled: the old picture jumped about 80 px down before it slid | Media scrolled 1400 px, click Ιδιοκτησία, CDP playback 5%. Before the fix the table title moved from y 89 to 171. After: y 83, moving up. |
| 3 | P3 | Pages with nested sub-tabs kept the empty page head's margins at ≥1024 px | Title top: topics, narrative and gaza at 68 px vs 56 px on war, stories and elections. After the fix: all 56 px. |
| 4 | P3 | `skipTransition()` left an unhandled "Transition was skipped" rejection | Playwright `pageerror` on methodology. After the fix: none. |

Residual, not fixed:

- Safari 18.2+ may fire `pagereveal` before `shell.js` has registered its listener. There is no Safari on this machine, so this is not tested.
- A host that rewrites URLs (pretty URLs, `index.html` → `/`) would make `move.href !== location.href`, and every move would stop sliding. Not checked against the deployed site.

## Verification after the fixes

- `u1.cjs`: PASS (29 pages × 2 themes, 232 inner tints checked)
- `u234.cjs`: PASS U2–U4
- `u5.cjs`: PASS U5
- `node ../docs/redesign/prototypes/scripts/visual-check.mjs` (from `web/`): 336 loads (42 pages × 4 widths × 2 themes) in 161 s, **No findings**
- Not run: Safari, Firefox.

## Learning

`docs/solutions/design-patterns/cross-document-view-transitions-on-script-drawn-pages.md` (lightweight `ce-compound`): render hold, listener order, the old picture's offset, the routeless guard, the skipped-transition rejection.

Not written up: Playwright `hasText` is accent-sensitive for Greek uppercase labels, and the visual check serves on port 8765 itself.
