# Project Blueprint: MEST Tactics Simulator

## 1. Overview

This project is a wargame simulator designed to run as a web application. The goal is to create a flexible and performant simulator that can be easily extended with new rules and scenarios.

**Project Evolution:**
- **Phase 1 (Complete):** Headless simulation engine with spatial awareness
- **Phase 2 (Complete):** Mission system with 10 of 10 missions implemented
- **Phase 3 (Planned):** Web UI for local play
- **Phase 4 (Planned):** Online multiplayer platform with authentication, social features, and cloud deployment
- **Phase 4E (Planned):** Enterprise platform foundation (RBAC, audit logs, observability)
- **Phase 5 (Future - Non-QSR):** Character Progression & Champion System
  - Track per-character statistics: RPs scored, OMs acquired, VPs earned, eliminations, etc.
  - Enable character advancement with enhanced abilities
  - Create "Champion" characters that grow across multiple games
  - **Note:** This is a post-QSR feature for campaign/play style variety, not part of core QSR rules

## 2. The Blueprint: Our Shared Source of Truth

**This document is the anchor for my behavior.**

Its purpose is to serve as our shared, persistent memory and single source of truth for the project. I will consult this document before every major action to ensure my behavior is consistent and aligned with the project's established rules and your expectations.

1.  **To Anchor Behavior:** The "Core Operating Principles," "Development Principles," "Development Environment," and "Testing and Debugging Methodology" sections are my explicit rulebook.
2.  **To Document the Project:** It acts as living, high-level documentation of the project's architecture, data models, and core logic.
3.  **To Manage Workflow:** The "Current Task" section is our shared to-do list, ensuring we are always on the same page.

My update process for this document is to **Read, Modify, and Write**. I will always read the file first, perform a targeted, non-destructive update, and then write the complete file back.

## 3. Core Operating Principles

1.  **Single Source of Truth:** The project's local files are the absolute and only source of truth. All data, including but not limited to character archetypes, items, weapons, armor, and game rules, MUST be drawn directly from the JSON files in `src/data/` and the markdown files (e.g., `rules.md`).
    Rule precedence is explicit: `src/guides/docs/rules-overrides.md` > `src/guides/docs/rules*.md` > `docs/*.txt`.
2.  **No Fabrication:** Under no circumstances should information be invented, fabricated, or inferred from external knowledge. If a piece of data does not exist explicitly in the project's files, it cannot be used.
3.  **No External Game System Rules:** MEST Tactics QSR is its own unique game system. **Do not cite, import, or fabricate rules from other game systems** such as D&D, Warhammer, Pathfinder, GURPS, or any other tabletop RPG or wargame. Specifically:
    - **Dice Mechanics:** MEST Tactics uses d6-only success counting (Base/Modifier/Wild dice). Do not substitute d10, d12, d20, or any other dice mechanics from other systems.
    - **Attribute Names:** Use only the 9 MEST Tactics attributes (CCA, RCA, REF, INT, POW, STR, FOR, MOV, SIZ). Do not substitute attributes from other systems.
    - **Combat Resolution:** MEST Tactics uses Opposed Tests with cascades. Do not substitute THAC0, AC, saving throws, or other mechanics from other systems.
    - **Damage Resolution:** MEST Tactics uses Opposed Damage Tests vs FOR with Armor Rating reduction. Do not substitute hit points, wound tracks, or other damage systems from other systems.
    - **If a rule is not found in the project files, state that it is not defined rather than importing from external systems.**
4.  **Dynamic Ranges and Distances (QSR Compliance):** All distances, ranges, and areas of effect MUST be calculated dynamically from QSR rules, NOT hardcoded. Specifically:
    - **Movement-based ranges:** Use character's effective MOV (accounts for Sprint X, Flight X traits) for threat detection, counter-charge, engagement ranges.
    - **Visibility-based ranges:** Use current `visibilityOR` (from lighting conditions) for Cohesion, Detection, Wait reactive range, LOS checks, Situational Awareness.
    - **Weapon-based ranges:** Use weapon's OR (Optimal Range) for range bands, point-blank, ORM penalties.
    - **Trait-based modifications:** Apply trait levels (Sprint X, Flight X, Stealthy X, etc.) to movement, detection, and concealment calculations.
    - **Exception:** Rule-defined constants (Suppression 1 MU, ROF spacing 1 MU, Firelane arc 90°) may be hardcoded as they are fixed by QSR.
    - **Audit requirement:** See `docs/hardcoded-distances-audit.md` for approved constants vs. values requiring dynamic calculation.
5.  **Filesystem First:** Before making any changes or additions to the codebase, the filesystem must be scanned to confirm the presence or absence of relevant files.
6.  **Headless First Development:** All development must be focused on the core, headless simulation logic. UI-related files, dependencies (Astro, React, etc.), and configurations are to be ignored until explicitly commanded to work on them. The primary interface for the application is the command line.

### Filesystem Integrity

1.  **Always Audit Before Creating:** Before creating any new file, especially for a core module like `Character`, `Item`, or `DiceRoller`, I will **always** first list the files in the target directory to check for existing conflicts.
2.  **Refactor = Move, Verify, THEN Delete:** When refactoring by moving files, I will now follow a strict "move, verify, delete" sequence. I will not consider the refactor complete until the old file is explicitly deleted and the system is tested again.
3.  **No Redundant Code:** Before creating any new function, class, module, or file:
    - **Search existing codebase** for similar functionality using grep or glob patterns
    - **Check for existing implementations** that could be extended or reused
    - **Verify the feature doesn't already exist** under a different name or location
    - **Document the gap** if existing code is insufficient (why it can't be reused)
    - **Prefer extending existing code** over creating duplicates
    - **Example:** Before creating `battlefield-svg.ts`, search for `*svg*.ts` to find `SvgRenderer.ts`
4.  **Cross-Session Continuity:** At the start of each new session or thread:
    - **Review recent file changes** to understand what was just implemented
    - **Check for recently created files** that might be relevant to the new task
    - **Reference previous session's work** to avoid duplicating effort
    - **Maintain a mental model** of the codebase architecture across sessions

## 4. Development Environment & Toolchain

*   **Testing Framework:** Vitest
*   **Transpiler:** TypeScript compiler (`tsc`)
*   **Module System:** ES Modules
*   **Target Environment:** Node.js
*   **TypeScript Execution:** `tsx`

## 5. Development Principles

1.  **Unit Testing as a Priority:** Every new feature, rule, or piece of logic must be accompanied by a comprehensive set of unit tests.
2.  **Separation of Responsibilities (SOLID):** The codebase will adhere to SOLID design principles, with a strong emphasis on the Single Responsibility Principle. Complex processes will be broken down into smaller, modular, and independently testable subroutines.
3.  **No Regular Expressions for Complex Parsing:** Avoid using regular expressions for parsing structured strings with multiple, potentially ambiguous parts (e.g., damage formulas). Instead, use simple, character-by-character string manipulation to ensure clarity, predictability, and ease of debugging. Regex should only be used for simple, well-defined pattern matching.
4.  **Debugging with Console Logs:** When unit tests fail, introduce `console.log` statements to the relevant code to help with debugging. These logs should be removed only after a successful `npm test` run.
5.  **Declare and Use Variables for Function Arguments:** Always declare variables for function arguments. Never pass a non-variable argument to a function.
6.  **No Hardcoded Distances (QSR Compliance):** When implementing ranges, distances, or areas of effect:
    - **NEVER** use magic numbers like `6`, `8`, `16` for MU distances without QSR rule reference.
    - **ALWAYS** derive from: `character.finalAttributes.mov`, `lighting.visibilityOR`, `weapon.OR`, or trait levels.
    - **ALWAYS** pass context parameters (`visibilityOrMu`, `effectiveMov`) through function signatures.
    - **DOCUMENT** any constant values with QSR rule reference in comments.
    - **REVIEW** against `docs/hardcoded-distances-audit.md` before merging.
    - **Code Review Checklist:**
      ```typescript
      // ❌ WRONG: Hardcoded distance
      if (distance <= 6) { /* ... */ }

      // ✅ CORRECT: Dynamic from visibility
      const cohesionRange = (visibilityOrMu ?? 16) / 2;
      if (distance <= cohesionRange) { /* ... */ }

      // ✅ CORRECT: Dynamic from movement
      const threatRange = getEffectiveMovement(character);
      if (distance <= threatRange) { /* ... */ }
      ```

## 6. Testing and Debugging Methodology

To ensure a stable and predictable codebase, the following systematic approach will be used to address all unit test failures:

1.  **Isolate and Prioritize:** When a test run results in failures, identify the **least dependent failing test**.
2.  **Focus on a Single Test:** Concentrate all efforts on fixing this single, isolated test.
3.  **Iterate Until Passing:** Run the test repeatedly in isolation until it passes. No other tests will be addressed during this time.
4.  **Incremental Progression:** Once the test passes, move to the next least dependent failing test and repeat the process.
5.  **File-by-File Completion:** Once all tests in a file pass, move to the next file with failing tests and repeat the process.
6.  **Full Suite Validation:** After all tests in all files pass, run the entire test suite one final time to confirm success.
7.  **`TypeError` is a Structural Red Flag:** `TypeError` and `ReferenceError` will be treated not just as code errors, but as high-priority red flags for potential structural problems like duplicate modules. I will investigate the file system *before* the code logic in these cases.

## 7. Codebase Conventions & Standards

1.  **Dice Enum:** The enum for dice variations will be named `DiceType` (plural).
2.  **Result Interfaces:** Interfaces for action results will be named descriptively (e.g., `DisengageResult`).

---

**Document Index:**
- [01-overview.md](01-overview.md) — This file (Overview, Operating Principles, Environment)
- [02-game-docs.md](02-game-docs.md) — Game Documentation, Implementation Details
- [03-current-task.md](03-current-task.md) — Current Task, Gaps, Prioritized Plan
- [phases/phase-0-qsr-rules.md](phases/phase-0-qsr-rules.md) — Phase 0: QSR Rules Gap Closure
- [phases/phase-1-engine.md](phases/phase-1-engine.md) — Phase 1: Core Engine Stability
- [phases/phase-2-ai-foundation.md](phases/phase-2-ai-foundation.md) — Phase 2: AI Foundation
- [phases/phase-2-subphases.md](phases/phase-2-subphases.md) — Phase 2.1-2.7: AI Sub-phases
- [phases/phase-3-ai-tactical.md](phases/phase-3-ai-tactical.md) — Phase 3: AI Tactical Intelligence
- [phases/phase-4-validation.md](phases/phase-4-validation.md) — Phase 4: Validation & Testing
- [phases/phase-a0-visual-audit.md](phases/phase-a0-visual-audit.md) — Phase A0: Visual Audit API
- [phases/phase-r-terrain.md](phases/phase-r-terrain.md) — Phase R: Terrain Placement Refactoring
- [phases/phase-s-consolidation.md](phases/phase-s-consolidation.md) — Phase S: Battle Script Consolidation
- [phases/future-phases.md](phases/future-phases.md) — Future Phases (I+)
