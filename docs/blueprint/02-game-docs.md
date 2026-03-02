# Game Documentation & Implementation Details

## 8. Game Documentation

*   [Mastery](../../src/guides/docs/mastery.md)
*   [Rules](../../src/guides/docs/rules.md)
*   [Rules Overrides](../../src/guides/docs/rules-overrides.md)

## 8.1 Context Anchors (Non-UI Docs)

The project includes markdown files that serve as **AI context anchors** to narrow behavior and ensure consistent rule interpretation. These are **not** UI content and are **not** intended to be treated as Astro content collections or rendered in any interface. They may be stored outside `src/content` to avoid Astro content-collection warnings.

## 9. Project Implementation Details

### Core Mechanics

*   **Dice Types:** `Base`, `Modifier`, `Wild`.
*   **Success & Carry-Over:** Defined in `getDieSuccesses`. The key is that a roll generates successes and can *also* generate a single carry-over die for a subsequent round.
*   **`performTest`:** Executes a *single round* of dice rolls and reports the score and any carry-over dice. It does **not** recursively roll carry-over dice.
*   **`resolveTest`:** The high-level orchestrator for a contested roll between two participants. It calculates dice pools, calls `performTest` for each, and determines the final outcome.

### Actions

*   **`makeDisengageAction`:** The primary implemented action. It gathers situational modifiers (`isCornered`, `isFlanked`, etc.) and uses `resolveTest` to determine the result.

### Data Model

*   **`Character`**, **`Profile`**, **`Item`**.
*   Game data is stored statically in `src/lib/data.ts`.

---

**Document Index:**
- [01-overview.md](01-overview.md) — Overview, Operating Principles, Environment
- [02-game-docs.md](02-game-docs.md) — This file (Game Documentation, Implementation Details)
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
