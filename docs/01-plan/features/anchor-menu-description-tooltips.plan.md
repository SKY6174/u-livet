# Menu description tooltips — plan

Date: 2026-09-23 · Level: Dynamic

## Goal

Remove the redundant sentence beneath “사업단 운영 현황” on the signed-in home. Show descriptions of navigation choices as contextual speech-bubble tooltips on hover and keyboard focus instead of permanent text beneath each menu label. Tooltip text must be gray and exactly 1.2px smaller than its menu label.

## Scope

- Apply a reusable treatment to navigation cards/links with a short description on the signed-in home, business-office menu, learner service menu, login audience menu, and report-preview menu.
- Preserve persistent descriptions that are content or status (course summaries, form help, workflows, hero and section introductions), rather than menu hints.
- Keep menu names and destinations unchanged. Keep descriptions accessible to assistive technology and make tooltips visible on keyboard focus.

## Acceptance

- The specified home sentence is absent.
- Menu hints are hidden at rest and appear in a speech bubble on hover or focus, without being clipped by their cards.
- Gray tooltip text computes to menu font size minus 1.2px.
- Existing navigation, responsive layouts, accessibility, lint, type checking and build remain valid.
