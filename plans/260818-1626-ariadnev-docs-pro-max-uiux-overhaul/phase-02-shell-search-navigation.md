---
phase: 2
title: "Global Shell & Spotlight Search Experience"
status: completed
priority: P1
effort: "4h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: Global Shell & Spotlight Search Experience

## Overview
Elevate the search spotlight dialog, mobile drawer, pager navigation cards, and switcher menus to a high-speed command palette experience (comparable to Raycast, Linear, and Algolia DocSearch). Add keyboard guide footers, active result item highlighting, smooth drawer animations, and copy button sighted feedback.

## Integrated AgentKit Skills
- `/ak:frontend-development`: Optimizes `search-dialog.tsx`, `copy-actions.tsx`, and `mobile-drawer-enhancer.tsx`.
- `/ak:react-best-practices`: Ensures 0 hydration errors, proper event listener cleanup, and optimal modal rendering.
- `/ak:ui-ux-pro-max`: Provides keybinding badges (`⌘K`, `↑↓`, `↵`, `ESC`), glassmorphism backdrop blur, and transient "Copied ✓" status chips.

## Requirements
- Functional:
  - Add search result active highlight (`.search-control li a[aria-current="true"]` & `:focus-visible`).
  - Add keyboard shortcut footer inside `SearchDialog` (`↑↓ to navigate`, `↵ to open`, `ESC to close`).
  - Add transient visible feedback ("Copied ✓") to `document-copy-enhancer.tsx` and `copy-actions.tsx`.
  - Add smooth hover lift and directional arrow accents to `docs-pager.tsx` (`← Previous`, `Next →`).
  - Add CSS chevron indicators to `locale-version-switcher.tsx` summaries.
- Non-functional:
  - Modal backdrop must use `backdrop-filter: blur(8px)` with fallback.
  - Sighted copy feedback must auto-reset after 2000ms.

## Architecture & Code Changes
- Modify: `apps/docs/src/components/search-dialog.tsx`
  - Render footer keybinding strip with `<kbd>` chips.
- Modify: `apps/docs/src/components/document-copy-enhancer.tsx`
  - Temporarily swap button text/icon to "Copied ✓" on successful writeText.
- Modify: `apps/docs/src/styles/docs.css`
  - Style search dialog backdrop, result highlights, keybinding footer, pager hover elevation, and dropdown chevrons.

## Implementation Steps
1. Update `SearchDialog` JSX with bottom keyboard legend (`search-footer`).
2. Add CSS styles for `.search-footer`, `.search-results li a[aria-current="true"]`, and backdrop blur.
3. Update `DocumentCopyEnhancer` to toggle visual button state on copy.
4. Add pager card hover animation (`translateY(-2px)`) and border glow in `docs.css`.
5. Add subtle dropdown chevron indicators on `.switcher-group summary`.
6. Run `pnpm run test:docs` and verify no hydration mismatch.

## Success Criteria
- [ ] Spotlight search dialog features an intuitive keybinding footer and clear active result highlights.
- [ ] Clicking copy buttons provides immediate sighted visual confirmation ("Copied ✓") in addition to screen reader announcements.
- [ ] Pager cards elevate smoothly on hover with directional arrow guides.
- [ ] TypeScript clean and all docs contract tests pass.
