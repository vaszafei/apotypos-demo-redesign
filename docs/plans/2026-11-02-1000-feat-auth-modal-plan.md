---
title: Auth modal with a full sign-up form - Plan
type: feat
date: 2026-11-02
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Auth modal with a full sign-up form - Plan

## Goal Capsule

- **Objective:** Log in and sign up open in a centred modal that looks professional, and sign up collects who the person is, why they want access and how they found apotypos, so new accounts can be vetted.
- **Means:** Replace the drawer in `shell.js` and `app.css` with a modal built once with two views (log in, sign up) and a success screen. Sign up is a 3-step walkthrough (account, about you, how you found us) with per-step validation.
- **Authority:** This plan, then `GLOSSARY.md` (Account, Gate, Auth modal, Sign-up request), then `docs/solutions/` (theme tokens only, shared-asset checklist).
- **Stop conditions:** Stop and report if a page gains horizontal scroll or a console error, if focus can leave the modal, or if the modal is unreadable in any of the five themes.
- **Execution profile:** Plain JS and CSS in `docs/redesign/prototypes/assets/`, no build step. Proof is browser runs: a Playwright script in the scratchpad plus the visual check.
- **Finish and ship:** One PR from `claude/auth-modal`. The user merges.

---

## Product Contract

### Summary

The side drawer is gone. Every entry point (navbar buttons, phone menu, both buttons of the gate card) opens a centred modal. Log in behaves as before. Sign up is three short steps (account; about you; how you found us and the terms) with a progress bar, and ends on an "awaiting approval" screen.

### Requirements

- R1. One modal replaces the drawer: centred card of 520 px, full-screen sheet below 640 px, dimmed and blurred scrim, short fade and scale-up (a fade only with reduced motion).
- R2. Logo on top, a title and one line of text, a close button, and a bottom link that switches view ("Δεν έχετε λογαριασμό; Εγγραφή" / "Έχετε ήδη λογαριασμό; Σύνδεση"). The pill switch is removed.
- R3. Log in keeps username, password, the 3 fixed accounts, the red error box and the page redraw. A click on the scrim closes it.
- R4. Sign up is three steps with "Βήμα n από 3", a progress bar, Πίσω and Συνέχεια; each step is checked before the next opens, and the last step checks all three. The modal keeps one height on every step. Step 1: name, email, password. Step 2: job, organisation, reasons. Step 3: how you found us, terms, updates. Fields: name, email, password with a show/hide button and the hint "Τουλάχιστον 8 χαρακτήρες"; job (required dropdown); organisation (optional); reason for use (multi-select chips, at least one); how you found us (required dropdown, "Άλλο" opens a required text field); terms checkbox (required, underlined text that is not a link); updates checkbox (optional, off).
- R5. Validation on submit: a message under each wrong field, the first wrong field focused, native bubbles off. Messages clear when the field changes.
- R6. A valid submit shows a success screen ("we'll email you when your account is approved") with one Κλείσιμο button. Nothing is stored.
- R7. Sign up closes only with X or Esc. If the form has input, a confirmation ("Να κλείσει; Θα χαθούν τα στοιχεία") comes first. A click on the scrim does nothing there. Switching to log in and back keeps what was typed.
- R8. The page behind is inert, focus is trapped, Esc works, and focus returns to the opener on close. The page behind does not scroll under the modal.
- R9. Greek and English strings. Theme tokens only. Readable in `paper`, `fog`, `terra`, `night` and `midnight`.

### Scope Boundaries

- No backend, no saved answers, no real terms or privacy pages (the text is not a link; note for the Nuxt port).
- No Google button and no forgot-password.
- The gate card, the navbar and the user menu do not change.

### Key Decisions

- The modal replaces the drawer, with no flag. (session-settled: user-directed — chosen over keeping both behind `?auth=modal`: the user wanted a replacement.)
- Three short steps, not one long form. (session-settled: user-directed — chosen over one long form: after seeing the one-form version the user said professional apps do not show all of that at once. This replaced an earlier one-form decision.)
- Sign-up submit shows a success screen and stores nothing. (session-settled: user-approved — chosen over saving to the browser: no backend is in scope.)

---

## Implementation Plan

### Key Technical Decisions

- KTD1. Build both views once and toggle `hidden`, so switching keeps the typed values (R7). The sign-up steps are panels of one form, so going back keeps the data too. The success screen and the close confirmation are further blocks in the same panel.
- KTD2. One overlay element holds the scrim and centres the panel. A click on the overlay itself (not the panel) closes only when the view is log in. A `wheel` / `touchmove` listener on the overlay stops the page behind from scrolling (R8); the panel has `overscroll-behavior: contain`.
- KTD3. The close confirmation is a layer inside the panel, not `window.confirm`. While it shows, the form block is `inert`, and the focus trap ignores inert elements.
- KTD4. Dropdowns are native `<select>` elements with the chevron icon over them, so they stay accessible and work on phones. Reason chips are `button`s with `aria-pressed`, styled as the site's selected state (accent tint and accent border).
- KTD5. New icons (`eye`, `eye-slash`, `check-circle`) are added to `assets/icons.js`, not drawn inline.
- KTD6. The scrim and shadows use `color-mix` on theme tokens. The old drawer's literal `rgba(17,17,17,…)` goes away with it.

### Implementation Units

- U1. **Modal markup and behaviour** — `docs/redesign/prototypes/assets/shell.js`
  Replace `openAuth` with the modal. Remove the drawer. Keep the signature `openAuth(view)` so the three callers stay as they are. Sign-up option lists live next to it as arrays of keys.
  Test file: Playwright script in the session scratchpad (the prototypes have no test suite).
  Scenarios: opens from navbar, phone menu and both gate buttons; Esc closes log in; focus returns to the opener; Tab and Shift+Tab stay inside; wrong password shows the red box; `lolovios` / `typosapo` logs in and the gate opens; empty sign-up shows all errors and focuses the name; each error clears on change; password of 7 characters fails and 8 passes; "Άλλο" source shows the text field and requires it; a valid form shows the success screen and Κλείσιμο closes it; sign-up with input and Esc shows the confirmation, "Συνέχεια" keeps the data, "Κλείσιμο" closes; a scrim click closes log in but not sign up; log in → sign up → log in keeps typed values.

- U2. **Modal styles** — `docs/redesign/prototypes/assets/app.css`
  Replace the drawer block with the modal, fields, chips, selects, checkboxes, error text, success screen and confirmation. Restyle `.login-form` in place (sentence-case 13px labels, 44px fields, 10px radius). Remove `.auth-switch`, `.auth-head`, `.login-notice`, `.auth-drawer`. Phones below 640 px: full screen, sticky submit row.

- U3. **Strings and icons** — `assets/messages.js`, `assets/icons.js`
  Add the new keys in `el` and `en`. Remove `auth.switch` and `register.soon`. Add the three icons.

- U4. **Cache-bust** — all `*.html` in `docs/redesign/prototypes/`
  Bump `shell.js`, `app.css`, `messages.js`, `icons.js` to highest + 1 on all 29 pages.

- U5. **Proof and record** — `docs/prompts/2026-11-02-auth-modal/report.md`
  Run the scratchpad script and `visual-check.mjs`. Screenshots of the modal at 1440 and 390 px in `paper` and `night`, for log in, sign up (empty, with errors) and success. The report says what was measured and what was looked at.

### Dependencies and Sequencing

U3 first (strings, icons), then U1 and U2 together, then U4, then U5. One commit per unit group, conventional messages.

### Risks

- Focus trap and `inert` on `#app` are easy to break; the script tests Tab at both ends.
- A tall sign-up form on a short laptop screen: the panel scrolls inside and stays within the screen; check at 1440×700.
- Greek labels can be long in English-to-Greek swaps; check 390 px for wrapping.

### Out of Scope for This Plan

- Real terms and privacy pages, a backend, email, and the Nuxt port.
