---
title: Quote the user when a plan marks a decision as theirs
date: 2026-11-03
category: workflow
module: docs/plans
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - a plan or plan check writes "user-directed", "user-approved" or "session-settled" next to a decision
  - an agent builds from a plan that another session wrote
tags: [plans, decisions, handoff, requests]
---

# Quote the user when a plan marks a decision as theirs

## Context
In issue #2, PR 4, the plan's U8 line said Part C (the period control) was "preset chips, the period picker and a daily histogram (session-settled: user-directed — chosen over picker and brush only)". There was no quote. The user had said the periods belong inside the date picker. The chip row was built, reviewed by seven reviewers, put into tests and screenshots, and handed over to the next session as a decision of the user. It came out only when the user saw the card: "i said the periods not to be on the chart but in date picker". The fix (the review-fix commit of the PR 4 branch `claude/shared-parts`) removed the chips, kept the picker on the right because its popover is anchored to the right edge (`date-range.css` `.dr-pop { right: 0 }`), and corrected the plan line.

## Guidance
- When a plan records a decision as the user's, put the user's words next to it in quotes, or a link to where they said it. "User-directed" with no quote is the writer's reading, not a decision.
- A decision that comes from the agent (a prefix, a reuse, an option the user only approved as part of a whole plan) is written as the agent's call: "my call, in the plan check the user approved".
- When resuming from a plan or handoff, treat an unquoted "user-directed" as unverified. Before building UI on it, show the user a sketch or one line ("Part C: chips on the card + picker + brush, as the plan says?").
- If the user contradicts a recorded decision, fix the record in the same commit as the code, and say what the old line said, so the next reader does not trust the old version.
- Reviewers check code against the plan, so a wrong record passes review. Only the user can catch it.

## Why This Matters
A wrong record is worse than no record: each later step (review, tests, handoff) builds on it and makes it look more settled. Here it cost a review round, a test rewrite and a layout fix.

## When to Apply
Every plan, plan check and handoff in `docs/`, and every resume from one. See also `docs/solutions/conventions/layout-requests-are-literal.md`: read the request literally, and record it literally too.
