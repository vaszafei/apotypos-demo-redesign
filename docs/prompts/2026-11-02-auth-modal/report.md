# Report: auth modal (2026-11-02)

Branch `claude/auth-modal`. Plan: `docs/plans/2026-11-02-1000-feat-auth-modal-plan.md`.

## Second change after review: back to the drawer
The user asked to go back to the side drawer and asked why the type and sizes of the new UI differed from the app. Measured in the browser: the font family was already `IBM Plex Sans` everywhere (the `--font-text` token). The differences were in size, weight and case: 13 px literals (the app scale is 12 and 14 px), sentence-case 600-weight labels (the app and the old login form use 12 px uppercase 700 with 0.08em), 44 px fields with a 10 px radius (the app uses 40 px and 8 px), and a 20 px title (the old drawer used the 28 px heading token). Those values came from my own design proposal and were not taken from the existing styles. They are replaced by the app's own sizes. The drawer is 420 px, full height, from the right, over the `--scrim`; the 3 steps stay inside it. Assets bumped again (`shell.js` 56, `app.css` 40). Browser script: 68 of 68 after removing the obsolete "no drawer" check; visual check: 336 loads, no findings.

## Change after review
The first version showed the whole sign-up in one form. The user rejected it (a professional app does not ask all of that at once). Sign up is now 3 steps: 1) name, email, password; 2) job, organisation, reasons; 3) how you found us, terms, updates. Progress bar and "Βήμα n από 3", Πίσω and Συνέχεια, each step validated, the last step re-checks all three, and the modal stays 635 px tall on every step at 1440 (measured: 635, 635, 635, 635 including the "Άλλο" field). Assets bumped again (`shell.js` 55, `app.css` 39, `messages.js` 34).

## What changed
- `assets/shell.js`: `openAuth` now builds a centred modal (log in, sign up, success screen, close confirmation). The drawer code is gone. The three callers are unchanged.
- `assets/app.css`: the drawer, the pill switch and the old `.login-form` rules are replaced by the modal, the fields, the reason chips, the dropdowns, the checkboxes and the phone layout.
- `assets/tokens.css`: new token `--scrim` (dark in all themes).
- `assets/messages.js`: new keys in `el` and `en`; `auth.switch` and `register.soon` removed.
- `assets/icons.js`: `eye`, `eye-slash`, `check-circle`.
- All 29 pages: `shell.js` 53 to 54, `app.css` 37 to 38, `messages.js` 32 to 33, `icons.js` 8 to 9, `tokens.css` 11 to 12.
- `GLOSSARY.md`: Account, Gate, Auth modal, Sign-up request.

## Measured
- Browser script (Playwright, Chrome, scratchpad, not committed): 69 checks, 69 passed, 0 console errors (after the change to steps). It covered:
  - opens from the navbar and from both gate buttons
  - page behind inert, focus on the first field, Tab and Shift+Tab stay inside (12 presses each way)
  - Esc closes log in and focus returns to the opener
  - a scrim click closes log in and does not close sign up
  - wrong password shows the red box; `lolovios` / `typosapo` logs in
  - the empty step 1 shows 3 errors and focuses the name; step 2 shows 2; step 3 requires source and terms; each error clears on change; a field cleared after going back is caught on the last step
  - Πίσω keeps the data; Enter on the last step submits
  - an invalid email fails, 7 password characters fail, 8 pass
  - the eye toggles the password; chips are multi-select; "Άλλο" opens a required text field; terms are required
  - Esc with input asks to confirm; focus stays inside the confirmation; Συνέχεια keeps the data; Κλείσιμο closes
  - a valid form shows the success screen; log in and sign up keep what was typed when you switch
  - the modal is 520 px wide and centred at 1440, fills 390x844, fits 1440x700 (the form scrolls inside); no horizontal scroll
- Visual check (`node ../docs/redesign/prototypes/scripts/visual-check.mjs`), run again after the change: 336 loads (42 pages x 4 widths x paper and night), 203 s, no findings.

## Looked at (screenshots)
Before the change to steps: log in at 1440 (paper), the one-form sign up in paper, night, terra and English, and 390 px. After the change: steps 1, 2 and 3 at 1440 (paper). Not looked at again after the change: the step screens in night, terra, English and at 390 px (measured by the script only), the success screen and the confirmation.

## Not checked
- `fog` and `midnight` were loaded and measured but their screenshots were not opened.
- Safari and Firefox were not tested (`backdrop-filter` has a prefix for Safari).
- The phone menu entry point was exercised only through the 390 px screenshots of the script (it opens the modal there); no real device.
- No screen reader test.
- `ce-doc-review` was not run on the plan, and no separate code review agent has looked at the code yet.

## Problems found on the way
- The names `.chip`, `.check` and `.field` already existed in the shared CSS. A sed edit rewrote the old `.check` rule before I saw it. It was restored and the new classes were renamed (`.reason-chip`, `.auth-check`, `.auth-field`). See `docs/solutions/workflow/check-class-names-against-shared-css.md`.
- The password hint and the password error had the same text; the hint now hides while the error shows.
- The close button floated over scrolled fields; the logo and the button now sit in a head that does not scroll.
- The first reading of "walkthrough" was wrong: I dropped the steps and built one long form. The user caught it on the deploy preview.

## For the Nuxt port
- The terms and privacy text is not a link: no such pages exist.
- Sign up answers are dropped. The real port needs the backend, the approval flow and the email.
