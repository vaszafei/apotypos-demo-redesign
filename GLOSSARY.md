# apotypos demo

The redesign prototypes of apotypos: pages that show how Greek media cover the news, organised by section.

## Navigation

**Section**:
An entry of the top bar (Αρχική, Μέσα, Ιστορίες, Πρόσωπα, Πολιτική, Αναλύσεις). Each section is a group of pages.
_Avoid_: top bar tab, item

**Sub-tab**:
A page of a section, listed in the sidebar on wide screens (for Μέσα: Επισκόπηση, Ιδιοκτησία, Θέματα, Πώς γράφουν, Ομοιότητα).
_Avoid_: tab, sidebar tab

**Nested Sub-tab**:
A page of a sub-tab, listed under it in the sidebar (for Θέματα: Επισκόπηση, Ένα θέμα, Ατζέντα μέσων, Μετατοπίσεις).
_Avoid_: page tab, third-level tab

**Detail page**:
A page about one thing (a story, an outlet, a group, a person) that belongs to a section but is not one of its sub-tabs.
_Avoid_: entity page

## Layout

**Card**:
A box on a page that holds one chart, table or set of figures.
_Avoid_: panel, tile, widget

## Access

**Account**:
A login that gives access to Αναλύσεις. A visitor without one sees the gate.
_Avoid_: profile, user

**Gate**:
The lock card that takes the place of an Αναλύσεις page for a visitor who is not logged in. It leads to log in or sign up.
_Avoid_: paywall, lock screen

**Auth drawer**:
The panel that slides in from the right where a visitor logs in or signs up. Sign up runs in three steps inside it.
_Avoid_: auth modal, popup

**Sign-up request**:
What a visitor sends with the sign-up form: name, email, password, job, reason for use and how they found apotypos. It waits for approval and gives no access until then.
_Avoid_: registration, new account
