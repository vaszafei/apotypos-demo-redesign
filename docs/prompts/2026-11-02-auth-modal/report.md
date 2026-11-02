# Report: auth modal (2026-11-02)

Branch `claude/auth-modal`. Plan: `docs/plans/2026-11-02-1000-feat-auth-modal-plan.md`.

## What changed
- `assets/shell.js`: `openAuth` now builds a centred modal (log in, sign up, success screen, close confirmation). The drawer code is gone. The three callers are unchanged.
- `assets/app.css`: the drawer, the pill switch and the old `.login-form` rules are replaced by the modal, the fields, the reason chips, the dropdowns, the checkboxes and the phone layout.
- `assets/tokens.css`: new token `--scrim` (dark in all themes).
- `assets/messages.js`: new keys in `el` and `en`; `auth.switch` and `register.soon` removed.
- `assets/icons.js`: `eye`, `eye-slash`, `check-circle`.
- All 29 pages: `shell.js` 53 to 54, `app.css` 37 to 38, `messages.js` 32 to 33, `icons.js` 8 to 9, `tokens.css` 11 to 12.
- `GLOSSARY.md`: Account, Gate, Auth modal, Sign-up request.

## Measured
- Browser script (Playwright, Chrome, scratchpad, not committed): 52 checks, 52 passed, 0 console errors. It covered:
  - opens from the navbar and from both gate buttons
  - page behind inert, focus on the first field, Tab and Shift+Tab stay inside (12 presses each way)
  - Esc closes log in and focus returns to the opener
  - a scrim click closes log in and does not close sign up
  - wrong password shows the red box; `lolovios` / `typosapo` logs in
  - the empty sign-up form shows 7 errors and focuses the name; each error clears on change
  - an invalid email fails, 7 password characters fail, 8 pass
  - the eye toggles the password; chips are multi-select; "Άλλο" opens a required text field; terms are required
  - Esc with input asks to confirm; focus stays inside the confirmation; Συνέχεια keeps the data; Κλείσιμο closes
  - a valid form shows the success screen; log in and sign up keep what was typed when you switch
  - the modal is 520 px wide and centred at 1440, fills 390x844, fits 1440x700 (the form scrolls inside); no horizontal scroll
- Visual check (`node ../docs/redesign/prototypes/scripts/visual-check.mjs`): 336 loads (42 pages x 4 widths x paper and night), 170 s, no findings.

## Looked at (screenshots)
Log in at 1440 (paper), sign up at 1440 in paper, night and terra, the errors state, the filled form, the success screen and the confirmation (paper), sign up at 390 (paper and night), and the English sign up (paper).

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

## For the Nuxt port
- The terms and privacy text is not a link: no such pages exist.
- Sign up answers are dropped. The real port needs the backend, the approval flow and the email.
