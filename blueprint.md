# Project Blueprint: MEST Tactics Simulator

## ⚠️ This File Has Been Split

**The full blueprint has been split into smaller, focused documents.**

**For detailed information, use the split files in `docs/blueprint/`:**

| Document | Purpose |
|----------|---------|
| [`docs/blueprint/01-overview.md`](docs/blueprint/01-overview.md) | Overview, Operating Principles, Development Environment |
| [`docs/blueprint/02-game-docs.md`](docs/blueprint/02-game-docs.md) | Game Documentation References, Implementation Details |
| [`docs/blueprint/03-current-task.md`](docs/blueprint/03-current-task.md) | Current Task, Gaps, Prioritized Implementation Plan |
| [`docs/blueprint/phases/`](docs/blueprint/phases/) | Phase documentation (Phase 0-4, A0, R, S, Future) |

**Navigation:** See [`docs/blueprint/README.md`](docs/blueprint/README.md) for full index.

---

## Core Operating Principles (Summary)

**These principles govern all work on this project:**

1.  **Single Source of Truth:** All data MUST come from local files (`src/data/`, `src/guides/docs/rules*.md`, `docs/*.txt`).
    - **Rule Precedence:** `rules-overrides.md` > `rules*.md` > `docs/*.txt`
    - **Primary Rules Reference:** [`src/guides/docs/rules.md`](src/guides/docs/rules.md) — consult for all QSR rules

2.  **No Fabrication:** Never invent, fabricate, or infer information not explicitly in project files.

3.  **No External Game System Rules:** MEST Tactics QSR is unique. Do NOT import rules from D&D, Warhammer, Pathfinder, GURPS, or other systems.
    - **Dice:** d6-only success counting (Base/Modifier/Wild)
    - **Attributes:** CCA, RCA, REF, INT, POW, STR, FOR, MOV, SIZ only
    - **Combat:** Opposed Tests with cascades
    - **Damage:** Opposed Damage Tests vs FOR with Armor Rating

4.  **Dynamic Ranges (QSR Compliance):** Calculate distances dynamically, NOT hardcoded:
    - **Movement-based:** Use `character.finalAttributes.mov` (accounts for Sprint X, Flight X)
    - **Visibility-based:** Use `visibilityOR` from lighting conditions
    - **Weapon-based:** Use weapon's OR (Optimal Range)
    - **Audit:** See [`docs/hardcoded-distances-audit.md`](docs/hardcoded-distances-audit.md)

5.  **Filesystem First:** Scan filesystem before making changes to confirm file presence/absence.

6.  **Headless First Development:** Focus on core simulation logic. UI files (Astro, React) ignored until explicitly commanded.

---

## Development Principles (Summary)

1.  **Unit Testing:** Every feature requires comprehensive unit tests (Vitest)
2.  **SOLID Design:** Single Responsibility Principle; modular, independently testable subroutines
3.  **No Regex for Complex Parsing:** Use character-by-character string manipulation
4.  **No Hardcoded Distances:** Derive from MOV, visibilityOR, weapon OR, or trait levels
5.  **Debugging:** Use `console.log` for failing tests; remove after fix
6.  **Mandatory Unit Tests for Code Changes:** All code changes must include unit tests upon completion.
7.  **Unit Test Maintenance:** Existing tests that are no longer relevant must be removed. Existing tests that remain must not fail.
8.  **TypeScript Validation:** After finishing a set of new features, run `tsc --noEmit` to ensure there are no TypeScript errors.

---

## Testing Methodology (Summary)

1.  **Isolate:** Fix least-dependent failing test first
2.  **Focus:** One test at a time until passing
3.  **Progress:** Move to next test, then next file
4.  **Validate:** Run full suite after all fixes
5.  **TypeError = Structural Issue:** Investigate filesystem for duplicates

---

## Current Status

**All core phases complete:** ✅ Phase 0-4, A0
**Test suite:** 1,889 of 1,890 passing (1 pre-existing failure)

**Next priorities:** See [`docs/blueprint/03-current-task.md`](docs/blueprint/03-current-task.md)

---

## File Update Process

**When updating blueprint content:**

1.  **Read** the relevant split file in `docs/blueprint/`
2.  **Modify** only that file (not this summary)
3.  **Preserve** all cross-links and document index

**This file (`blueprint.md`)** serves as a minimal entry point directing to the full documentation.

---

## Quick Reference

| Topic | File |
|-------|------|
| **Full Operating Principles** | [`docs/blueprint/01-overview.md`](docs/blueprint/01-overview.md) |
| **QSR Rules** | [`src/guides/docs/rules.md`](src/guides/docs/rules.md) |
| **Rules Overrides** | [`src/guides/docs/rules-overrides.md`](src/guides/docs/rules-overrides.md) |
| **Current Tasks & Gaps** | [`docs/blueprint/03-current-task.md`](docs/blueprint/03-current-task.md) |
| **Phase Status** | [`docs/blueprint/phases/`](docs/blueprint/phases/) |
| **Hardcoded Distances Audit** | [`docs/hardcoded-distances-audit.md`](docs/hardcoded-distances-audit.md) |

---

**Extraction Date:** 2026-03-02  
**Original:** 9,449 lines → **This file:** ~150 lines  
**Full Documentation:** [`docs/blueprint/README.md`](docs/blueprint/README.md)
