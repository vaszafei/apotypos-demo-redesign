---
artifact_contract: "ce-handoff/v1"
created_at: "2026-10-29T16:43:41Z"
title: "Sidebar, transparent cards and page transitions: review and ship"
summary: "Implementation of the sidebar/cards/transitions plan is committed and verified on claude/sidebar-cards-transitions; code review, PR and compound step remain."
keywords: ["sidebar", "transparent-cards", "view-transitions", "nested-sub-tabs", "icons", "code-review", "pr"]
cwd: "/home/zafnitlab/Documents/apotypos-demo-redesign"
resume_focus: "Run /ce-code-review on the branch, apply justified findings, open the PR with ce-commit-push-pr, then /ce-compound."
repository: "vaszafei/apotypos-demo-redesign"
repo_root_sha: "845241736ed44ba5d26a3871a5922fb530f2fd52"
branch: "claude/sidebar-cards-transitions"
head: "8fc7c36dff08c622037b0d1d606db54e32ddfe9d"
---

# Handoff: sidebar, transparent cards and page transitions

The session stopped because of the context limit in `CLAUDE.md` (70%), just before the code review. Nothing is pushed yet.

## User intent (from the user, confirmed in a grilling session)

- The section sidebar should look like the OpenRouter and Fundamenta screenshots. The user chose only two things from them: the sidebar takes the page background, and each sub-tab gets an icon. Labels stay uppercase and the "/" marker stays.
- The home card treatment from commit 737bb17 applies to all cards: transparent, with the edge only on hover or focus.
- Top-bar (Section) navigation slides left or right. Sidebar (Sub-tab) navigation slides up or down.
- The user asked to move the nested sub-tabs (the underlined row inside Θέματα and similar pages) into the sidebar, so they slide up and down too.
- The user wants one branch and one PR.

All decisions and their provenance are in the plan's Key Decisions: `docs/plans/2026-10-29-1800-feat-sidebar-cards-transitions-plan.md`. Terms are in `GLOSSARY.md` (Section, Sub-tab, Nested Sub-tab, Detail page, Card).

## Commits on the branch (base `main` at 1d58741)

| Commit | Content |
|---|---|
| 99600c9 | docs: glossary and plan |
| 1f41ab3 | U1: cards. `--card-tint` token; card-colored halos, strokes and sticky cells moved to `--surface-page` |
| eebfe1d | U2–U4: sidebar background, 23 icons (`TAB_ICONS` in `assets/shell.js`), nested sub-tabs, `make-icons.py` updated |
| 8fc7c36 | U5: page transitions. `watchMoves`/`directionOf` in `assets/shell.js`, view-transition CSS at the end of the motion block in `assets/app.css`, `motion.js` glide on both axes, new `assets/page-move.js` in the `<head>` of every page |

## Deviations from the plan (my calls, not reviewed by the user yet)

- **`assets/page-move.js` (not in the plan).** When a move is pending, it holds the first frame with `<link rel="expect" blocking="render">` until the page is parsed. Without it, Chrome sometimes paints the loading skeleton before the body scripts run. `pagereveal` then fires before `Shell.start`, so the transition shows the skeleton with no direction. That failure was intermittent and was observed in tests. Pages opened directly are not held, and they still show the skeleton.
- **`motion.js` triggers the glide with a MutationObserver on `data-vt`, not a `pagereveal` listener.** A microtask queued in one `pagereveal` listener runs before the next listener, so it ran before the shell had set `data-vt`.
- **Wider card scope than KTD2 listed.** Chart halos, dot outlines, cell gaps and hollow marks that painted `--surface-raised` now paint `--surface-page`, including inline SVG in `overton-v2.html` and `outlet-v2.html`. `.outlet-card .dstat` lost its own border and tint. The `.story-grid .hero` gradient was removed.
- `.entity-grid .hero` keeps its ink top line on hover through a dedicated rule.

## Verification done (measured)

- U1 Playwright, signed in, 29 pages × `paper` and `night`: every card is transparent, and 232 inner tints differ from the page. Hover and focus edges, the sticky header, the info popover and the hero line were checked. PASS.
- U2–U4 Playwright: sidebar equals the body background in all 5 themes; icons match KTD4 and are 16×16; nested sub-tabs are correct on 4 pages; the parent click goes to the first nested item; at 390 px the row stays and there are no icons. PASS.
- U5 Playwright, run 3 times plus 2 more after the fixes:
  - Section slides in both directions, including Αρχική.
  - Sub-tab up/down including nested items, with the sidebar not animated.
  - Back and forward.
  - No slide for an outlet link, the footer, the home card link, or an in-section card link (narrative → gaza).
  - Same-tab reload and a stale record give no slide.
  - 390 px slides left/right.
  - Reduced motion has 0 translation.
  - PASS.
- The glide end position equals the link box, top-level and nested.
- `node ../docs/redesign/prototypes/scripts/visual-check.mjs` from `web/`: 336 loads, **No findings**. `pnpm check:visual` fails in this shell with a mise "no version for pnpm" error, so call node directly. The visual check serves on port 8765 itself, so stop any other server on 8765 first.
- Looked at screenshots: media 1440, coverage night, topics 1440 and 390, persons night, elections. Mid-slide frames of one Section move and one Sub-tab move were looked at with CDP playback at 10%.
- **Not run:** Safari. Firefox is expected to switch pages instantly.

## Not done

1. Code review. `ce-work`'s gate requires a `ce-code-review` receipt. `CLAUDE.md` step 4 asks for a reviewer agent that did not write the code. Planned invocation: `mode:agent base:main plan:<plan path>`.
2. Apply justified findings, then re-run the U1/U234/U5 scripts and the visual check.
3. `ce-commit-push-pr`, one PR. The PR body should state the deviations above and the verification.
4. `/ce-compound`. Candidate lessons:
   - a microtask in an event listener runs before the next listener;
   - cross-document view transitions on body-script pages need a render hold;
   - Playwright `hasText` is accent-sensitive for Greek uppercase labels;
   - the visual check owns port 8765.
5. `report.md` in this folder with the real results.

## Known, not touched

- The agenda matrix on `topics-v2.html?tab=agenda` is squeezed at 390 px. It is the same on `main`, so it predates this work.

## Machine-local state

- Test scripts: `/tmp/claude-1000/-home-zafnitlab-Documents-apotypos-demo-redesign/1622c464-f1c1-4086-ba56-b70e681f73c4/scratchpad/t/`. `u1.cjs`, `u234.cjs` and `u5.cjs` expect a server on 8765 from `docs/redesign/prototypes` and sign in via `localStorage proto-user`. The version-bump helper is `../bump.py`.
- A git worktree of `main` is at `.../scratchpad/main-wt`, served on port 8766. Remove it with `git worktree remove` when done.
