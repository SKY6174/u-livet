# anchor-operation-document-registration — Plan

> Date: 2026-09-24 | Level: Dynamic | Status: Approved

## Problem

The operation document list displays 16 source-plan cards, but production has only three actual offerings. The remaining 13 have no offering UUID, so the existing document editor and save RPC intentionally reject them. The screen says “DB 이관 대기” without a path to finish registration. Source-listed responsible people are not authenticated instructor accounts.

## Goals

- Explain the missing offering and instructor prerequisites accurately on each card.
- Let a course manager open the existing source-prefilled registration form directly from an unregistered card.
- Link a manager-confirmed draft offering to its source guide atomically, so title edits cannot leave the document card waiting indefinitely.
- Preserve MFA, manager role, document review, and instructor authorization checks.

## Non-goals

- No automatic bulk creation or publication of the 13 offerings.
- No automatic instructor account linking, role grant, responsibility assignment, or document submission.
- No inference that a source PDF is a submitted database document.

## Success criteria

- All 16 cards reflect the guide's actual offering link, including the three existing offerings.
- An unregistered card links to the corresponding source-prefilled registration form; creating its draft links the guide and unlocks manager document editing.
- A duplicate registration attempt fails without creating a second offering.
- Existing document authorization and draft/submission states remain unchanged.
- Lint, build, data verification, and DB migration checks pass; preview and main are synchronized.

## Reference

The earlier `anchor-antigravity-document-audit` design established that source documents alone cannot grant editing or submission access. This feature adds an explicit manager-controlled registration step while retaining that boundary.
