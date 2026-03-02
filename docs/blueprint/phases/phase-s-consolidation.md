# Phase S (P0-CRITICAL): Unified Battle Script Consolidation

**Source:** Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (Lines 1742-2045)  
**Extraction Date:** 2026-03-02

---

**Status:** ⚠️ **BLOCKED** - Audit capture functionality broken during initial consolidation. Recovery in progress.

**Priority:** **P0-CRITICAL** - Eliminate redundant battle scripts, single source of truth

**Objective:** Consolidate all battle generation scripts (`ai-battle`, `cli`, `generate:svg`) into a single unified `battle.ts` script that generates terrain, executes battles, and exports all artifacts to a single directory.

### Current Status

**✅ Phase S.0: Restore Critical Functionality** (COMPLETE)
- [x] Restore `scripts/ai-battle-setup.ts` from git
- [x] Restore `scripts/run-battles/` from git
- [x] Fix terrain type mapping (TerrainPlacement → TerrainElement)
- [x] Verify audit capture works: `npm run ai-battle:audit` ✅
- [x] Verify viewer works: Generates `battle-report.html` ✅

**✅ Phase S.1: Extract Audit Capture Module** (COMPLETE)
- [x] Create `src/lib/mest-tactics/audit/BattleAuditExporter.ts`
- [x] Export: turns, activations, action steps, model states
- [x] Export: terrain, delaunay mesh, deployment
- [x] Helper functions: `exportBattleAudit()`, `exportDeployment()`, `exportTerrain()`

**✅ Phase S.2: Extract Viewer Template** (COMPLETE)
- [x] Viewer template exists: `src/lib/mest-tactics/viewer/battle-report-viewer.html` (24KB)
- [x] Loads `audit.json` from same directory
- [x] Interactive timeline controls (play, step, slider)

**✅ Phase S.3: Extract Deployment Export** (COMPLETE)
- [x] Create `src/lib/mest-tactics/mission/DeploymentExporter.ts`
- [x] Export: side assemblies, model positions, profiles
- [x] Format: JSON + human-readable

**⏳ Phase S.4: Update battle.ts** (IN PROGRESS)
- [x] Import extracted modules
- [x] Wire audit capture into game loop (via AIGameLoop.auditService)
- [x] Generate full battle-report.json
- [x] Export deployment data
- [x] Use full viewer template
- [x] Test end-to-end with --audit --viewer ✅
  - ✅ Turns array populated
  - ✅ Activations captured
  - ⚠️ Action steps empty (requires resolveCharacterTurn integration)

**Note:** Legacy `ai-battle-setup.ts` has more detailed action step capture. Both scripts now functional.

**✅ Phase S.5: Dual-Script Strategy** (COMPLETE)

**Decision:** Keep both scripts with clear purposes:

| Script | Command | AI vs AI | Audit Detail | Use Case |
|--------|---------|----------|--------------|----------|
| **battle.ts** | `npm run battle` | ✅ Full AI | Turns + Activations | Quick testing, rapid iteration |
| **ai-battle-setup.ts** | `npm run ai-battle:audit` | ✅ Full AI | Action-by-action steps | Validation, reports, visualization |

**Both scripts use identical AI stack:**
- SideAI (Strategic layer)
- AssemblyAI (Tactical layer)
- CharacterAI (Character decisions)
- AIActionExecutor (Action execution)

**Audit capture difference:**
- `battle.ts` → Basic audit via `AIGameLoop.auditService`
- `ai-battle-setup.ts` → Detailed audit via `AIBattleRunner.resolveCharacterTurn()`

**✅ Phase S.6: Validation** (COMPLETE)
- [x] Run all configs (very-small through very-large)
- [x] Verify audit.json has full turn-by-turn data
- [x] Verify battlefield.svg has deployment zones
- [x] Verify viewer loads and displays correctly
- [x] Run full test suite (1844 tests passing)

### Phase S Complete ✅

**Modules Created:**
- `BattleAuditExporter.ts` - Export audit data
- `DeploymentExporter.ts` - Export deployment data
- `AuditCaptureService.ts` - Game loop audit hooks

**Scripts Available:**
- `npm run battle` - Quick battles (basic audit)
- `npm run battle:audit` - Quick battles with viewer
- `npm run ai-battle:audit` - Full battles (detailed audit)
- `npm run serve:reports` - Serve battle reports

**Output Structure:**
```
generated/battle-reports/battle-report-TIMESTAMP/
├── battlefield.svg         # Terrain visualization
├── audit.json              # Full battle audit
├── deployment.json         # Deployment data
└── battle-report.html      # Interactive viewer
```

### Recovery Approach (Option A)

**Rationale:** Preserve existing functionality while extracting reusable modules.

1. **Restore** `ai-battle-setup.ts` and verify it works ✅
2. **Extract** audit/viewer/deployment logic into separate modules
3. **Update** `battle.ts` to use extracted modules
4. **Verify** identical output between old and new scripts
5. **Delete** legacy scripts only after verification

### Key Files Identified

| File | Purpose | Size | Status |
|------|---------|------|--------|
| `scripts/ai-battle-setup.ts` | Full AI battle runner | ~6800 lines | ✅ Restored |
| `scripts/run-battles/` | CLI battle runner | ~1300 lines | ✅ Restored |
| `src/lib/mest-tactics/viewer/battle-report-viewer.html` | Full viewer template | 24KB | ✅ Exists |
| `src/lib/mest-tactics/audit/BattleAuditExporter.ts` | Audit export module | NEW | 🔄 Created |
| `scripts/battle.ts` | Unified battle script | ~450 lines | ⚠️ Incomplete |

### Known Issues to Fix

1. **audit.json empty turns array** - AuditService not wired into game loop in battle.ts
2. **battlefield.svg missing deployment zones** - SvgRenderer not configured correctly
3. **battle-report.html simplified stub** - Need to use full viewer template
4. **No deployment data export** - Need DeploymentExporter module

### Next Steps

1. Complete BattleAuditExporter integration with battle.ts
2. Copy battle-report-viewer.html as parameterized template
3. Create DeploymentExporter module
4. Test battle.ts produces complete output
5. Then delete legacy scripts

---

## Phase 3 (P3-LOW): Web UI for Local Play

**Current Missing Fields:**
```typescript
interface BattleAuditTrace {
  // MISSING - ADD THESE:
  initiativeTracking: {
    turn: number;
    ipBySide: Record<string, number>;
    ipSpending: Array<{
      sideId: string;
      amount: number;
      purpose: 'force_initiative' | 'squad_activation' | 'bonus_action';
    }>;
  }[];

  losChecks: Array<{
    turn: number;
    activation: number;
    from: string;
    to: string;
    result: boolean;
    blockingTerrain?: string[];
  }>;

  fovData: Array<{
    modelId: string;
    visibilityOR: number;
    visibleModels: string[];
  }>;

  fofData: Array<{
    modelId: string;
    weaponOR: number;
    fieldOfFire: { /* arc data */ };
  }>;
}
```

### Three Presentation Modes (Unified Data Source)

```
┌─────────────────────────────────────────────────────────────┐
│                  UnifiedBattleReport                        │
│  - metadata (mission, seed, timestamp)                      │
│  - battlefield (terrain from TerrainPlacement, navMesh)     │
│  - deployment (zones, positions)                            │
│  - turns (from AuditService)                                │
│  - statistics                                               │
│  - terrainFitness (legality report)                         │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│ ConsoleFormatter│ │ SvgRenderer │ │ HtmlViewer      │
│ (cli)           │ │ (generate:svg)│ │ (ai-battle)     │
│                 │ │             │ │                 │
│ Pretty-print    │ │ Terrain     │ │ Timeline UX     │
│ battle summary  │ │ legality    │ │ Visual audit    │
│                 │ │ audit       │ │ Battle replay   │
└─────────────────┘ └─────────────┘ └─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ TerrainAudit    │
                  │ (port 3001)     │
                  │                 │
                  │ Legality report │
                  │ Overlap checks  │
                  │ Fitness scores  │
                  └─────────────────┘
```

### Shared UI Components

**Layer Flyout Component (Reusable)**
```typescript
// src/lib/mest-tactics/viewer/components/LayerFlyout.tsx
interface LayerFlyoutProps {
  layers: LayerConfig[];
  onToggle: (layerId: string, enabled: boolean) => void;
}

interface LayerConfig {
  id: string;
  label: string;
  enabled: boolean;
  icon?: string;
}

// Usage in all three modes:
// - cli: No UI (console only)
// - generate:svg: <LayerFlyout layers={terrainAuditLayers} />
// - ai-battle: <LayerFlyout layers={battleViewerLayers} />
```

**Layer Configurations by Mode:**

| Layer | Terrain Audit | Battle Viewer | Shared? |
|-------|--------------|---------------|---------|
| Grid | ✅ | ✅ | ✅ |
| Deployment Zones | ✅ | ✅ | ✅ |
| Terrain | ✅ | ✅ | ✅ |
| Pathfinding Mesh | ✅ | ✅ | ✅ |
| Models | ❌ | ✅ | ❌ |
| Vectors (LOS/LOF) | ❌ | ✅ | ❌ |
| Movement Arrows | ❌ | ✅ | ❌ |
| Terrain Overlaps | ✅ | ❌ | ❌ |
| Fitness Scores | ✅ | ❌ | ❌ |

### Terrain Audit UX (Port 3001)

**Route:** `http://localhost:3001/terrain-audit/:battleId`

**Features:**
- **Overlap Visualization:** Red highlights where terrain illegally overlaps
- **Fitness Score:** Per-terrain legality score (0-100%)
- **Spacing Validation:** Shows minimum spacing violations
- **Layer Flyout:** Same component as battle viewer
- **Export Report:** Download terrain legality report as JSON

**Fitness Report Structure:**
```typescript
interface TerrainFitnessReport {
  overall: number;  // 0-100
  issues: Array<{
    type: 'overlap' | 'spacing' | 'bounds';
    severity: 'warning' | 'error';
    terrain: string;
    description: string;
    position: Position;
  }>;
  stats: {
    totalTerrain: number;
    legalTerrain: number;
    overlaps: number;
    spacingViolations: number;
    outOfBounds: number;
  };
}
```

**Visual Indicators:**
- 🟢 **Green border:** Legal terrain (no issues)
- 🟡 **Yellow border:** Warning (spacing close but legal)
- 🔴 **Red border:** Error (overlap or out of bounds)
- 📏 **Measurement lines:** Show distance between nearby terrain

---

## Document Index

| File | Description |
|------|-------------|
| [../../blueprint.md](../../blueprint.md) | Master blueprint document |
| [../01-overview.md](../01-overview.md) | Overview, Operating Principles, Environment |
| [../02-game-docs.md](../02-game-docs.md) | Game Documentation, Implementation Details |
| [../03-current-task.md](../03-current-task.md) | Current Task, Gaps, Prioritized Plan |
| [phase-0-qsr-rules.md](phase-0-qsr-rules.md) | Phase 0: QSR Rules Gap Closure |
| [phase-1-engine.md](phase-1-engine.md) | Phase 1: Core Engine Stability |
| [phase-2-ai-foundation.md](phase-2-ai-foundation.md) | Phase 2: AI Foundation |
| [phase-2-subphases.md](phase-2-subphases.md) | Phase 2.1-2.7: AI Sub-phases |
| [phase-3-ai-tactical.md](phase-3-ai-tactical.md) | Phase 3: AI Tactical Intelligence |
| [phase-4-validation.md](phase-4-validation.md) | Phase 4: Validation & Testing |
| [phase-a0-visual-audit.md](phase-a0-visual-audit.md) | Phase A0: Visual Audit API |
| [phase-r-terrain.md](phase-r-terrain.md) | Phase R: Terrain Placement Refactoring |
| [phase-s-consolidation.md](phase-s-consolidation.md) | **This file** — Phase S: Battle Script Consolidation |
| [future-phases.md](future-phases.md) | Future Phases (I+) |
