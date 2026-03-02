# Project Blueprint - Split Documentation

This directory contains the split version of the main `blueprint.md` file (9,449 lines), organized into smaller, focused documents for easier navigation and maintenance.

## Structure

```
docs/blueprint/
├── README.md                    # This file - navigation index
├── 01-overview.md               # Overview, Operating Principles, Environment
├── 02-game-docs.md              # Game Documentation, Implementation Details
├── 03-current-task.md           # Current Task, Gaps, Prioritized Plan
└── phases/
    ├── phase-0-qsr-rules.md     # Phase 0: QSR Rules Gap Closure
    ├── phase-1-engine.md        # Phase 1: Core Engine Stability
    ├── phase-2-ai-foundation.md # Phase 2: AI Foundation
    ├── phase-2-subphases.md     # Phase 2.1-2.7: AI Sub-phases
    ├── phase-3-ai-tactical.md   # Phase 3: AI Tactical Intelligence
    ├── phase-4-validation.md    # Phase 4: Validation & Testing
    ├── phase-a0-visual-audit.md # Phase A0: Visual Audit API
    ├── phase-r-terrain.md       # Phase R: Terrain Placement Refactoring
    ├── phase-s-consolidation.md # Phase S: Battle Script Consolidation
    └── future-phases.md         # Future Phases (I+)
```

## Document Overview

### Core Documents

| File | Description | Lines |
|------|-------------|-------|
| [01-overview.md](01-overview.md) | Project overview, core operating principles, development environment, testing methodology | ~180 |
| [02-game-docs.md](02-game-docs.md) | Game documentation references, implementation details, core mechanics | ~50 |
| [03-current-task.md](03-current-task.md) | Current task status, gaps/mismatches tracking, prioritized implementation plan | ~120 |

### Phase Documents

| File | Description | Status |
|------|-------------|--------|
| [phases/phase-0-qsr-rules.md](phases/phase-0-qsr-rules.md) | Phase 0: QSR Rules Gap Closure (Initiative, IP, Multi-Weapon) | ✅ Complete |
| [phases/phase-1-engine.md](phases/phase-1-engine.md) | Phase 1: Core Engine Stability (Battle Runner, Deployment, Mission Runtime) | ✅ Complete |
| [phases/phase-2-ai-foundation.md](phases/phase-2-ai-foundation.md) | Phase 2: AI Foundation (Utility Scorer, CharacterAI, Tactical Doctrine) | ✅ Complete |
| [phases/phase-2-subphases.md](phases/phase-2-subphases.md) | Phase 2.1-2.7: AI Sub-phases (Visibility, Agility, Falling, Jump, Stow, REF, Tests) | ✅ Complete |
| [phases/phase-3-ai-tactical.md](phases/phase-3-ai-tactical.md) | Phase 3: AI Tactical Intelligence (Focus Fire, Flanking, Squad Coordination) | ✅ Complete |
| [phases/phase-4-validation.md](phases/phase-4-validation.md) | Phase 4: Validation & Testing (QSR Rules, AI Behavior, Mission Validation) | ✅ Complete |
| [phases/phase-a0-visual-audit.md](phases/phase-a0-visual-audit.md) | Phase A0: Visual Audit API & Interactive HTML Viewer | ✅ Complete |
| [phases/phase-r-terrain.md](phases/phase-r-terrain.md) | Phase R: Terrain Placement Refactoring (Unified Module) | 📋 Planned |
| [phases/phase-s-consolidation.md](phases/phase-s-consolidation.md) | Phase S: Unified Battle Script Consolidation | ⚠️ Blocked |
| [phases/future-phases.md](phases/future-phases.md) | Future Phases (I+) - Web UI, Full AI Battle Runner, Test Implementation | 📋 Deferred |

## Quick Navigation

### By Priority

**P0-CRITICAL:**
- [Phase 0: QSR Rules Gap Closure](phases/phase-0-qsr-rules.md)
- [Phase A0: Visual Audit API](phases/phase-a0-visual-audit.md)
- [Phase S: Battle Script Consolidation](phases/phase-s-consolidation.md)

**P1-HIGH:**
- [Phase 1: Core Engine Stability](phases/phase-1-engine.md)
- [Phase 2.1: Visibility-Aware Ranges](phases/phase-2-subphases.md)
- [Phase R: Terrain Placement](phases/phase-r-terrain.md)
- [Phase I: Full AI Battle Runner](phases/future-phases.md)

**P2-MEDIUM:**
- [Phase 2: AI Foundation](phases/phase-2-ai-foundation.md)
- [Phase 2.2-2.7: AI Sub-phases](phases/phase-2-subphases.md)

**P3-LOW:**
- [Phase 3: AI Tactical Intelligence](phases/phase-3-ai-tactical.md)

**P4-LOWEST:**
- [Phase 4: Validation & Testing](phases/phase-4-validation.md)

### By Completion Status

**✅ Complete:**
- Phase 0: QSR Rules Gap Closure
- Phase 1: Core Engine Stability
- Phase 2: AI Foundation (all sub-phases)
- Phase 3: AI Tactical Intelligence
- Phase 4: Validation & Testing
- Phase A0: Visual Audit API

**📋 Planned/In Progress:**
- Phase R: Terrain Placement Refactoring
- Phase S: Battle Script Consolidation (Blocked)
- Phase I: Full AI Battle Runner

**📋 Deferred:**
- Phase 3: Web UI for Local Play
- Phase H: QSR Unit Test Implementation (partial)

## Related Documents

- [Master Blueprint](../../blueprint.md) - Original monolithic document (9,449 lines)
- [Hardcoded Distances Audit](../hardcoded-distances-audit.md) - Distance compliance tracking
- [QSR Traceability](../qsr-traceability.md) - QSR rules traceability matrix
- [Advanced Traits Cross-Reference](../advanced-traits-cross-reference.md) - Trait documentation

## Usage

When referencing blueprint content:
1. **Prefer specific phase documents** for implementation details
2. **Use 01-overview.md** for core principles and development guidelines
3. **Use 03-current-task.md** for current priorities and gaps
4. **Reference the master blueprint.md** only for historical context or full-text search

## Maintenance

When updating blueprint content:
1. **Update the specific phase document** where the change belongs
2. **Update this README.md** if adding new documents or changing status
3. **Keep the master blueprint.md** as a fallback (may be regenerated from split files if needed)

---

**Extraction Date:** 2026-03-02  
**Original File:** `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (9,449 lines)  
**Split Files:** 13 documents across 2 directories
