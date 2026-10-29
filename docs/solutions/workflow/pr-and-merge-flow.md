---
title: Pull request flow for prototype changes
date: 2026-10-29
category: workflow
module: repo
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - a change affects what the Netlify site shows
tags: [git, pull-request, netlify, deploy-preview]
---

# Pull request flow for prototype changes

## Context
The user reviews a Netlify deploy preview of each change. A PR exists to produce that preview.

## Guidance
- Branch `claude/<short-name>` from `main`. Conventional commits (`feat:`, `fix:`, `chore:`).
- Several asks in a row go on one open PR as small commits.
- Update the PR body with `gh api -X PATCH repos/vaszafei/apotypos-demo-redesign/pulls/<n> -F body=@file`. `gh pr edit` fails.
- Merge only after an explicit "lets merge": `gh pr merge <n> --merge`, then `git checkout main && git pull`.
- A change with nothing to preview (config, docs) does not need a PR. Commit to `main`.
- Cloud sessions clone from GitHub, so pull before you branch.
- Greek UI names are spelled in Latin letters in chat (themata imeras). Map them to the Greek text.

## Why This Matters
A PR without a visible change adds a step and no review value. A merge without the words "lets merge" skips the user's check.

## When to Apply
Every change to the repo.
